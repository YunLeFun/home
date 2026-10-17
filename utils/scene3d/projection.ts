import type { DeviceKind, DevicePlacement, HomePoint, HomeSurface, HomeSurfaceKind, HomeTemplate } from '~/types'
import { clamp, getPolygonBounds, pointInPolygon, surfacePointToWorld } from '~/utils/home'

/**
 * Mapping from the home plan to the 3D diorama.
 *
 * Templates and placements are laid out on a plan: a 1600 × 800 front
 * elevation with the back wall above a floor line at y = 570 and the floor
 * below it in perspective. The diorama keeps the same layout: x runs along the
 * back wall, wall heights come from how far above the floor line a point sits,
 * and floor depth from how far below it. One unit is roughly 1 m.
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

/** A point in diorama space: x along the wall, y up, z out of the wall. */
export interface Vec3 {
  x: number
  y: number
  z: number
}

/** Where a tabletop surface sits in 3D: its height and depth range. */
export interface TabletopSpec {
  height: number
  z0: number
  z1: number
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
 * Project a point on the floor of the plan.
 *
 * @param point - Plan point on a floor surface
 * @param width - Width of the plan
 * @returns The point on the diorama floor
 */
export function projectFloorPoint(point: HomePoint, width = 1600): Vec3 {
  return { x: worldX(point.x, width), y: 0, z: floorDepth(point.y) }
}

/**
 * Project a point on the back wall of the plan.
 *
 * @param point - Plan point on a wall surface
 * @param width - Width of the plan
 * @returns The point just in front of the diorama wall
 */
export function projectWallPoint(point: HomePoint, width = 1600): Vec3 {
  return { x: worldX(point.x, width), y: wallHeight(point.y), z: SCENE3D.wallOffset }
}

/**
 * Project a point given in surface coordinates.
 *
 * Tabletops have no depth on the plan, so their height and depth range come
 * from the furniture they belong to.
 *
 * @param surface - The surface the point lies on
 * @param u - Position across the surface, 0 to 1
 * @param v - Position down the surface, 0 to 1
 * @param width - Width of the plan
 * @param tabletop - 3D placement of the surface when it is a tabletop
 * @returns The point in diorama space
 */
export function projectSurfacePoint(surface: HomeSurface, u: number, v: number, width = 1600, tabletop?: TabletopSpec): Vec3 {
  const point = surfacePointToWorld(surface, u, v)
  if (surface.kind === 'wall')
    return projectWallPoint(point, width)
  if (surface.kind === 'floor')
    return projectFloorPoint(point, width)
  const spec = tabletopFor(surface, tabletop)
  return { x: worldX(point.x, width), y: spec.height, z: spec.z0 + (spec.z1 - spec.z0) * v }
}

/** A device placement resolved to diorama space. */
export interface ProjectedPlacement {
  placement: DevicePlacement
  surfaceKind: HomeSurfaceKind
  position: Vec3
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
  return {
    placement,
    surfaceKind: surface.kind,
    position: projectSurfacePoint(surface, placement.u, placement.v, template.width, tabletops[surface.id]),
  }
}

/**
 * Horizontal extent of a room in the diorama.
 *
 * @param template - Home template
 * @param roomId - Room to measure, or null for the whole home
 * @returns The room's left and right edges in world x
 */
export function roomExtent(template: HomeTemplate, roomId: string | null): { x0: number, x1: number } {
  const room = roomId ? template.rooms.find(item => item.id === roomId) : undefined
  if (!room)
    return { x0: worldX(0, template.width), x1: worldX(template.width, template.width) }
  return { x0: worldX(room.x, template.width), x1: worldX(room.x + room.width, template.width) }
}

/**
 * Find the room containing a world x coordinate.
 *
 * @param template - Home template
 * @param x - World x
 * @returns The id of the room, or null outside the home
 */
export function roomAtWorldX(template: HomeTemplate, x: number): string | null {
  const px = x / SCENE3D.scaleX + template.width / 2
  return template.rooms.find(room => px >= room.x && px <= room.x + room.width)?.id ?? null
}

/**
 * Plan x coordinate of a world x, the inverse of {@link worldX}.
 *
 * @param x - World x
 * @param width - Width of the plan
 * @returns Plan x
 */
export function sceneX(x: number, width = 1600) {
  return x / SCENE3D.scaleX + width / 2
}

function tabletopFor(surface: HomeSurface, tabletop?: TabletopSpec): TabletopSpec {
  return tabletop ?? { height: wallHeight(surface.polygon[0].y), z0: 0.1, z1: 0.6 }
}

/**
 * The plan point of a diorama point on a surface's plane, the inverse of
 * {@link projectSurfacePoint}. Points off the surface are not clamped, so the
 * placement rules can still snap them or turn them down.
 *
 * @param surface - Surface whose plane the point lies on
 * @param position - Point in diorama space
 * @param width - Width of the plan
 * @param tabletop - 3D placement of the surface when it is a tabletop
 * @returns The point on the plan
 */
export function unprojectSurfacePoint(surface: HomeSurface, position: Vec3, width = 1600, tabletop?: TabletopSpec): HomePoint {
  const x = sceneX(position.x, width)
  if (surface.kind === 'wall')
    return { x, y: SCENE3D.floorLine - position.y / SCENE3D.scaleY }
  if (surface.kind === 'floor')
    return { x, y: SCENE3D.floorLine + position.z / SCENE3D.depth * (SCENE3D.floorFront - SCENE3D.floorLine) }
  const spec = tabletopFor(surface, tabletop)
  const bounds = getPolygonBounds(surface.polygon)
  const v = (position.z - spec.z0) / (spec.z1 - spec.z0)
  return { x, y: bounds.minY + v * (bounds.maxY - bounds.minY) }
}

/**
 * Corners of a surface in diorama space, for drawing it.
 *
 * @param surface - The surface
 * @param width - Width of the plan
 * @param tabletop - 3D placement of the surface when it is a tabletop
 * @returns Top left, top right, bottom right and bottom left corners
 */
export function surfaceCorners(surface: HomeSurface, width = 1600, tabletop?: TabletopSpec): Vec3[] {
  return ([[0, 0], [1, 0], [1, 1], [0, 1]] as const).map(([u, v]) => projectSurfacePoint(surface, u, v, width, tabletop))
}

/** A ray in diorama space, such as one cast from the camera through the pointer. */
export interface Ray3 {
  origin: Vec3
  direction: Vec3
}

/**
 * Where a ray meets the plane a surface lies on.
 *
 * @param surface - The surface
 * @param ray - The ray
 * @param tabletop - 3D placement of the surface when it is a tabletop
 * @returns The hit and its distance along the ray, or null when the ray misses the plane
 */
export function intersectSurfacePlane(surface: HomeSurface, ray: Ray3, tabletop?: TabletopSpec): { position: Vec3, distance: number } | null {
  const vertical = surface.kind === 'wall'
  const level = surface.kind === 'wall' ? SCENE3D.wallOffset : surface.kind === 'floor' ? 0 : tabletopFor(surface, tabletop).height
  const along = vertical ? ray.direction.z : ray.direction.y
  if (Math.abs(along) < 1e-6)
    return null
  const distance = (level - (vertical ? ray.origin.z : ray.origin.y)) / along
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

/** A surface a ray points at, with the matching plan point. */
export interface SurfaceRayHit {
  surface: HomeSurface
  /** Point on the plan, for the placement rules. */
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
 * closest one, which the placement rules may still snap to.
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
    const hit = intersectSurfacePlane(surface, ray, tabletops[surface.id])
    if (!hit)
      continue
    const point = unprojectSurfacePoint(surface, hit.position, template.width, tabletops[surface.id])
    const bounds = getPolygonBounds(surface.polygon)
    const gap = pointInPolygon(point, surface.polygon)
      ? 0
      : Math.hypot(point.x - clamp(point.x, bounds.minX, bounds.maxX), point.y - clamp(point.y, bounds.minY, bounds.maxY))
    if (!best || gap < best.gap || (gap === best.gap && hit.distance < best.distance))
      best = { surface, point, position: hit.position, gap, distance: hit.distance }
  }
  return best && { surface: best.surface, point: best.point, position: best.position }
}
