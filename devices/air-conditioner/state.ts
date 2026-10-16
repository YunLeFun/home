import type { DevicePluginState, DeviceTone } from '../types'
import type { AcCapabilities, AirConditionerAction, AirConditionerState } from '~/types'
import { clampAcTemperature } from '~/utils/home-assistant'

export const MIN_AC_TEMPERATURE = 16
export const MAX_AC_TEMPERATURE = 31

const DEFAULT_AC_STATE: AirConditionerState = {
  status: false,
  mode: 'cold',
  temperature: 26,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

/**
 * Coerce an untrusted value into a valid air-conditioner state.
 *
 * @param value - Stored or remote state
 * @returns A state with a boolean power flag, known mode and clamped temperature
 */
export function normalizeAirConditionerState(value: unknown): AirConditionerState {
  if (!isRecord(value))
    return { ...DEFAULT_AC_STATE }
  const temperature = typeof value.temperature === 'number' && Number.isFinite(value.temperature)
    ? Math.min(MAX_AC_TEMPERATURE, Math.max(MIN_AC_TEMPERATURE, value.temperature))
    : DEFAULT_AC_STATE.temperature
  return {
    status: typeof value.status === 'boolean' ? value.status : false,
    mode: value.mode === 'hot' ? 'hot' : 'cold',
    temperature,
  }
}

/**
 * Apply an action to an air-conditioner state.
 *
 * @param state - Current state
 * @param action - Action to apply
 * @param capabilities - Bound entity limits; local devices use the default range
 * @returns The next state
 */
export function reduceAirConditionerState(state: AirConditionerState, action: AirConditionerAction, capabilities?: AcCapabilities): AirConditionerState {
  // Bound devices keep HA-reported values verbatim; local ones are re-validated.
  const current = capabilities ? state : normalizeAirConditionerState(state)
  const min = capabilities?.minTemperature ?? MIN_AC_TEMPERATURE
  const max = capabilities?.maxTemperature ?? MAX_AC_TEMPERATURE
  const step = capabilities?.temperatureStep ?? 1
  const temperature = (value: number) => capabilities ? clampAcTemperature(value, capabilities) : Math.min(max, Math.max(min, value))
  if (action.type === 'increment')
    return { ...current, temperature: Number(temperature(current.temperature + step).toFixed(4)) }
  if (action.type === 'decrement')
    return { ...current, temperature: Number(temperature(current.temperature - step).toFixed(4)) }
  if (action.type === 'toggleStatus')
    return { ...current, status: !current.status }
  if (action.type === 'status')
    return { ...current, status: action.status }
  if (action.type === 'mode')
    return { ...current, mode: action.mode }
  if (capabilities) {
    const next = { ...current, ...action.payload }
    return { status: next.status, mode: next.mode, temperature: temperature(next.temperature) }
  }
  return normalizeAirConditionerState({ ...current, ...action.payload })
}

/**
 * Validate an untrusted air-conditioner action.
 *
 * @param value - Candidate action
 * @returns Whether the value is a well-formed action
 */
export function isAirConditionerAction(value: unknown): value is AirConditionerAction {
  if (!isRecord(value) || typeof value.type !== 'string')
    return false
  if (value.type === 'increment' || value.type === 'decrement' || value.type === 'toggleStatus')
    return true
  if (value.type === 'status')
    return typeof value.status === 'boolean'
  if (value.type === 'mode')
    return value.mode === 'cold' || value.mode === 'hot'
  return value.type === 'update' && isRecord(value.payload)
}

/**
 * Map a state to the shell's visual tone.
 *
 * @param state - Current state
 * @returns `cool` or `heat` while running, otherwise `idle`
 */
export function airConditionerTone(state: AirConditionerState): DeviceTone {
  if (!state.status)
    return 'idle'
  return state.mode === 'hot' ? 'heat' : 'cool'
}

export const airConditionerState: DevicePluginState<'air-conditioner'> = {
  create: () => ({ ...DEFAULT_AC_STATE }),
  normalize: normalizeAirConditionerState,
  reduce: (state, action, _changedAt, capabilities) => reduceAirConditionerState(state, action, capabilities),
  isAction: isAirConditionerAction,
  isActive: state => state.status,
  tone: airConditionerTone,
}
