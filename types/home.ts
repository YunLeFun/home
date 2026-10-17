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
  obstacles: HomeObstacle[]
  robotRoutes: HomeRobotRoute[]
}

export interface DevicePlacement {
  deviceId: DeviceKind
  roomId: string | null
  surfaceId: string | null
  u: number
  v: number
  rotation: DeviceRotation
}

export interface VirtualHomeState {
  version: 1
  templateId: HomeTemplateId
  placements: DevicePlacement[]
  revision: number
  changedAt: string
}

export type HomeSyncStatus = 'local' | 'syncing' | 'synced' | 'unauthorized' | 'error'
