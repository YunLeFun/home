export type DeviceKind = 'air-conditioner' | 'fan' | 'robot-vacuum' | 'hand-warmer' | 'television'

export type DeviceStateSyncStatus = 'local' | 'syncing' | 'synced' | 'unauthorized' | 'error'

export type AirConditionerMode = 'cold' | 'hot'

export interface AirConditionerState {
  status: boolean
  mode: AirConditionerMode
  temperature: number
}

export type AirConditionerAction =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'toggleStatus' }
  | { type: 'status'; status: boolean }
  | { type: 'mode'; mode: AirConditionerMode }
  | { type: 'update'; payload: Partial<AirConditionerState> }

export interface FanState {
  power: boolean
  speed: 1 | 2 | 3
  oscillating: boolean
  autoOffAt: string | null
  stateChangedAt: string
}

export type FanAction =
  | { type: 'toggle' }
  | { type: 'set-speed'; speed: FanState['speed'] }
  | { type: 'toggle-oscillation' }
  | { type: 'set-timer'; minutes: number | null }

export type RobotVacuumStatus = 'docked' | 'cleaning' | 'paused' | 'returning' | 'charging'
export type RobotVacuumMode = 'quiet' | 'standard' | 'turbo'

export interface RobotVacuumState {
  status: RobotVacuumStatus
  mode: RobotVacuumMode
  progress: number
  battery: number
  cleanedArea: number
  stateChangedAt: string
}

export type RobotVacuumAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'return' }
  | { type: 'dock' }
  | { type: 'set-mode'; mode: RobotVacuumMode }

export type HandWarmerLevel = 'low' | 'medium' | 'high'

export interface HandWarmerState {
  power: boolean
  level: HandWarmerLevel
  temperature: number
  autoOffAt: string | null
  stateChangedAt: string
}

export type HandWarmerAction =
  | { type: 'toggle' }
  | { type: 'set-level'; level: HandWarmerLevel }
  | { type: 'set-timer'; minutes: number | null }

export interface TelevisionState {
  power: boolean
  playing: boolean
  volume: number
  muted: boolean
  sourceUrl: string
  stateChangedAt: string
}

export type TelevisionAction =
  | { type: 'toggle-power' }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'set-volume'; volume: number }
  | { type: 'toggle-muted' }
  | { type: 'set-source'; sourceUrl: string }

export interface DeviceStateMap {
  'air-conditioner': AirConditionerState
  'fan': FanState
  'robot-vacuum': RobotVacuumState
  'hand-warmer': HandWarmerState
  'television': TelevisionState
}

export interface DeviceActionMap {
  'air-conditioner': AirConditionerAction
  'fan': FanAction
  'robot-vacuum': RobotVacuumAction
  'hand-warmer': HandWarmerAction
  'television': TelevisionAction
}

export type DeviceRuntimeState = DeviceStateMap[DeviceKind]
export type DeviceRuntimeAction = DeviceActionMap[DeviceKind]
export type DeviceStateByKind<K extends DeviceKind> = DeviceStateMap[K]
export type DeviceActionByKind<K extends DeviceKind> = DeviceActionMap[K]
