import type {
  DeviceKind,
  DeviceRuntimeAction,
  DeviceRuntimeState,
  DeviceStateChange,
  DeviceStateLoadResponse,
  DeviceStateSyncResponse,
} from '~/types'
import { isDeviceAction, isDeviceKind, normalizeDeviceState } from '~/utils/device'
import type { CloudBaseCollection } from './cloudbase-database'
import { getCloudBaseDatabase, isCloudBaseServerConfigured } from './cloudbase-database'

interface StoredDeviceRecord {
  _id?: string
  ownerId: string
  deviceId: string
  kind: DeviceKind
  state: DeviceRuntimeState
  action?: DeviceRuntimeAction | null
  changedAt: string
  createdAt: number
  updatedAt: number
}

const memoryDeviceStates = new Map<string, StoredDeviceRecord>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function readString(value: unknown) {
  if (typeof value === 'string' && value.length > 0)
    return value
  return undefined
}

function readNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value))
    return value
  return undefined
}

function readChangedAt(value: unknown) {
  const raw = readString(value)
  if (raw && Number.isFinite(Date.parse(raw)))
    return new Date(raw).toISOString()
  return new Date().toISOString()
}

function getMemoryKey(ownerId: string, deviceId: string) {
  return `${ownerId}:${deviceId}`
}

function getStringConfigValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function getBooleanConfigValue(value: unknown) {
  return value === true || value === 'true'
}

function getCloudBaseStorageConfig() {
  const config = useRuntimeConfig()
  return {
    allowMemoryFallback: getBooleanConfigValue(config.cloudbaseAllowMemoryFallback),
    collection: getStringConfigValue(config.cloudbaseDeviceStatesCollection) || 'home_device_states',
  }
}

function canUseCloudBaseStorage() {
  return isCloudBaseServerConfigured()
}

function assertStorageAvailable() {
  if (canUseCloudBaseStorage() || getCloudBaseStorageConfig().allowMemoryFallback)
    return

  throw createError({
    statusCode: 503,
    statusMessage: 'CloudBase device persistence is not configured',
  })
}

async function getCloudBaseCollection(): Promise<CloudBaseCollection> {
  return (await getCloudBaseDatabase()).collection(getCloudBaseStorageConfig().collection)
}

function toStoredRecord(value: unknown): StoredDeviceRecord | null {
  if (!isRecord(value))
    return null
  const ownerId = readString(value.ownerId)
  const deviceId = readString(value.deviceId)
  const changedAt = readString(value.changedAt)
  const createdAt = readNumber(value.createdAt)
  const updatedAt = readNumber(value.updatedAt)
  if (!ownerId || !deviceId || !isDeviceKind(value.kind) || !isRecord(value.state) || !changedAt || createdAt === undefined || updatedAt === undefined)
    return null
  return {
    _id: readString(value._id),
    ownerId,
    deviceId,
    kind: value.kind,
    state: normalizeDeviceState(value.kind, value.state),
    action: isDeviceAction(value.kind, value.action) ? value.action : null,
    changedAt,
    createdAt,
    updatedAt,
  }
}

export function parseDeviceStateChange(value: unknown, routeDeviceId: string): DeviceStateChange {
  if (!isRecord(value))
    throw createError({ statusCode: 400, statusMessage: 'Invalid device state payload' })
  const bodyDeviceId = readString(value.deviceId)
  if (bodyDeviceId && bodyDeviceId !== routeDeviceId)
    throw createError({ statusCode: 400, statusMessage: 'Device id mismatch' })
  if (!isDeviceKind(value.kind) || !isRecord(value.state))
    throw createError({ statusCode: 400, statusMessage: 'Invalid device state payload' })
  if (value.action !== undefined && !isDeviceAction(value.kind, value.action))
    throw createError({ statusCode: 400, statusMessage: 'Invalid device action payload' })
  return {
    deviceId: routeDeviceId,
    kind: value.kind,
    state: normalizeDeviceState(value.kind, value.state),
    action: value.action as DeviceRuntimeAction | undefined,
    changedAt: readChangedAt(value.changedAt),
  }
}

export async function saveDeviceState(ownerId: string, change: DeviceStateChange): Promise<DeviceStateSyncResponse> {
  const now = Date.now()
  const record: StoredDeviceRecord = {
    ownerId,
    deviceId: change.deviceId,
    kind: change.kind,
    state: change.state,
    action: change.action ?? null,
    changedAt: change.changedAt,
    createdAt: now,
    updatedAt: now,
  }
  if (canUseCloudBaseStorage()) {
    const database = await getCloudBaseDatabase()
    const collectionName = getCloudBaseStorageConfig().collection
    return await database.runTransaction(async (transaction) => {
      const collection = transaction.collection(collectionName)
      const { data } = await collection.where({ ownerId, deviceId: change.deviceId }).limit(1).get()
      const existing = Array.isArray(data) ? toStoredRecord(data[0]) : null
      const cloudRecord = {
        _openid: ownerId,
        ownerId,
        deviceId: change.deviceId,
        kind: change.kind,
        state: change.state,
        action: change.action ?? null,
        changedAt: change.changedAt,
        updatedAt: now,
      }
      if (existing?._id)
        await collection.doc(existing._id).update(cloudRecord)
      else
        await collection.add({ ...cloudRecord, createdAt: now })

      return { synced: true, deviceId: change.deviceId, changedAt: change.changedAt, backend: 'cloudbase' }
    })
  }

  assertStorageAvailable()
  const key = getMemoryKey(ownerId, change.deviceId)
  const previous = memoryDeviceStates.get(key)
  memoryDeviceStates.set(key, { ...record, createdAt: previous?.createdAt ?? now })
  return { synced: true, deviceId: change.deviceId, changedAt: change.changedAt, backend: 'memory' }
}

export async function loadDeviceState(ownerId: string, deviceId: string): Promise<DeviceStateLoadResponse> {
  if (canUseCloudBaseStorage()) {
    const collection = await getCloudBaseCollection()
    const { data } = await collection.where({ ownerId, deviceId }).limit(1).get()
    const record = Array.isArray(data) ? toStoredRecord(data[0]) : null
    return record
      ? { found: true, deviceId, kind: record.kind, changedAt: record.changedAt, state: record.state, backend: 'cloudbase' }
      : { found: false, deviceId, backend: 'cloudbase' }
  }
  assertStorageAvailable()
  const record = memoryDeviceStates.get(getMemoryKey(ownerId, deviceId))
  return record
    ? { found: true, deviceId, kind: record.kind, changedAt: record.changedAt, state: record.state, backend: 'memory' }
    : { found: false, deviceId, backend: 'memory' }
}
