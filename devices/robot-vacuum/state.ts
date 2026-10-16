import type { DevicePluginState, DeviceTone } from '../types'
import type { RobotVacuumAction, RobotVacuumMode, RobotVacuumState, RobotVacuumStatus } from '~/types'
import { isRecord, normalizeDate, numberInRange } from '../state-utils'

export const ROBOT_VACUUM_MODES = ['quiet', 'standard', 'turbo'] as const satisfies readonly RobotVacuumMode[]

function isRobotVacuumStatus(value: unknown): value is RobotVacuumStatus {
  return value === 'docked' || value === 'cleaning' || value === 'paused' || value === 'returning' || value === 'charging'
}

function isRobotVacuumMode(value: unknown): value is RobotVacuumMode {
  return ROBOT_VACUUM_MODES.includes(value as RobotVacuumMode)
}

/**
 * Create a docked robot in standard mode.
 *
 * @param changedAt - ISO timestamp of the state change
 * @returns The default robot vacuum state
 */
export function createRobotVacuumState(changedAt: string): RobotVacuumState {
  return {
    status: 'docked',
    mode: 'standard',
    progress: 0,
    battery: 86,
    cleanedArea: 0,
    stateChangedAt: changedAt,
  }
}

/**
 * Coerce an untrusted value into a valid robot vacuum state.
 *
 * @param value - Stored or remote state
 * @returns A state with known status and mode and clamped progress, battery and area
 */
export function normalizeRobotVacuumState(value: unknown): RobotVacuumState {
  if (!isRecord(value))
    return createRobotVacuumState(new Date().toISOString())
  return {
    status: isRobotVacuumStatus(value.status) ? value.status : 'docked',
    mode: isRobotVacuumMode(value.mode) ? value.mode : 'standard',
    progress: numberInRange(value.progress, 0, 0, 1),
    battery: numberInRange(value.battery, 86, 0, 100),
    cleanedArea: numberInRange(value.cleanedArea, 0, 0, 999),
    stateChangedAt: normalizeDate(value.stateChangedAt),
  }
}

/**
 * Apply an action to a robot vacuum state. Route progress is advanced by the
 * runtime; the reducer only records transitions.
 *
 * @param state - Current state
 * @param action - Action to apply
 * @param now - ISO timestamp of the change
 * @returns The next state
 */
export function reduceRobotVacuumState(state: RobotVacuumState, action: RobotVacuumAction, now: string): RobotVacuumState {
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

/**
 * Validate an untrusted robot vacuum action.
 *
 * @param value - Candidate action
 * @returns Whether the value is a well-formed action
 */
export function isRobotVacuumAction(value: unknown): value is RobotVacuumAction {
  if (!isRecord(value) || typeof value.type !== 'string')
    return false
  return value.type === 'start' || value.type === 'pause' || value.type === 'resume' || value.type === 'return' || value.type === 'dock'
    || (value.type === 'set-mode' && isRobotVacuumMode(value.mode))
}

/** @returns Whether the robot is moving through the home */
export function isRobotVacuumActive(state: RobotVacuumState): boolean {
  return state.status === 'cleaning' || state.status === 'returning'
}

export function robotVacuumTone(state: RobotVacuumState): DeviceTone {
  return isRobotVacuumActive(state) ? 'active' : 'idle'
}

export const robotVacuumState: DevicePluginState<'robot-vacuum'> = {
  create: createRobotVacuumState,
  normalize: normalizeRobotVacuumState,
  reduce: reduceRobotVacuumState,
  isAction: isRobotVacuumAction,
  isActive: isRobotVacuumActive,
  tone: robotVacuumTone,
}
