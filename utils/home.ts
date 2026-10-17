import { FURNITURE_KINDS, isFurnitureKind } from '~/constants/furniture'
import { HOME_DEVICES, HOME_DEVICE_ORDER, HOME_TEMPLATES, createDefaultHomeState } from '~/constants/home'
import type {
  DeviceKind,
  DevicePlacement,
  FurnitureEdit,
  FurnitureRotation,
  HomePoint,
  HomeSurface,
  HomeTemplate,
  HomeTemplateId,
  SavedHomeLayout,
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

/**
 * The sheet a surface is drawn on. Points on different sheets are not
 * comparable, so snapping and collisions stay within one sheet.
 *
 * @param template - Home template
 * @param surface - The surface
 * @returns A key shared by the surfaces on the same sheet
 */
export function surfaceSheet(template: HomeTemplate, surface: HomeSurface) {
  if (template.layout !== 'plan')
    return 'elevation'
  // Floors share the floor plan; tabletops sit above it and walls stand on their own.
  return surface.kind === 'floor' ? 'floor' : surface.id
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
  return (template.obstacles ?? []).some(obstacle => obstacle.roomId === roomId && pointInPolygon(point, obstacle.polygon))
}

/**
 * Find the surface a device dropped at a point would go on.
 *
 * @param template - Home template
 * @param deviceId - Device being placed
 * @param point - Point on a sheet
 * @param snapDistance - How far off a surface the point may be and still snap to it
 * @param surfaceId - Surface whose sheet the point is on; every sheet when unset
 * @returns The surface, the point's surface coordinates and the snapped point, or null
 */
export function findSurfaceAtPoint(template: HomeTemplate, deviceId: DeviceKind, point: HomePoint, snapDistance = 72, surfaceId?: string) {
  const onSurface = surfaceId ? template.surfaces.find(surface => surface.id === surfaceId) : undefined
  const sheet = onSurface && surfaceSheet(template, onSurface)
  const candidates = template.surfaces
    .filter(surface => surface.accepts.includes(deviceId) && (!sheet || surfaceSheet(template, surface) === sheet))
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
    // A drop onto furniture stays turned down rather than snapping through the wall next door.
    if (candidate.distance === 0)
      return null
  }
  return null
}

function sheetOf(template: HomeTemplate, placement: DevicePlacement) {
  const surface = template.surfaces.find(item => item.id === placement.surfaceId)
  return surface ? surfaceSheet(template, surface) : null
}

export function hasPlacementCollision(template: HomeTemplate, placement: DevicePlacement, placements: DevicePlacement[]) {
  const point = placementToWorld(template, placement)
  if (!point)
    return false
  const sheet = sheetOf(template, placement)

  const size = HOME_DEVICES[placement.deviceId]
  const radius = Math.min(size.width, size.height) * 0.34
  return placements.some((other) => {
    if (other.deviceId === placement.deviceId || other.roomId !== placement.roomId || sheetOf(template, other) !== sheet)
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
  surfaceId?: string,
) {
  const match = findSurfaceAtPoint(template, deviceId, point, undefined, surfaceId)
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
        surface.id,
      )
      if (placement?.roomId === roomId)
        return placement
    }
  }
  return null
}

/**
 * Make placements fit the home as it now stands, after its furniture changed
 * or its devices went back to their defaults. Devices on a surface the home
 * no longer has leave it; floor devices a piece of furniture now stands on
 * move to a free spot in the same room, or leave it when there is none.
 *
 * @param template - Home template, furnished
 * @param placements - Device placements
 * @returns The placements, settled
 */
export function settlePlacements(template: HomeTemplate, placements: DevicePlacement[]): DevicePlacement[] {
  const settled = placements.map(placement => ({ ...placement }))
  settled.forEach((placement, index) => {
    if (!placement.surfaceId)
      return
    const surface = template.surfaces.find(item => item.id === placement.surfaceId)
    const unplaced = { ...placement, roomId: null, surfaceId: null, u: 0.5, v: 0.5 }
    if (!surface) {
      settled[index] = unplaced
      return
    }
    if (surface.kind !== 'floor' || !isBlocked(template, surface.roomId, surfacePointToWorld(surface, placement.u, placement.v)))
      return
    const others = settled.filter((_, other) => other !== index)
    settled[index] = createPlacementInRoom(template, placement.deviceId, surface.roomId, others, placement.rotation) ?? unplaced
  })
  return settled
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

function readFurnitureRotation(value: unknown): FurnitureRotation | undefined {
  return value === 0 || value === 90 || value === 180 || value === 270 ? value : undefined
}

function readFurnitureEdit(raw: unknown, template: Pick<HomeTemplate, 'rooms'>): FurnitureEdit | null {
  if (!raw || typeof raw !== 'object')
    return null
  const record = raw as Record<string, unknown>
  if (typeof record.id !== 'string' || !record.id || record.id.length > 80)
    return null
  const id = record.id
  if (record.removed === true && record.kind === undefined)
    return { id, removed: true }
  const x = typeof record.x === 'number' && Number.isFinite(record.x) ? Math.round(record.x * 100) / 100 : undefined
  const z = typeof record.z === 'number' && Number.isFinite(record.z) ? Math.round(record.z * 100) / 100 : undefined
  const rotation = readFurnitureRotation(record.rotation)
  if (x === undefined || z === undefined || rotation === undefined)
    return null
  if (record.kind === undefined)
    return { id, x, z, rotation }
  const roomId = typeof record.roomId === 'string' ? record.roomId : null
  if (!isFurnitureKind(record.kind) || !roomId || !template.rooms.some(room => room.id === roomId))
    return null
  return { id, kind: record.kind, roomId, x, z, rotation }
}

/**
 * Keep the well-formed furniture edits of saved state, the last one per
 * piece. Edits naming pieces the template does not have are left for the
 * layout to ignore, so a template can bring a piece back.
 *
 * @param value - Saved edits
 * @param template - The template they change
 * @returns The edits, oldest first
 */
export function normalizeFurnitureEdits(value: unknown, template: Pick<HomeTemplate, 'rooms'>): FurnitureEdit[] {
  if (!Array.isArray(value))
    return []
  const edits = new Map<string, FurnitureEdit>()
  for (const raw of value) {
    const edit = readFurnitureEdit(raw, template)
    if (!edit)
      continue
    // Map keeps insertion order: a later edit of the same piece moves to the end.
    edits.delete(edit.id)
    edits.set(edit.id, edit)
  }
  return [...edits.values()]
}

/**
 * Surfaces a placement may name: the template's own, and the tabletops of
 * pieces the user added.
 */
function placementSurfaces(template: HomeTemplate, furniture: FurnitureEdit[]): Array<Pick<HomeSurface, 'id' | 'roomId' | 'accepts'>> {
  const added = furniture
    .filter(edit => edit.kind && edit.roomId && FURNITURE_KINDS[edit.kind].top)
    .map(edit => ({ id: `${edit.id}-top`, roomId: edit.roomId!, accepts: ['hand-warmer'] as DeviceKind[] }))
  return [...template.surfaces, ...added]
}

function normalizePlacements(value: unknown, templateId: HomeTemplateId, furniture: FurnitureEdit[]): DevicePlacement[] {
  const surfaces = placementSurfaces(HOME_TEMPLATES[templateId], furniture)
  const fallback = createDefaultHomeState(templateId)
  const rawPlacements = Array.isArray(value) ? value : []
  return HOME_DEVICE_ORDER.map((deviceId) => {
    const raw = rawPlacements.find((item) => {
      return item && typeof item === 'object' && (item as Record<string, unknown>).deviceId === deviceId
    }) as Record<string, unknown> | undefined
    if (!raw)
      return fallback.placements.find(item => item.deviceId === deviceId)!

    const surfaceId = typeof raw.surfaceId === 'string' ? raw.surfaceId : null
    const surface = surfaceId ? surfaces.find(item => item.id === surfaceId && item.accepts.includes(deviceId)) : undefined
    return {
      deviceId,
      roomId: surface?.roomId ?? null,
      surfaceId: surface?.id ?? null,
      u: clamp(readNumber(raw.u, 0.5)),
      v: clamp(readNumber(raw.v, 0.5)),
      rotation: readRotation(raw.rotation),
    }
  })
}

function readTimestamp(value: unknown, fallback: string) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : fallback
}

/** Most layouts a home keeps. */
export const MAX_SAVED_LAYOUTS = 20
/** Longest layout name, in characters. */
export const MAX_LAYOUT_NAME = 24

/**
 * Tidy a layout name: trimmed, one line, not too long.
 *
 * @param value - Name the user typed
 * @returns The name, or null when nothing is left
 */
export function normalizeLayoutName(value: unknown) {
  if (typeof value !== 'string')
    return null
  const name = [...value.replace(/\s+/g, ' ').trim()].slice(0, MAX_LAYOUT_NAME).join('')
  return name || null
}

/**
 * Keep the well-formed saved layouts, newest first.
 *
 * @param value - Saved layouts
 * @returns The layouts
 */
export function normalizeSavedLayouts(value: unknown): SavedHomeLayout[] {
  if (!Array.isArray(value))
    return []
  const layouts: SavedHomeLayout[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object')
      continue
    const record = raw as Record<string, unknown>
    const name = normalizeLayoutName(record.name)
    if (typeof record.id !== 'string' || !record.id || record.id.length > 80 || !name || !isHomeTemplateId(record.templateId) || layouts.some(layout => layout.id === record.id))
      continue
    const furniture = normalizeFurnitureEdits(record.furniture, HOME_TEMPLATES[record.templateId])
    layouts.push({
      id: record.id,
      name,
      templateId: record.templateId,
      placements: normalizePlacements(record.placements, record.templateId, furniture),
      furniture,
      savedAt: readTimestamp(record.savedAt, '1970-01-01T00:00:00.000Z'),
    })
  }
  return layouts.slice(0, MAX_SAVED_LAYOUTS)
}

/**
 * Read saved state, whatever version wrote it. Version 1 had no furniture
 * edits, so it keeps the template's furniture, and no saved layouts.
 */
export function normalizeHomeState(value: unknown): VirtualHomeState {
  if (!value || typeof value !== 'object')
    return createDefaultHomeState()

  const record = value as Record<string, unknown>
  const templateId = isHomeTemplateId(record.templateId) ? record.templateId : 'cloud-apartment'
  const fallback = createDefaultHomeState(templateId)
  const furniture = normalizeFurnitureEdits(record.furniture, HOME_TEMPLATES[templateId])

  return {
    version: 2,
    templateId,
    placements: normalizePlacements(record.placements, templateId, furniture),
    furniture,
    layouts: normalizeSavedLayouts(record.layouts),
    revision: Math.max(0, Math.floor(readNumber(record.revision, 0))),
    changedAt: readTimestamp(record.changedAt, fallback.changedAt),
  }
}
