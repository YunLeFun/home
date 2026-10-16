import type { DevicePluginState, DeviceTone } from '../types'
import type { HandWarmerAction, HandWarmerLevel, HandWarmerState } from '~/types'
import { isRecord, isValidTimerMinutes, normalizeDate, normalizeNullableDate, numberInRange, timerDate } from '../state-utils'

export const HAND_WARMER_LEVELS = ['low', 'medium', 'high'] as const satisfies readonly HandWarmerLevel[]

/** Safe target temperature, in °C, for each heat level. */
export const HAND_WARMER_TEMPERATURES: Record<HandWarmerLevel, number> = { low: 38, medium: 42, high: 48 }

function isHandWarmerLevel(value: unknown): value is HandWarmerLevel {
  return HAND_WARMER_LEVELS.includes(value as HandWarmerLevel)
}

/**
 * Create a hand warmer that is off at the medium level.
 *
 * @param changedAt - ISO timestamp of the state change
 * @returns The default hand warmer state
 */
export function createHandWarmerState(changedAt: string): HandWarmerState {
  return {
    power: false,
    level: 'medium',
    temperature: HAND_WARMER_TEMPERATURES.medium,
    autoOffAt: null,
    stateChangedAt: changedAt,
  }
}

/**
 * Coerce an untrusted value into a valid hand warmer state.
 *
 * @param value - Stored or remote state
 * @returns A state with a known level and a temperature clamped to 30–55 °C
 */
export function normalizeHandWarmerState(value: unknown): HandWarmerState {
  if (!isRecord(value))
    return createHandWarmerState(new Date().toISOString())
  return {
    power: typeof value.power === 'boolean' ? value.power : false,
    level: isHandWarmerLevel(value.level) ? value.level : 'medium',
    temperature: numberInRange(value.temperature, HAND_WARMER_TEMPERATURES.medium, 30, 55),
    autoOffAt: normalizeNullableDate(value.autoOffAt),
    stateChangedAt: normalizeDate(value.stateChangedAt),
  }
}

/**
 * Apply an action to a hand warmer state. Picking a level powers it on and
 * moves to that level's safe temperature.
 *
 * @param state - Current state
 * @param action - Action to apply
 * @param now - ISO timestamp of the change
 * @returns The next state
 */
export function reduceHandWarmerState(state: HandWarmerState, action: HandWarmerAction, now: string): HandWarmerState {
  if (action.type === 'toggle')
    return { ...state, power: !state.power, stateChangedAt: now }
  if (action.type === 'set-level')
    return { ...state, power: true, level: action.level, temperature: HAND_WARMER_TEMPERATURES[action.level], stateChangedAt: now }
  return { ...state, autoOffAt: timerDate(action.minutes, now), stateChangedAt: now }
}

/**
 * Validate an untrusted hand warmer action.
 *
 * @param value - Candidate action
 * @returns Whether the value is a well-formed action
 */
export function isHandWarmerAction(value: unknown): value is HandWarmerAction {
  if (!isRecord(value) || typeof value.type !== 'string')
    return false
  return value.type === 'toggle'
    || (value.type === 'set-level' && isHandWarmerLevel(value.level))
    || (value.type === 'set-timer' && isValidTimerMinutes(value.minutes))
}

export function handWarmerTone(state: HandWarmerState): DeviceTone {
  return state.power ? 'warm' : 'idle'
}

export const handWarmerState: DevicePluginState<'hand-warmer'> = {
  create: createHandWarmerState,
  normalize: normalizeHandWarmerState,
  reduce: reduceHandWarmerState,
  isAction: isHandWarmerAction,
  isActive: state => state.power,
  tone: handWarmerTone,
}
