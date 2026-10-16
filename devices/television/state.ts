import type { DevicePluginState, DeviceTone } from '../types'
import type { TelevisionAction, TelevisionState } from '~/types'
import { isRecord, normalizeDate, numberInRange } from '../state-utils'

export const DEFAULT_TELEVISION_SOURCE_URL = 'https://media.w3.org/2010/05/sintel/trailer.mp4'

/**
 * Whether a value is a playable source the television may load: an HTTPS URL
 * of at most 2048 characters without embedded credentials.
 *
 * @param value - Candidate source URL
 * @returns Whether the value is a safe source URL
 */
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

/**
 * Create a television that is off with the default trailer loaded.
 *
 * @param changedAt - ISO timestamp of the state change
 * @returns The default television state
 */
export function createTelevisionState(changedAt: string): TelevisionState {
  return {
    power: false,
    playing: false,
    volume: 45,
    muted: false,
    sourceUrl: DEFAULT_TELEVISION_SOURCE_URL,
    stateChangedAt: changedAt,
  }
}

/**
 * Coerce an untrusted value into a valid television state. A powered-off
 * television never reports playback.
 *
 * @param value - Stored or remote state
 * @returns A state with an integer volume and a safe source URL
 */
export function normalizeTelevisionState(value: unknown): TelevisionState {
  if (!isRecord(value))
    return createTelevisionState(new Date().toISOString())
  const power = typeof value.power === 'boolean' ? value.power : false
  return {
    power,
    playing: power && value.playing === true,
    volume: Math.round(numberInRange(value.volume, 45, 0, 100)),
    muted: typeof value.muted === 'boolean' ? value.muted : false,
    sourceUrl: isTelevisionSourceUrl(value.sourceUrl) ? value.sourceUrl : DEFAULT_TELEVISION_SOURCE_URL,
    stateChangedAt: normalizeDate(value.stateChangedAt),
  }
}

/**
 * Apply an action to a television state.
 *
 * @param state - Current state
 * @param action - Action to apply
 * @param now - ISO timestamp of the change
 * @returns The next state
 */
export function reduceTelevisionState(state: TelevisionState, action: TelevisionAction, now: string): TelevisionState {
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

/**
 * Validate an untrusted television action.
 *
 * @param value - Candidate action
 * @returns Whether the value is a well-formed action
 */
export function isTelevisionAction(value: unknown): value is TelevisionAction {
  if (!isRecord(value) || typeof value.type !== 'string')
    return false
  return value.type === 'toggle-power' || value.type === 'play' || value.type === 'pause' || value.type === 'toggle-muted'
    || (value.type === 'set-volume' && typeof value.volume === 'number' && Number.isFinite(value.volume) && value.volume >= 0 && value.volume <= 100)
    || (value.type === 'set-source' && isTelevisionSourceUrl(value.sourceUrl))
}

export function televisionTone(state: TelevisionState): DeviceTone {
  return state.power ? 'active' : 'idle'
}

export const televisionState: DevicePluginState<'television'> = {
  create: createTelevisionState,
  normalize: normalizeTelevisionState,
  reduce: reduceTelevisionState,
  isAction: isTelevisionAction,
  isActive: state => state.power,
  tone: televisionTone,
}
