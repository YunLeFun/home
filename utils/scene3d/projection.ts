import type { DevicePlacement, HomePoint, HomeSurface, HomeSurfaceKind, HomeTemplate } from '~/types'
import { surfacePointToWorld } from '~/utils/home'

/**
 * Mapping from the 2D scene (a 1600 × 800 front elevation) to the 3D diorama.
 *
 * The 2D art draws the back wall above a floor line at y = 570 and the floor
 * below it in perspective. The diorama keeps the same layout: x runs along the
 * back wall, wall heights come from how far above the floor line a point sits,
 * and floor depth from how far below it. One unit is roughly 1 m.
 */
export const SCENE3D = {
  /** World units per 2D pixel along the back wall. */
  scaleX: 0.01,
  /** World units per 2D pixel up the back wall. */
  scaleY: 0.006,
  /** 2D y of the line where the back wall meets the floor. */
  floorLine: 570,
  /** 2D y of the front edge of the floor. */
  floorFront: 790,
  /** Depth of the floor from the back wall to the open front. */
  depth: 4.4,
  /** Height of the walls (the top of the 2D shell at y = 30). */
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
 * Horizontal position of a 2D x coordinate, centred on the scene.
 *
 * @param x - 2D x in scene pixels
 * @param width - Width of the 2D scene
 * @returns World x
 */
export function worldX(x: number, width = 1600) {
  return (x - width / 2) * SCENE3D.scaleX
}

/**
 * Height on the back wall of a 2D y coordinate.
 *
 * @param y - 2D y in scene pixels
 * @returns World y, clamped to the wall
 */
export function wallHeight(y: number) {
  return Math.min(SCENE3D.height, Math.max(0, (SCENE3D.floorLine - y) * SCENE3D.scaleY))
}

/**
 * Distance from the back wall of a 2D floor y coordinate.
 *
 * @param y - 2D y in scene pixels
 * @returns World z, clamped to the floor
 */
export function floorDepth(y: number) {
  const ratio = (y - SCENE3D.floorLine) / (SCENE3D.floorFront - SCENE3D.floorLine)
  return Math.min(SCENE3D.depth, Math.max(0, ratio * SCENE3D.depth))
}

/**
 * Project a point on the floor of the 2D scene.
 *
 * @param point - 2D point on a floor surface
 * @param width - Width of the 2D scene
 * @returns The point on the diorama floor
 */
export function projectFloorPoint(point: HomePoint, width = 1600): Vec3 {
  return { x: worldX(point.x, width), y: 0, z: floorDepth(point.y) }
}

/**
 * Project a point on the back wall of the 2D scene.
 *
 * @param point - 2D point on a wall surface
 * @param width - Width of the 2D scene
 * @returns The point just in front of the diorama wall
 */
export function projectWallPoint(point: HomePoint, width = 1600): Vec3 {
  return { x: worldX(point.x, width), y: wallHeight(point.y), z: SCENE3D.wallOffset }
}

/**
 * Project a point given in surface coordinates.
 *
 * Tabletops have no depth in the 2D art, so their height and depth range come
 * from the furniture they belong to.
 *
 * @param surface - The surface the point lies on
 * @param u - Position across the surface, 0 to 1
 * @param v - Position down the surface, 0 to 1
 * @param width - Width of the 2D scene
 * @param tabletop - 3D placement of the surface when it is a tabletop
 * @returns The point in diorama space
 */
export function projectSurfacePoint(surface: HomeSurface, u: number, v: number, width = 1600, tabletop?: TabletopSpec): Vec3 {
  const point = surfacePointToWorld(surface, u, v)
  if (surface.kind === 'wall')
    return projectWallPoint(point, width)
  if (surface.kind === 'floor')
    return projectFloorPoint(point, width)
  const spec = tabletop ?? { height: wallHeight(surface.polygon[0].y), z0: 0.1, z1: 0.6 }
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
