import type {
  AcCapabilities,
  DeviceActionByKind,
  DeviceKind,
  DeviceRuntimeAction,
  DeviceStateByKind,
} from '~/types'
import type { DevicePlugin, DeviceTone } from '~/devices/types'
import { getDevicePlugin } from '~/devices/registry'
import { isRecord } from '~/devices/state-utils'

const deviceKinds: DeviceKind[] = ['air-conditioner', 'fan', 'robot-vacuum', 'hand-warmer', 'television']

export function isDeviceKind(value: unknown): value is DeviceKind {
  return deviceKinds.includes(value as DeviceKind)
}

// Every device kind is owned by a plugin; a missing one is an install bug.
function requirePlugin<K extends DeviceKind>(kind: K): DevicePlugin<K> {
  const plugin = getDevicePlugin(kind)
  if (!plugin)
    throw new Error(`Device plugin "${kind}" is not installed`)
  return plugin
}

export function createDefaultDeviceState<K extends DeviceKind>(kind: K, changedAt = new Date().toISOString()): DeviceStateByKind<K> {
  return requirePlugin(kind).state.create(changedAt)
}

export function normalizeDeviceState<K extends DeviceKind>(kind: K, value: unknown): DeviceStateByKind<K> {
  return requirePlugin(kind).state.normalize(value)
}

export function reduceDeviceState<K extends DeviceKind>(
  kind: K,
  state: DeviceStateByKind<K>,
  action: DeviceActionByKind<K>,
  changedAt = new Date().toISOString(),
  capabilities?: AcCapabilities,
): DeviceStateByKind<K> {
  return requirePlugin(kind).state.reduce(state, action, changedAt, capabilities)
}

export function isDeviceAction(kind: DeviceKind, value: unknown): value is DeviceRuntimeAction {
  return requirePlugin(kind).state.isAction(value)
}

export function isDeviceState(kind: DeviceKind, value: unknown) {
  if (!isRecord(value))
    return false
  const normalized = normalizeDeviceState(kind, value)
  return JSON.stringify(normalized) === JSON.stringify(value)
}

/**
 * Whether a device is doing work and should animate in the scene.
 *
 * @param kind - Device kind
 * @param state - Current runtime state
 * @returns `true` while the device is running
 */
export function isDeviceRunning<K extends DeviceKind>(kind: K, state: DeviceStateByKind<K>): boolean {
  return requirePlugin(kind).state.isActive(state)
}

/**
 * Visual tone the shell uses to tint halos, airflow and backdrops.
 *
 * @param kind - Device kind
 * @param state - Current runtime state
 * @returns The tone for the current state
 */
export function getDeviceTone<K extends DeviceKind>(kind: K, state: DeviceStateByKind<K>): DeviceTone {
  return requirePlugin(kind).state.tone(state)
}
