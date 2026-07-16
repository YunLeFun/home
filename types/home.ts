import type { DeviceKind } from './device'

export type HomeTemplateId = 'cloud-apartment' | 'studio' | 'comfort-suite'
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
  polygon: [HomePoint, HomePoint, HomePoint, HomePoint]
  accepts: DeviceKind[]
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

export interface HomeTemplate {
  id: HomeTemplateId
  name: string
  description: string
  width: number
  height: number
  rooms: HomeRoom[]
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

export type HomeSyncStatus = 'local' | 'syncing' | 'synced' | 'unauthorized' | 'conflict' | 'error'
export type HomeSyncBackend = 'cloudbase' | 'memory'

export interface HomeStateLoadResponse {
  found: boolean
  backend: HomeSyncBackend
  state?: VirtualHomeState
}

export interface HomeStateSyncResponse {
  synced: boolean
  backend: HomeSyncBackend
  state: VirtualHomeState
}
