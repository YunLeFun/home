import type {
  AirConditionerAction,
  AirConditionerState,
  AcCapabilities,
  DeviceActionByKind,
  DeviceKind,
  DeviceRuntimeAction,
  DeviceStateByKind,
  FanAction,
  FanState,
  HandWarmerAction,
  HandWarmerLevel,
  HandWarmerState,
  RobotVacuumAction,
  RobotVacuumMode,
  RobotVacuumState,
  RobotVacuumStatus,
  TelevisionAction,
  TelevisionState,
} from '~/types'
import { clampAcTemperature } from './home-assistant'

export const DEFAULT_TELEVISION_SOURCE_URL = 'https://media.w3.org/2010/05/sintel/trailer.mp4'

const deviceKinds: DeviceKind[] = ['air-conditioner', 'fan', 'robot-vacuum', 'hand-warmer', 'television']
const minAirConditionerTemperature = 16
const maxAirConditionerTemperature = 31
const defaultAirConditionerState: AirConditionerState = {
  status: false,
  mode: 'cold',
  temperature: 26,
}

export function isDeviceKind(value: unknown): value is DeviceKind {
  return deviceKinds.includes(value as DeviceKind)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function numberInRange(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value === 'number' && Number.isFinite(value))
    return Math.min(max, Math.max(min, value))
  return fallback
}

function normalizeDate(value: unknown, fallback = new Date().toISOString()) {
  if (typeof value === 'string' && Number.isFinite(Date.parse(value)))
    return new Date(value).toISOString()
  return fallback
}

function normalizeNullableDate(value: unknown) {
  if (value === null)
    return null
  return normalizeDate(value, '') || null
}

function isRobotStatus(value: unknown): value is RobotVacuumStatus {
  return value === 'docked' || value === 'cleaning' || value === 'paused' || value === 'returning' || value === 'charging'
}

function isRobotMode(value: unknown): value is RobotVacuumMode {
  return value === 'quiet' || value === 'standard' || value === 'turbo'
}

function isWarmerLevel(value: unknown): value is HandWarmerLevel {
  return value === 'low' || value === 'medium' || value === 'high'
}

export function isTelevisionSourceUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048)
    return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  }
  catch {
    return false
  }
}

function normalizeAirConditionerState(value: unknown): AirConditionerState {
  if (!isRecord(value))
    return { ...defaultAirConditionerState }

  return {
    status: typeof value.status === 'boolean' ? value.status : false,
    mode: value.mode === 'hot' ? 'hot' : 'cold',
    temperature: numberInRange(
      value.temperature,
      defaultAirConditionerState.temperature,
      minAirConditionerTemperature,
      maxAirConditionerTemperature,
    ),
  }
}

export function createDefaultDeviceState<K extends DeviceKind>(kind: K, changedAt = new Date().toISOString()): DeviceStateByKind<K> {
  const states = {
    'air-conditioner': { ...defaultAirConditionerState },
    'fan': {
      power: false,
      speed: 1,
      oscillating: false,
      autoOffAt: null,
      stateChangedAt: changedAt,
    } satisfies FanState,
    'robot-vacuum': {
      status: 'docked',
      mode: 'standard',
      progress: 0,
      battery: 86,
      cleanedArea: 0,
      stateChangedAt: changedAt,
    } satisfies RobotVacuumState,
    'hand-warmer': {
      power: false,
      level: 'medium',
      temperature: 42,
      autoOffAt: null,
      stateChangedAt: changedAt,
    } satisfies HandWarmerState,
    'television': {
      power: false,
      playing: false,
      volume: 45,
      muted: false,
      sourceUrl: DEFAULT_TELEVISION_SOURCE_URL,
      stateChangedAt: changedAt,
    } satisfies TelevisionState,
  }
  return states[kind] as DeviceStateByKind<K>
}

export function normalizeDeviceState<K extends DeviceKind>(kind: K, value: unknown): DeviceStateByKind<K> {
  const fallback = createDefaultDeviceState(kind)
  if (!isRecord(value))
    return fallback

  if (kind === 'air-conditioner')
    return normalizeAirConditionerState(value) as DeviceStateByKind<K>

  if (kind === 'fan') {
    const speed = (value.speed === 2 || value.speed === 3) ? value.speed : 1
    return {
      power: typeof value.power === 'boolean' ? value.power : false,
      speed,
      oscillating: typeof value.oscillating === 'boolean' ? value.oscillating : false,
      autoOffAt: normalizeNullableDate(value.autoOffAt),
      stateChangedAt: normalizeDate(value.stateChangedAt),
    } as DeviceStateByKind<K>
  }

  if (kind === 'robot-vacuum') {
    return {
      status: isRobotStatus(value.status) ? value.status : 'docked',
      mode: isRobotMode(value.mode) ? value.mode : 'standard',
      progress: numberInRange(value.progress, 0, 0, 1),
      battery: numberInRange(value.battery, 86, 0, 100),
      cleanedArea: numberInRange(value.cleanedArea, 0, 0, 999),
      stateChangedAt: normalizeDate(value.stateChangedAt),
    } as DeviceStateByKind<K>
  }

  if (kind === 'television') {
    const power = typeof value.power === 'boolean' ? value.power : false
    return {
      power,
      playing: power && value.playing === true,
      volume: Math.round(numberInRange(value.volume, 45, 0, 100)),
      muted: typeof value.muted === 'boolean' ? value.muted : false,
      sourceUrl: isTelevisionSourceUrl(value.sourceUrl) ? value.sourceUrl : DEFAULT_TELEVISION_SOURCE_URL,
      stateChangedAt: normalizeDate(value.stateChangedAt),
    } as DeviceStateByKind<K>
  }

  return {
    power: typeof value.power === 'boolean' ? value.power : false,
    level: isWarmerLevel(value.level) ? value.level : 'medium',
    temperature: numberInRange(value.temperature, 42, 30, 55),
    autoOffAt: normalizeNullableDate(value.autoOffAt),
    stateChangedAt: normalizeDate(value.stateChangedAt),
  } as DeviceStateByKind<K>
}

function timerDate(minutes: number | null, now: string) {
  return minutes === null ? null : new Date(Date.parse(now) + Math.min(1440, Math.max(0, minutes)) * 60_000).toISOString()
}

function isValidTimerMinutes(value: unknown) {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1440)
}

function reduceAirConditioner(state: AirConditionerState, action: AirConditionerAction, capabilities?: AcCapabilities): AirConditionerState {
  const min = capabilities?.minTemperature ?? minAirConditionerTemperature
  const max = capabilities?.maxTemperature ?? maxAirConditionerTemperature
  const step = capabilities?.temperatureStep ?? 1
  const temperature = (value: number) => capabilities ? clampAcTemperature(value, capabilities) : Math.min(max, Math.max(min, value))
  if (action.type === 'increment')
    return { ...state, temperature: Number(temperature(state.temperature + step).toFixed(4)) }
  if (action.type === 'decrement')
    return { ...state, temperature: Number(temperature(state.temperature - step).toFixed(4)) }
  if (action.type === 'toggleStatus')
    return { ...state, status: !state.status }
  if (action.type === 'status')
    return { ...state, status: action.status }
  if (action.type === 'mode')
    return { ...state, mode: action.mode }
  if (capabilities) {
    const next = { ...state, ...action.payload }
    return { status: next.status, mode: next.mode, temperature: temperature(next.temperature) }
  }
  return normalizeAirConditionerState({ ...state, ...action.payload })
}

function reduceFan(state: FanState, action: FanAction, now: string): FanState {
  if (action.type === 'toggle')
    return { ...state, power: !state.power, stateChangedAt: now }
  if (action.type === 'set-speed')
    return { ...state, power: true, speed: action.speed, stateChangedAt: now }
  if (action.type === 'toggle-oscillation')
    return { ...state, oscillating: !state.oscillating, stateChangedAt: now }
  return { ...state, autoOffAt: timerDate(action.minutes, now), stateChangedAt: now }
}

function reduceRobot(state: RobotVacuumState, action: RobotVacuumAction, now: string): RobotVacuumState {
  if (action.type === 'start' || action.type === 'resume') {
    const shouldReset = action.type === 'start' && state.progress >= 1
    return { ...state, status: 'cleaning', progress: shouldReset ? 0 : state.progress, stateChangedAt: now }
  }
  if (action.type === 'pause')
    return { ...state, status: 'paused', stateChangedAt: now }
  if (action.type === 'return')
    return { ...state, status: 'returning', stateChangedAt: now }
  if (action.type === 'dock')
    return { ...state, status: 'charging', progress: 0, stateChangedAt: now }
  return { ...state, mode: action.mode, stateChangedAt: now }
}

function reduceWarmer(state: HandWarmerState, action: HandWarmerAction, now: string): HandWarmerState {
  if (action.type === 'toggle')
    return { ...state, power: !state.power, stateChangedAt: now }
  if (action.type === 'set-level') {
    const temperatures: Record<HandWarmerLevel, number> = { low: 38, medium: 42, high: 48 }
    return { ...state, power: true, level: action.level, temperature: temperatures[action.level], stateChangedAt: now }
  }
  return { ...state, autoOffAt: timerDate(action.minutes, now), stateChangedAt: now }
}

function reduceTelevision(state: TelevisionState, action: TelevisionAction, now: string): TelevisionState {
  if (action.type === 'toggle-power') {
    const power = !state.power
    return { ...state, power, playing: power ? state.playing : false, stateChangedAt: now }
  }
  if (action.type === 'play')
    return { ...state, power: true, playing: true, stateChangedAt: now }
  if (action.type === 'pause')
    return { ...state, playing: false, stateChangedAt: now }
  if (action.type === 'set-volume')
    return { ...state, volume: Math.round(numberInRange(action.volume, state.volume, 0, 100)), stateChangedAt: now }
  if (action.type === 'toggle-muted')
    return { ...state, muted: !state.muted, stateChangedAt: now }
  return { ...state, power: true, playing: false, sourceUrl: action.sourceUrl, stateChangedAt: now }
}

export function reduceDeviceState<K extends DeviceKind>(
  kind: K,
  state: DeviceStateByKind<K>,
  action: DeviceActionByKind<K>,
  changedAt = new Date().toISOString(),
  capabilities?: AcCapabilities,
): DeviceStateByKind<K> {
  if (kind === 'air-conditioner')
    return reduceAirConditioner(
      capabilities ? state as AirConditionerState : normalizeAirConditionerState(state),
      action as AirConditionerAction,
      capabilities,
    ) as DeviceStateByKind<K>
  if (kind === 'fan')
    return reduceFan(state as FanState, action as FanAction, changedAt) as DeviceStateByKind<K>
  if (kind === 'robot-vacuum')
    return reduceRobot(state as RobotVacuumState, action as RobotVacuumAction, changedAt) as DeviceStateByKind<K>
  if (kind === 'hand-warmer')
    return reduceWarmer(state as HandWarmerState, action as HandWarmerAction, changedAt) as DeviceStateByKind<K>
  return reduceTelevision(state as TelevisionState, action as TelevisionAction, changedAt) as DeviceStateByKind<K>
}

export function isDeviceAction(kind: DeviceKind, value: unknown): value is DeviceRuntimeAction {
  if (!isRecord(value) || typeof value.type !== 'string')
    return false

  if (kind === 'air-conditioner') {
    if (value.type === 'increment' || value.type === 'decrement' || value.type === 'toggleStatus')
      return true
    if (value.type === 'status')
      return typeof value.status === 'boolean'
    if (value.type === 'mode')
      return value.mode === 'cold' || value.mode === 'hot'
    return value.type === 'update' && isRecord(value.payload)
  }
  if (kind === 'fan') {
    return value.type === 'toggle' || value.type === 'toggle-oscillation'
      || (value.type === 'set-speed' && (value.speed === 1 || value.speed === 2 || value.speed === 3))
      || (value.type === 'set-timer' && isValidTimerMinutes(value.minutes))
  }
  if (kind === 'robot-vacuum') {
    return value.type === 'start' || value.type === 'pause' || value.type === 'resume' || value.type === 'return' || value.type === 'dock'
      || (value.type === 'set-mode' && isRobotMode(value.mode))
  }
  if (kind === 'hand-warmer') {
    return value.type === 'toggle'
      || (value.type === 'set-level' && isWarmerLevel(value.level))
      || (value.type === 'set-timer' && isValidTimerMinutes(value.minutes))
  }
  return value.type === 'toggle-power' || value.type === 'play' || value.type === 'pause' || value.type === 'toggle-muted'
    || (value.type === 'set-volume' && typeof value.volume === 'number' && Number.isFinite(value.volume) && value.volume >= 0 && value.volume <= 100)
    || (value.type === 'set-source' && isTelevisionSourceUrl(value.sourceUrl))
}

export function isDeviceState(kind: DeviceKind, value: unknown) {
  if (!isRecord(value))
    return false
  const normalized = normalizeDeviceState(kind, value)
  return JSON.stringify(normalized) === JSON.stringify(value)
}
