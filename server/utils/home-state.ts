import type { HomeStateLoadResponse, HomeStateSyncResponse, VirtualHomeState } from '~/types'
import { hasHomeRevisionConflict, normalizeHomeState } from '~/utils/home'
import type { CloudBaseCollection } from './cloudbase-database'
import { getCloudBaseDatabase, isCloudBaseServerConfigured } from './cloudbase-database'

interface StoredHomeRecord {
  _id?: string
  ownerId: string
  state: VirtualHomeState
  createdAt: number
  updatedAt: number
}

const memoryHomes = new Map<string, StoredHomeRecord>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function readString(value: unknown) {
  if (typeof value === 'string' && value.length > 0)
    return value
  return undefined
}

function readBoolean(value: unknown) {
  return value === true || value === 'true'
}

function getConfig() {
  const config = useRuntimeConfig()
  const collection = typeof config.cloudbaseHomeLayoutsCollection === 'string'
    ? config.cloudbaseHomeLayoutsCollection
    : ''
  return {
    allowMemoryFallback: readBoolean(config.cloudbaseAllowMemoryFallback),
    collection: collection || 'home_layouts',
  }
}

function canUseCloudBase() {
  return isCloudBaseServerConfigured()
}

function assertStorageAvailable() {
  if (canUseCloudBase() || getConfig().allowMemoryFallback)
    return

  throw createError({
    statusCode: 503,
    statusMessage: 'CloudBase home persistence is not configured',
  })
}

function toRecord(value: unknown): StoredHomeRecord | null {
  if (!isRecord(value) || !isRecord(value.state))
    return null
  const ownerId = readString(value.ownerId)
  if (!ownerId)
    return null
  return {
    _id: readString(value._id),
    ownerId,
    state: normalizeHomeState(value.state),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : Date.now(),
  }
}

export function parseHomeState(value: unknown) {
  if (!isRecord(value))
    throw createError({ statusCode: 400, statusMessage: 'Invalid home state payload' })
  return normalizeHomeState(value)
}

async function findCloudRecord(ownerId: string, collection: CloudBaseCollection) {
  const { data } = await collection.where({ ownerId }).limit(1).get()
  return Array.isArray(data) ? toRecord(data[0]) : null
}

export async function loadHomeState(ownerId: string): Promise<HomeStateLoadResponse> {
  if (canUseCloudBase()) {
    const database = await getCloudBaseDatabase()
    const record = await findCloudRecord(ownerId, database.collection(getConfig().collection))
    return record
      ? { found: true, backend: 'cloudbase', state: record.state }
      : { found: false, backend: 'cloudbase' }
  }
  assertStorageAvailable()
  const record = memoryHomes.get(ownerId)
  return record
    ? { found: true, backend: 'memory', state: record.state }
    : { found: false, backend: 'memory' }
}

function assertRevision(current: StoredHomeRecord | null, requested: VirtualHomeState) {
  if (hasHomeRevisionConflict(current?.state ?? null, requested)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Home state revision conflict',
      data: current?.state ?? null,
    })
  }
}

export async function saveHomeState(ownerId: string, requested: VirtualHomeState): Promise<HomeStateSyncResponse> {
  const now = Date.now()
  if (canUseCloudBase()) {
    const database = await getCloudBaseDatabase()
    const collectionName = getConfig().collection
    return await database.runTransaction(async (transaction) => {
      const collection = transaction.collection(collectionName)
      const current = await findCloudRecord(ownerId, collection)
      assertRevision(current, requested)
      const state: VirtualHomeState = {
        ...requested,
        revision: (current?.state.revision ?? 0) + 1,
        changedAt: new Date().toISOString(),
      }
      const cloudRecord = { _openid: ownerId, ownerId, state, updatedAt: now }
      if (current?._id)
        await collection.doc(current._id).update(cloudRecord)
      else
        await collection.add({ ...cloudRecord, createdAt: now })

      return { synced: true, backend: 'cloudbase', state }
    })
  }

  assertStorageAvailable()
  const current = memoryHomes.get(ownerId) ?? null
  assertRevision(current, requested)
  const state: VirtualHomeState = {
    ...requested,
    revision: (current?.state.revision ?? 0) + 1,
    changedAt: new Date().toISOString(),
  }
  memoryHomes.set(ownerId, {
    ownerId,
    state,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  })
  return { synced: true, backend: 'memory', state }
}
