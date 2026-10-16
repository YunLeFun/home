import type { DevicePluginState, DeviceTone } from '../types'
import type { FanAction, FanState } from '~/types'
import { isRecord, isValidTimerMinutes, normalizeDate, normalizeNullableDate, timerDate } from '../state-utils'

/**
 * Create a fan that is off at speed 1.
 *
 * @param changedAt - ISO timestamp of the state change
 * @returns The default fan state
 */
export function createFanState(changedAt: string): FanState {
  return {
    power: false,
    speed: 1,
    oscillating: false,
    autoOffAt: null,
    stateChangedAt: changedAt,
  }
}

/**
 * Coerce an untrusted value into a valid fan state.
 *
 * @param value - Stored or remote state
 * @returns A state with a known speed and normalized timestamps
 */
export function normalizeFanState(value: unknown): FanState {
  if (!isRecord(value))
    return createFanState(new Date().toISOString())
  return {
    power: typeof value.power === 'boolean' ? value.power : false,
    speed: (value.speed === 2 || value.speed === 3) ? value.speed : 1,
    oscillating: typeof value.oscillating === 'boolean' ? value.oscillating : false,
    autoOffAt: normalizeNullableDate(value.autoOffAt),
    stateChangedAt: normalizeDate(value.stateChangedAt),
  }
}

/**
 * Apply an action to a fan state. Picking a speed also powers the fan on.
 *
 * @param state - Current state
 * @param action - Action to apply
 * @param now - ISO timestamp of the change
 * @returns The next state
 */
export function reduceFanState(state: FanState, action: FanAction, now: string): FanState {
  if (action.type === 'toggle')
    return { ...state, power: !state.power, stateChangedAt: now }
  if (action.type === 'set-speed')
    return { ...state, power: true, speed: action.speed, stateChangedAt: now }
  if (action.type === 'toggle-oscillation')
    return { ...state, oscillating: !state.oscillating, stateChangedAt: now }
  return { ...state, autoOffAt: timerDate(action.minutes, now), stateChangedAt: now }
}

/**
 * Validate an untrusted fan action.
 *
 * @param value - Candidate action
 * @returns Whether the value is a well-formed action
 */
export function isFanAction(value: unknown): value is FanAction {
  if (!isRecord(value) || typeof value.type !== 'string')
    return false
  return value.type === 'toggle' || value.type === 'toggle-oscillation'
    || (value.type === 'set-speed' && (value.speed === 1 || value.speed === 2 || value.speed === 3))
    || (value.type === 'set-timer' && isValidTimerMinutes(value.minutes))
}

export function fanTone(state: FanState): DeviceTone {
  return state.power ? 'active' : 'idle'
}

export const fanState: DevicePluginState<'fan'> = {
  create: createFanState,
  normalize: normalizeFanState,
  reduce: reduceFanState,
  isAction: isFanAction,
  isActive: state => state.power,
  tone: fanTone,
}
