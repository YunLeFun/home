import type { DeviceKind, DevicePlacement, HomePoint, HomeSurface, HomeSurfaceKind, HomeTemplate } from '~/types'
import { clamp, getPolygonBounds, pointInPolygon, surfacePointToWorld } from '~/utils/home'

/**
 * Mapping from the home plan to the 3D diorama.
 *
 * Elevation templates are laid out on a 1600 × 800 front elevation with the
 * back wall above a floor line at y = 570 and the floor below it in
 * perspective. The diorama keeps the same layout: x runs along the back wall,
 * wall heights come from how far above the floor line a point sits, and floor
 * depth from how far below it. One unit is roughly 1 m.
 *
 * Plan templates are a top-down floor plan in centimetres, north up: plan x
 * runs east and plan y south, towards the viewer. Walls stand where the plan
 * draws them.
 *
 * Either way each surface maps from its sheet to the diorama by a flat
 * {@link SurfaceFrame}, which placement, picking and drawing all share.
 */
export const SCENE3D = {
  /** World units per plan unit along the back wall. */
  scaleX: 0.01,
  /** World units per plan unit up the back wall. */
  scaleY: 0.006,
  /** Plan y of the line where the back wall meets the floor. */
  floorLine: 570,
  /** Plan y of the front edge of the floor. */
  floorFront: 790,
  /** Depth of the floor from the back wall to the open front. */
  depth: 4.4,
  /** Height of the walls (plan y = 30). */
  height: 3.24,
  /** Wall-mounted devices stand this far off the wall. */
  wallOffset: 0.04,
} as const

/** Floor plan templates: centimetres on the plan, metres in the diorama. */
export const PLAN3D = {
  /** World units per plan unit. */
  scale: 0.01,
  /** Height of the full walls, up to the ceiling. */
  height: 2.6,
  /** Height of the walls cut away so the camera sees into the rooms. */
  cutHeight: 0.9,
  /** Thickness of the walls; plans draw their centre lines. */
  wall: 0.12,
  /** Wall sheets measure down from the top of a full wall, in plan units. */
  wallTop: 260,
} as const

/** A point in diorama space: x along the wall, y up, z out of the wall. */
export interface Vec3 {
  x: number
  y: number
  z: number
}

/**
 * Where a tabletop surface sits in 3D: its height and, on an elevation, its
 * depth range. Plans draw the tabletop's footprint, so they need no depth.
 */
export interface TabletopSpec {
  height: number
  z0?: number
  z1?: number
}

/**
 * Horizontal position of a plan x coordinate, centred on the scene.
 *
 * @param x - Plan x
 * @param width - Width of the plan
 * @returns World x
 */
export function worldX(x: number, width = 1600) {
  return (x - width / 2) * SCENE3D.scaleX
}

/**
 * Height on the back wall of a plan y coordinate.
 *
 * @param y - Plan y
 * @returns World y, clamped to the wall
 */
export function wallHeight(y: number) {
  return Math.min(SCENE3D.height, Math.max(0, (SCENE3D.floorLine - y) * SCENE3D.scaleY))
}

/**
 * Distance from the back wall of a plan floor y coordinate.
 *
 * @param y - Plan y
 * @returns World z, clamped to the floor
 */
export function floorDepth(y: number) {
  const ratio = (y - SCENE3D.floorLine) / (SCENE3D.floorFront - SCENE3D.floorLine)
  return Math.min(SCENE3D.depth, Math.max(0, ratio * SCENE3D.depth))
}

/**
 * World x of a plan template's x coordinate, centred on the scene.
 *
 * @param x - Plan x, in centimetres from the west edge
 * @param width - Width of the plan
 * @returns World x
 */
export function planX(x: number, width: number) {
  return (x - width / 2) * PLAN3D.scale
}

/**
 * World z of a plan template's y coordinate, centred on the scene.
 *
 * @param y - Plan y, in centimetres from the north edge
 * @param height - Depth of the plan
 * @returns World z, growing towards the viewer
 */
export function planZ(y: number, height: number) {
  return (y - height / 2) * PLAN3D.scale
}

/**
 * Whether a template is a floor plan rather than an elevation.
 *
 * @param template - Home template
 * @returns True for floor plans
 */
export function isPlan(template: HomeTemplate) {
  return template.layout === 'plan'
}

/**
 * Project a point on the floor of the plan, such as a robot route.
 *
 * @param template - Home template
 * @param point - Plan point on the floor
 * @returns The point on the diorama floor
 */
export function projectFloorPoint(template: HomeTemplate, point: HomePoint): Vec3 {
  if (isPlan(template))
    return { x: planX(point.x, template.width), y: 0, z: planZ(point.y, template.height) }
  return { x: worldX(point.x, template.width), y: 0, z: floorDepth(point.y) }
}

/**
 * How a surface's sheet lies in the diorama: a sheet point (x, y) lands at
 * origin + x · axisX + y · axisY. The axes are perpendicular, and the normal
 * points out of the surface, into the room or up.
 */
export interface SurfaceFrame {
  origin: Vec3
  axisX: Vec3
  axisY: Vec3
  normal: Vec3
}

const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z })
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z

function elevationFrame(template: HomeTemplate, surface: HomeSurface, tabletop?: TabletopSpec): SurfaceFrame {
  const left = worldX(0, template.width)
  const axisX = vec(SCENE3D.scaleX, 0, 0)
  if (surface.kind === 'wall')
    return { origin: vec(left, SCENE3D.floorLine * SCENE3D.scaleY, SCENE3D.wallOffset), axisX, axisY: vec(0, -SCENE3D.scaleY, 0), normal: vec(0, 0, 1) }
  if (surface.kind === 'floor') {
    const k = SCENE3D.depth / (SCENE3D.floorFront - SCENE3D.floorLine)
    return { origin: vec(left, 0, -SCENE3D.floorLine * k), axisX, axisY: vec(0, 0, k), normal: vec(0, 1, 0) }
  }
  // Tabletops have no depth on an elevation: their rows spread over the furniture's depth.
  const spec = tabletop ?? { height: wallHeight(surface.polygon[0].y) }
  const z0 = spec.z0 ?? 0.1
  const z1 = spec.z1 ?? 0.6
  const bounds = getPolygonBounds(surface.polygon)
  const k = (z1 - z0) / Math.max(1e-6, bounds.maxY - bounds.minY)
  return { origin: vec(left, spec.height, z0 - bounds.minY * k), axisX, axisY: vec(0, 0, k), normal: vec(0, 1, 0) }
}

function planFrame(template: HomeTemplate, surface: HomeSurface, tabletop?: TabletopSpec): SurfaceFrame {
  const { scale } = PLAN3D
  const corner = (point: HomePoint, y = 0) => vec(planX(point.x, template.width), y, planZ(point.y, template.height))
  if (surface.kind !== 'wall' || !surface.run) {
    const height = surface.kind === 'tabletop' ? tabletop?.height ?? 0.5 : 0
    return { origin: corner({ x: 0, y: 0 }, height), axisX: vec(scale, 0, 0), axisY: vec(0, 0, scale), normal: vec(0, 1, 0) }
  }
  const [from, to] = surface.run
  const length = Math.max(1e-6, Math.hypot(to.x - from.x, to.y - from.y))
  const along = { x: (to.x - from.x) / length, y: (to.y - from.y) / length }
  // The wall faces its room.
  const room = template.rooms.find(item => item.id === surface.roomId)
  const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
  const towards = room ? { x: room.x + room.width / 2 - middle.x, y: room.y + room.height / 2 - middle.y } : { x: 0, y: 1 }
  const side = -along.y * towards.x + along.x * towards.y >= 0 ? 1 : -1
  const normal = vec(-along.y * side, 0, along.x * side)
  const offset = PLAN3D.wall / 2 + SCENE3D.wallOffset
  const start = corner(from, PLAN3D.height)
  return {
    origin: vec(start.x + normal.x * offset, start.y, start.z + normal.z * offset),
    axisX: vec(along.x * scale, 0, along.y * scale),
    axisY: vec(0, -scale, 0),
    normal,
  }
}

/**
 * How a surface's sheet lies in the diorama.
 *
 * @param template - Home template the surface belongs to
 * @param surface - The surface
 * @param tabletop - 3D placement of the surface when it is a tabletop
 * @returns The surface's frame
 */
export function surfaceFrame(template: HomeTemplate, surface: HomeSurface, tabletop?: TabletopSpec): SurfaceFrame {
  return isPlan(template) ? planFrame(template, surface, tabletop) : elevationFrame(template, surface, tabletop)
}

function onFrame(frame: SurfaceFrame, point: HomePoint): Vec3 {
  const { origin, axisX, axisY } = frame
  return vec(
    origin.x + axisX.x * point.x + axisY.x * point.y,
    origin.y + axisX.y * point.x + axisY.y * point.y,
    origin.z + axisX.z * point.x + axisY.z * point.y,
  )
}

/**
 * Project a point given in surface coordinates.
 *
 * @param template - Home template the surface belongs to
 * @param surface - The surface the point lies on
 * @param u - Position across the surface, 0 to 1
 * @param v - Position down the surface, 0 to 1
 * @param tabletop - 3D placement of the surface when it is a tabletop
 * @returns The point in diorama space
 */
export function projectSurfacePoint(template: HomeTemplate, surface: HomeSurface, u: number, v: number, tabletop?: TabletopSpec): Vec3 {
  return onFrame(surfaceFrame(template, surface, tabletop), surfacePointToWorld(surface, u, v))
}

/** A device placement resolved to diorama space. */
export interface ProjectedPlacement {
  placement: DevicePlacement
  surfaceKind: HomeSurfaceKind
  position: Vec3
  /** Out of the surface: the way a wall device faces. */
  normal: Vec3
}

/**
 * Resolve a placement to its position in the diorama.
 *
 * @param template - Home template the placement belongs to
 * @param placement - Device placement
 * @param tabletops - 3D specs of the template's tabletop surfaces by id
 * @returns The projected placement, or null when the device is not placed
 */
export function projectPlacement(template: HomeTemplate, placement: DevicePlacement, tabletops: Record<string, TabletopSpec> = {}): ProjectedPlacement | null {
  const surface = template.surfaces.find(item => item.id === placement.surfaceId)
  if (!surface)
    return null
  const frame = surfaceFrame(template, surface, tabletops[surface.id])
  return {
    placement,
    surfaceKind: surface.kind,
    position: onFrame(frame, surfacePointToWorld(surface, placement.u, placement.v)),
    normal: frame.normal,
  }
}

/** An area of the diorama floor, in world x and z. */
export interface FloorBounds {
  x0: number
  x1: number
  z0: number
  z1: number
}

/**
 * The floor area of a room in the diorama.
 *
 * @param template - Home template
 * @param roomId - Room to measure, or null for the whole home
 * @returns The room's west, east, north and south edges in world x and z
 */
export function roomBounds(template: HomeTemplate, roomId: string | null): FloorBounds {
  const room = roomId ? template.rooms.find(item => item.id === roomId) : undefined
  if (isPlan(template)) {
    const area = room ?? { x: 0, y: 0, width: template.width, height: template.height }
    return {
      x0: planX(area.x, template.width),
      x1: planX(area.x + area.width, template.width),
      z0: planZ(area.y, template.height),
      z1: planZ(area.y + area.height, template.height),
    }
  }
  const x0 = room ? room.x : 0
  const x1 = room ? room.x + room.width : template.width
  return { x0: worldX(x0, template.width), x1: worldX(x1, template.width), z0: 0, z1: SCENE3D.depth }
}

/**
 * Find the room a point of the diorama falls in.
 *
 * @param template - Home template
 * @param position - Point in diorama space
 * @returns The id of the room, or null outside every room
 */
export function roomAt(template: HomeTemplate, position: Vec3): string | null {
  if (isPlan(template)) {
    const x = position.x / PLAN3D.scale + template.width / 2
    const y = position.z / PLAN3D.scale + template.height / 2
    return template.rooms.find(room => x >= room.x && x <= room.x + room.width && y >= room.y && y <= room.y + room.height)?.id ?? null
  }
  const x = position.x / SCENE3D.scaleX + template.width / 2
  return template.rooms.find(room => x >= room.x && x <= room.x + room.width)?.id ?? null
}

/**
 * The sheet point of a diorama point on a surface's plane, the inverse of
 * {@link projectSurfacePoint}. Points off the surface are not clamped, so the
 * placement rules can still snap them or turn them down.
 *
 * @param template - Home template the surface belongs to
 * @param surface - Surface whose plane the point lies on
 * @param position - Point in diorama space
 * @param tabletop - 3D placement of the surface when it is a tabletop
 * @returns The point on the surface's sheet
 */
export function unprojectSurfacePoint(template: HomeTemplate, surface: HomeSurface, position: Vec3, tabletop?: TabletopSpec): HomePoint {
  const { origin, axisX, axisY } = surfaceFrame(template, surface, tabletop)
  const offset = vec(position.x - origin.x, position.y - origin.y, position.z - origin.z)
  return { x: dot(offset, axisX) / dot(axisX, axisX), y: dot(offset, axisY) / dot(axisY, axisY) }
}

/**
 * Corners of a surface in diorama space, for drawing it.
 *
 * @param template - Home template the surface belongs to
 * @param surface - The surface
 * @param tabletop - 3D placement of the surface when it is a tabletop
 * @returns Top left, top right, bottom right and bottom left corners
 */
export function surfaceCorners(template: HomeTemplate, surface: HomeSurface, tabletop?: TabletopSpec): Vec3[] {
  return ([[0, 0], [1, 0], [1, 1], [0, 1]] as const).map(([u, v]) => projectSurfacePoint(template, surface, u, v, tabletop))
}

/** A ray in diorama space, such as one cast from the camera through the pointer. */
export interface Ray3 {
  origin: Vec3
  direction: Vec3
}

/**
 * Where a ray meets the plane a surface lies on.
 *
 * @param template - Home template the surface belongs to
 * @param surface - The surface
 * @param ray - The ray
 * @param tabletop - 3D placement of the surface when it is a tabletop
 * @returns The hit and its distance along the ray, or null when the ray misses the plane
 */
export function intersectSurfacePlane(template: HomeTemplate, surface: HomeSurface, ray: Ray3, tabletop?: TabletopSpec): { position: Vec3, distance: number } | null {
  const { origin, normal } = surfaceFrame(template, surface, tabletop)
  const along = dot(ray.direction, normal)
  if (Math.abs(along) < 1e-6)
    return null
  const distance = dot(vec(origin.x - ray.origin.x, origin.y - ray.origin.y, origin.z - ray.origin.z), normal) / along
  if (distance <= 0)
    return null
  return {
    distance,
    position: {
      x: ray.origin.x + ray.direction.x * distance,
      y: ray.origin.y + ray.direction.y * distance,
      z: ray.origin.z + ray.direction.z * distance,
    },
  }
}

/** A surface a ray points at, with the matching sheet point. */
export interface SurfaceRayHit {
  surface: HomeSurface
  /** Point on the surface's sheet, for the placement rules. */
  point: HomePoint
  /** Where the ray meets the surface's plane. */
  position: Vec3
}

/**
 * Find the surface a device is being dragged onto.
 *
 * Only surfaces that accept the device count. The ray is met with each
 * surface's plane rather than the furniture in front of it, so a sofa does
 * not hide the floor. A surface the ray lands inside wins; otherwise the
 * closest one, which the placement rules may still snap to. On a plan, a
 * wall the ray meets from behind does not count.
 *
 * @param template - Home template
 * @param deviceId - Device being placed
 * @param ray - Ray from the camera through the pointer
 * @param tabletops - 3D specs of the template's tabletop surfaces by id
 * @returns The best surface, or null when the ray meets none of their planes
 */
export function findSurfaceAlongRay(template: HomeTemplate, deviceId: DeviceKind, ray: Ray3, tabletops: Record<string, TabletopSpec> = {}): SurfaceRayHit | null {
  let best: (SurfaceRayHit & { gap: number, distance: number }) | null = null
  for (const surface of template.surfaces) {
    if (!surface.accepts.includes(deviceId))
      continue
    const tabletop = tabletops[surface.id]
    if (isPlan(template) && dot(ray.direction, surfaceFrame(template, surface, tabletop).normal) > 0)
      continue
    const hit = intersectSurfacePlane(template, surface, ray, tabletop)
    if (!hit)
      continue
    const point = unprojectSurfacePoint(template, surface, hit.position, tabletop)
    const bounds = getPolygonBounds(surface.polygon)
    const gap = pointInPolygon(point, surface.polygon)
      ? 0
      : Math.hypot(point.x - clamp(point.x, bounds.minX, bounds.maxX), point.y - clamp(point.y, bounds.minY, bounds.maxY))
    if (!best || gap < best.gap || (gap === best.gap && hit.distance < best.distance))
      best = { surface, point, position: hit.position, gap, distance: hit.distance }
  }
  return best && { surface: best.surface, point: best.point, position: best.position }
}
