import { HOME_DEVICES, HOME_DEVICE_ORDER, HOME_TEMPLATES, createDefaultHomeState } from '~/constants/home'
import type {
  DeviceKind,
  DevicePlacement,
  HomePoint,
  HomeSurface,
  HomeTemplate,
  HomeTemplateId,
  VirtualHomeState,
} from '~/types'

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

export function isHomeTemplateId(value: unknown): value is HomeTemplateId {
  return value === 'cloud-apartment' || value === 'studio' || value === 'comfort-suite' || value === 'my-home'
}

/**
 * The room a template opens on.
 *
 * @param template - Home template
 * @returns Its default room, or the first room when it names none
 */
export function defaultRoomId(template: HomeTemplate) {
  return template.defaultRoomId ?? template.rooms[0]?.id ?? null
}

export function getPolygonBounds(points: HomePoint[]) {
  const xs = points.map(point => point.x)
  const ys = points.map(point => point.y)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

export function pointInPolygon(point: HomePoint, polygon: HomePoint[]) {
  if (polygon.length < 3)
    return false

  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index]
    const previousPoint = polygon[previous]
    if (!currentPoint || !previousPoint)
      continue
    const intersects = (currentPoint.y > point.y) !== (previousPoint.y > point.y)
      && point.x < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) / (previousPoint.y - currentPoint.y) + currentPoint.x
    if (intersects)
      inside = !inside
  }
  return inside
}

function mix(start: number, end: number, amount: number) {
  return start + (end - start) * amount
}

export function surfacePointToWorld(surface: HomeSurface, u: number, v: number): HomePoint {
  const [topLeft, topRight, bottomRight, bottomLeft] = surface.polygon
  const left = {
    x: mix(topLeft.x, bottomLeft.x, clamp(v)),
    y: mix(topLeft.y, bottomLeft.y, clamp(v)),
  }
  const right = {
    x: mix(topRight.x, bottomRight.x, clamp(v)),
    y: mix(topRight.y, bottomRight.y, clamp(v)),
  }
  return {
    x: mix(left.x, right.x, clamp(u)),
    y: mix(left.y, right.y, clamp(u)),
  }
}

/**
 * Surface coordinates of a point, the inverse of {@link surfacePointToWorld}.
 * Surfaces have level top and bottom edges, so the row comes from y and the
 * position along it from the slanted side edges. Points off the surface are
 * clamped to its edge.
 */
export function worldPointToSurface(surface: HomeSurface, point: HomePoint) {
  const [topLeft, topRight, bottomRight, bottomLeft] = surface.polygon
  const top = (topLeft.y + topRight.y) / 2
  const bottom = (bottomLeft.y + bottomRight.y) / 2
  const v = clamp((point.y - top) / Math.max(1, bottom - top))
  const left = mix(topLeft.x, bottomLeft.x, v)
  const right = mix(topRight.x, bottomRight.x, v)
  return {
    u: clamp((point.x - left) / Math.max(1, right - left)),
    v,
  }
}

export function placementToWorld(template: HomeTemplate, placement: DevicePlacement): HomePoint | null {
  if (!placement.surfaceId)
    return null
  const surface = template.surfaces.find(item => item.id === placement.surfaceId)
  return surface ? surfacePointToWorld(surface, placement.u, placement.v) : null
}

function distanceToBounds(point: HomePoint, surface: HomeSurface) {
  const bounds = getPolygonBounds(surface.polygon)
  const x = clamp(point.x, bounds.minX, bounds.maxX)
  const y = clamp(point.y, bounds.minY, bounds.maxY)
  return Math.hypot(point.x - x, point.y - y)
}

function isBlocked(template: HomeTemplate, roomId: string, point: HomePoint) {
  return template.obstacles.some(obstacle => obstacle.roomId === roomId && pointInPolygon(point, obstacle.polygon))
}

export function findSurfaceAtPoint(template: HomeTemplate, deviceId: DeviceKind, point: HomePoint, snapDistance = 72) {
  const candidates = template.surfaces
    .filter(surface => surface.accepts.includes(deviceId))
    .map(surface => ({
      surface,
      distance: pointInPolygon(point, surface.polygon) ? 0 : distanceToBounds(point, surface),
    }))
    .filter(candidate => candidate.distance <= snapDistance)
    .sort((left, right) => left.distance - right.distance)

  for (const candidate of candidates) {
    const local = worldPointToSurface(candidate.surface, point)
    const world = surfacePointToWorld(candidate.surface, local.u, local.v)
    // Obstacles are furniture footprints on the floor; tabletops sit on top of them.
    if (candidate.surface.kind !== 'floor' || !isBlocked(template, candidate.surface.roomId, world))
      return { surface: candidate.surface, ...local, world }
  }
  return null
}

export function hasPlacementCollision(template: HomeTemplate, placement: DevicePlacement, placements: DevicePlacement[]) {
  const point = placementToWorld(template, placement)
  if (!point)
    return false

  const size = HOME_DEVICES[placement.deviceId]
  const radius = Math.min(size.width, size.height) * 0.34
  return placements.some((other) => {
    if (other.deviceId === placement.deviceId || other.roomId !== placement.roomId)
      return false
    const otherPoint = placementToWorld(template, other)
    if (!otherPoint)
      return false
    const otherSize = HOME_DEVICES[other.deviceId]
    const otherRadius = Math.min(otherSize.width, otherSize.height) * 0.34
    return Math.hypot(otherPoint.x - point.x, otherPoint.y - point.y) < radius + otherRadius
  })
}

export function createPlacementAtPoint(
  template: HomeTemplate,
  deviceId: DeviceKind,
  point: HomePoint,
  placements: DevicePlacement[],
  rotation: DevicePlacement['rotation'] = 0,
) {
  const match = findSurfaceAtPoint(template, deviceId, point)
  if (!match)
    return null

  const placement: DevicePlacement = {
    deviceId,
    roomId: match.surface.roomId,
    surfaceId: match.surface.id,
    u: match.u,
    v: match.v,
    rotation,
  }
  return hasPlacementCollision(template, placement, placements) ? null : placement
}

export function createPlacementInRoom(
  template: HomeTemplate,
  deviceId: DeviceKind,
  roomId: string,
  placements: DevicePlacement[],
  rotation: DevicePlacement['rotation'] = 0,
) {
  const preferredPoint = deviceId === 'air-conditioner'
    ? { u: 0.3, v: 0.24 }
    : deviceId === 'television'
      ? { u: 0.72, v: 0.5 }
      : deviceId === 'fan'
        ? { u: 0.82, v: 0.52 }
        : deviceId === 'robot-vacuum'
          ? { u: 0.16, v: 0.78 }
          : { u: 0.52, v: 0.44 }
  const candidates = [
    preferredPoint,
    { u: 0.5, v: 0.5 },
    { u: 0.2, v: 0.65 },
    { u: 0.8, v: 0.7 },
    { u: 0.35, v: 0.3 },
    { u: 0.68, v: 0.34 },
  ]

  for (const surface of template.surfaces.filter(item => item.roomId === roomId && item.accepts.includes(deviceId))) {
    for (const candidate of candidates) {
      const placement = createPlacementAtPoint(
        template,
        deviceId,
        surfacePointToWorld(surface, candidate.u, candidate.v),
        placements,
        rotation,
      )
      if (placement?.roomId === roomId)
        return placement
    }
  }
  return null
}

export function getRobotRoute(template: HomeTemplate, placement: DevicePlacement | undefined) {
  if (!placement?.roomId)
    return []
  return template.robotRoutes.find(route => route.roomId === placement.roomId)?.points ?? []
}

export function getPointAlongRoute(points: HomePoint[], progress: number) {
  if (points.length === 0)
    return null
  if (points.length === 1)
    return points[0]

  const segmentLengths = points.slice(1).map((point, index) => {
    const previousPoint = points[index]
    return previousPoint ? Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y) : 0
  })
  const totalLength = segmentLengths.reduce((total, length) => total + length, 0)
  let target = clamp(progress) * totalLength
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const length = segmentLengths[index]
    const start = points[index]
    const end = points[index + 1]
    if (length === undefined || !start || !end)
      continue
    if (target <= length) {
      const ratio = length === 0 ? 0 : target / length
      return {
        x: mix(start.x, end.x, ratio),
        y: mix(start.y, end.y, ratio),
      }
    }
    target -= length
  }
  return points.at(-1) ?? null
}

function readNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value))
    return value
  return fallback
}

function readRotation(value: unknown): DevicePlacement['rotation'] {
  if (value === 90 || value === 180 || value === 270)
    return value
  return 0
}

export function normalizeHomeState(value: unknown): VirtualHomeState {
  if (!value || typeof value !== 'object')
    return createDefaultHomeState()

  const record = value as Record<string, unknown>
  const templateId = isHomeTemplateId(record.templateId) ? record.templateId : 'cloud-apartment'
  const template = HOME_TEMPLATES[templateId]
  const fallback = createDefaultHomeState(templateId)
  const rawPlacements = Array.isArray(record.placements) ? record.placements : []
  const placements = HOME_DEVICE_ORDER.map((deviceId) => {
    const raw = rawPlacements.find((item) => {
      return item && typeof item === 'object' && (item as Record<string, unknown>).deviceId === deviceId
    }) as Record<string, unknown> | undefined
    if (!raw)
      return fallback.placements.find(item => item.deviceId === deviceId)!

    const surfaceId = typeof raw.surfaceId === 'string' ? raw.surfaceId : null
    const surface = surfaceId ? template.surfaces.find(item => item.id === surfaceId && item.accepts.includes(deviceId)) : undefined
    return {
      deviceId,
      roomId: surface?.roomId ?? null,
      surfaceId: surface?.id ?? null,
      u: clamp(readNumber(raw.u, 0.5)),
      v: clamp(readNumber(raw.v, 0.5)),
      rotation: readRotation(raw.rotation),
    }
  })

  const hasValidChangedAt = typeof record.changedAt === 'string' && Number.isFinite(Date.parse(record.changedAt))
  const changedAt = hasValidChangedAt ? new Date(record.changedAt as string).toISOString() : fallback.changedAt

  return {
    version: 1,
    templateId,
    placements,
    revision: Math.max(0, Math.floor(readNumber(record.revision, 0))),
    changedAt,
  }
}
