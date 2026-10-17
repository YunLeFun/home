import type { DeviceKind } from './device'

export type HomeTemplateId = 'cloud-apartment' | 'studio' | 'comfort-suite' | 'my-home'
export type HomeSurfaceKind = 'wall' | 'floor' | 'tabletop'
export type DeviceRotation = 0 | 90 | 180 | 270

export interface HomePoint {
  x: number
  y: number
}

export interface HomeRoom {
  id: string
  name: string
  shortName: string
  x: number
  y: number
  width: number
  height: number
}

export interface HomeSurface {
  id: string
  roomId: string
  name: string
  kind: HomeSurfaceKind
  /**
   * Corners in the surface's sheet: top left, top right, bottom right, bottom
   * left. Elevation templates draw every surface on one shared sheet. Plan
   * templates draw floors and tabletops on the floor plan, and each wall on
   * its own sheet: x along the wall from the start of its run, y down from
   * the top of the wall.
   */
  polygon: [HomePoint, HomePoint, HomePoint, HomePoint]
  accepts: DeviceKind[]
  /** Plan templates only: where a wall runs on the floor plan, start to end. */
  run?: [HomePoint, HomePoint]
}

/** A point on a surface's sheet, such as where the pointer meets a surface. */
export interface SurfaceTarget {
  surfaceId: string
  point: HomePoint
}

export interface HomeObstacle {
  id: string
  roomId: string
  polygon: HomePoint[]
}

export interface HomeRobotRoute {
  roomId: string
  points: HomePoint[]
}

/**
 * How a template is drawn. An elevation is a front view of rooms in a row
 * along one back wall; a plan is a top-down floor plan in centimetres, north
 * up.
 */
export type HomeLayout = 'elevation' | 'plan'

export interface HomeTemplate {
  id: HomeTemplateId
  name: string
  description: string
  /** Elevation when unset. */
  layout?: HomeLayout
  width: number
  height: number
  rooms: HomeRoom[]
  /** Room to open first; the first room when unset. */
  defaultRoomId?: string
  surfaces: HomeSurface[]
  /**
   * Footprints of the furniture on the floor, where floor devices cannot go.
   * Derived from the furniture by `resolveHomeLayout`; templates leave it out.
   */
  obstacles?: HomeObstacle[]
  robotRoutes: HomeRobotRoute[]
}

/** Furniture the diorama can build. */
export type FurnitureKind =
  | 'sofa'
  | 'coffee-table'
  | 'console'
  | 'table-lamp'
  | 'floor-lamp'
  | 'pendant'
  | 'plant'
  | 'rug'
  | 'bed'
  | 'nightstand'
  | 'shelf'
  | 'laundry'
  | 'basket'
  | 'desk'
  | 'clock'
  | 'window'
  | 'moon-gate'
  | 'counter'
  | 'fridge'
  | 'dining-table'
  | 'vanity'
  | 'toilet'
  | 'bay-seat'

/** A quarter turn about the vertical, in degrees. */
export type FurnitureRotation = 0 | 90 | 180 | 270

/**
 * A change the user made to the template's furniture. Moved and turned
 * pieces keep the template's id; removed ones are marked; added ones carry
 * their kind and room. Positions are in diorama metres, like the template's
 * furniture.
 */
export interface FurnitureEdit {
  id: string
  /** Added pieces: what to build. */
  kind?: FurnitureKind
  /** Added pieces: the room they stand in. */
  roomId?: string
  x?: number
  z?: number
  rotation?: FurnitureRotation
  /** A template piece taken out of the home. */
  removed?: true
}

export interface DevicePlacement {
  deviceId: DeviceKind
  roomId: string | null
  surfaceId: string | null
  u: number
  v: number
  rotation: DeviceRotation
}

/** A layout the user saved under a name, to come back to. */
export interface SavedHomeLayout {
  id: string
  name: string
  templateId: HomeTemplateId
  placements: DevicePlacement[]
  furniture: FurnitureEdit[]
  savedAt: string
}

export interface VirtualHomeState {
  version: 2
  templateId: HomeTemplateId
  placements: DevicePlacement[]
  /** Changes to the template's furniture, oldest first. */
  furniture: FurnitureEdit[]
  /** Layouts saved under a name, newest first. */
  layouts: SavedHomeLayout[]
  revision: number
  changedAt: string
}

export type HomeSyncStatus = 'local' | 'syncing' | 'synced' | 'unauthorized' | 'error'
