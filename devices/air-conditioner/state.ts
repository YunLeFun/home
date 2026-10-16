import type { DevicePluginState } from '../types'
import type { AcCapabilities, AirConditionerAction, AirConditionerState } from '~/types'
import type { AcLimits, AcState } from '@yunlefun-home/air-conditioner-core'
import { acReducer, acTone, defaultAcState, normalizeAcState } from '@yunlefun-home/air-conditioner-core'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

/**
 * Translate Home Assistant entity capabilities into core device limits.
 *
 * @param capabilities - Capabilities reported by the bound climate entity
 */
export function capabilitiesToLimits(capabilities: AcCapabilities): AcLimits {
  return {
    min: capabilities.minTemperature,
    max: capabilities.maxTemperature,
    step: capabilities.temperatureStep,
  }
}

// Home has no sound mode; core requires one, so add it on the way in and drop it on the way out.
function toCoreState(state: AirConditionerState): AcState {
  return { ...state, sound: defaultAcState.sound }
}

function fromCoreState(state: AcState): AirConditionerState {
  return { status: state.status, mode: state.mode, temperature: state.temperature }
}

/**
 * Coerce untrusted stored or cloud data into a valid state. Field types are
 * checked here because core trusts its input; clamping is delegated to core.
 *
 * @param value - Stored or remote state
 */
export function normalizeAirConditionerState(value: unknown): AirConditionerState {
  const record = isRecord(value) ? value : {}
  const { temperature } = normalizeAcState({
    temperature: typeof record.temperature === 'number' && Number.isFinite(record.temperature) ? record.temperature : undefined,
  })
  // Keep Home's stored key order stable for existing local and cloud records.
  return {
    status: typeof record.status === 'boolean' ? record.status : false,
    mode: record.mode === 'hot' ? 'hot' : 'cold',
    temperature,
  }
}

/**
 * Apply an action. Bound devices use the entity's limits and keep reported
 * values verbatim; local devices are re-validated first.
 *
 * @param state - Current state
 * @param action - Action to apply
 * @param capabilities - Bound entity capabilities
 */
export function reduceAirConditionerState(state: AirConditionerState, action: AirConditionerAction, capabilities?: AcCapabilities): AirConditionerState {
  if (capabilities)
    return fromCoreState(acReducer(toCoreState(state), action, capabilitiesToLimits(capabilities)))
  return normalizeAirConditionerState(acReducer(toCoreState(normalizeAirConditionerState(state)), action))
}

/**
 * Validate an untrusted action before it reaches the reducer.
 *
 * @param value - Candidate action
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

export const airConditionerState: DevicePluginState<'air-conditioner'> = {
  create: () => normalizeAirConditionerState(defaultAcState),
  normalize: normalizeAirConditionerState,
  reduce: (state, action, _changedAt, capabilities) => reduceAirConditionerState(state, action, capabilities),
  isAction: isAirConditionerAction,
  isActive: state => state.status,
  tone: acTone,
}
