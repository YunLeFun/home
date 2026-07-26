import type { CloudBaseSharedSession } from '~/types'
import { isUnknownRecord, normalizeSyncTimestamp } from '~/utils/cloud-sync'

export interface CloudSyncRecord<T> {
  id: string
  state: T
  changedAt: string
}

interface CloudRecordOptions {
  collection: string
  keyField: 'deviceId' | 'slot'
  keyValue: string
}

interface CloudRecordDocument {
  _id?: unknown
  changedAt?: unknown
  state?: unknown
}

class CloudSyncUnauthorizedError extends Error {
  statusCode = 401

  constructor(message = '登录 YunLe 后即可同步到云端') {
    super(message)
    this.name = 'CloudSyncUnauthorizedError'
  }
}

function getSessionOwnerId(session: CloudBaseSharedSession | null) {
  const userId = session?.user?.id
  if (!userId)
    throw new CloudSyncUnauthorizedError()
  return userId
}

function assertCloudBaseResult(result: unknown) {
  if (!isUnknownRecord(result))
    throw new Error('CloudBase 返回了无法识别的结果')

  if (typeof result.code === 'string' && result.code) {
    const message = typeof result.message === 'string' ? result.message : result.code
    throw new Error(message)
  }
}

function toCloudSyncRecord<T>(value: unknown): CloudSyncRecord<T> | null {
  if (!isUnknownRecord(value))
    return null

  const document = value as CloudRecordDocument
  if (typeof document._id !== 'string' || !('state' in document))
    return null

  return {
    id: document._id,
    state: document.state as T,
    changedAt: normalizeSyncTimestamp(document.changedAt),
  }
}

export function isCloudSyncUnauthorizedError(error: unknown) {
  return error instanceof CloudSyncUnauthorizedError
    || (isUnknownRecord(error) && error.statusCode === 401)
}

export function useCloudSync() {
  const cloudbase = useCloudBaseClient()

  async function getContext() {
    let sessionResult = await cloudbase.getSharedSession()
    if (!sessionResult.session) {
      await useYunleSession().refresh()
      sessionResult = await cloudbase.getSharedSession()
    }

    const ownerId = getSessionOwnerId(sessionResult.session)
    const database = await cloudbase.getDatabase()
    if (!database)
      throw new Error('CloudBase 客户端尚未配置')

    return { database, ownerId }
  }

  async function readRecord<T>(options: CloudRecordOptions): Promise<CloudSyncRecord<T> | null> {
    const { database, ownerId } = await getContext()
    const result = await database
      .collection(options.collection)
      .where({
        _openid: ownerId,
        [options.keyField]: options.keyValue,
      })
      .limit(1)
      .get()

    assertCloudBaseResult(result)
    const data = isUnknownRecord(result) && Array.isArray(result.data) ? result.data : []
    return toCloudSyncRecord<T>(data[0])
  }

  async function updateRecord<T>(
    id: string,
    options: CloudRecordOptions,
    state: T,
    changedAt: string,
  ): Promise<CloudSyncRecord<T> | null> {
    const { database, ownerId } = await getContext()
    const result = await database
      .collection(options.collection)
      .where({
        _id: id,
        _openid: ownerId,
        [options.keyField]: options.keyValue,
        changedAtMs: database.command.lte(Date.parse(changedAt)),
      })
      .update({
        version: 1,
        [options.keyField]: options.keyValue,
        state,
        changedAt,
        changedAtMs: Date.parse(changedAt),
        updatedAt: new Date().toISOString(),
      })
    assertCloudBaseResult(result)
    if (isUnknownRecord(result) && result.updated === 1)
      return null

    const winningRecord = await readRecord<T>(options)
    if (!winningRecord)
      throw new Error('云端记录已变更，请重试')
    return winningRecord
  }

  async function addRecord<T>(options: CloudRecordOptions, state: T, changedAt: string) {
    const { database } = await getContext()
    const result = await database.collection(options.collection).add({
      version: 1,
      [options.keyField]: options.keyValue,
      state,
      changedAt,
      changedAtMs: Date.parse(changedAt),
      updatedAt: new Date().toISOString(),
    })
    assertCloudBaseResult(result)
  }

  async function writeRecord<T>(
    options: CloudRecordOptions,
    state: T,
    changedAt: string,
    current?: CloudSyncRecord<T> | null,
  ): Promise<CloudSyncRecord<T> | null> {
    const normalizedChangedAt = normalizeSyncTimestamp(changedAt)
    const existing = current === undefined ? await readRecord<T>(options) : current
    if (existing) {
      return await updateRecord(existing.id, options, state, normalizedChangedAt)
    }

    try {
      await addRecord(options, state, normalizedChangedAt)
      return null
    }
    catch (error) {
      const racedRecord = await readRecord<T>(options)
      if (!racedRecord)
        throw error
      return await updateRecord(racedRecord.id, options, state, normalizedChangedAt)
    }
  }

  return {
    readRecord,
    writeRecord,
  }
}
