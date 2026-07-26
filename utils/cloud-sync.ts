export const CLOUD_SYNC_EPOCH = '1970-01-01T00:00:00.000Z'

export type CloudSyncDirection = 'push' | 'pull' | 'noop'

export interface LocalSyncSnapshot<T> {
  version: 1
  state: T
  changedAt: string
}

export function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeSyncTimestamp(value: unknown, fallback = CLOUD_SYNC_EPOCH) {
  if (typeof value !== 'string')
    return fallback

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback
}

export function selectCloudSyncDirection(localChangedAt: string, remoteChangedAt: string | null): CloudSyncDirection {
  if (!remoteChangedAt)
    return 'push'

  const localTimestamp = Date.parse(normalizeSyncTimestamp(localChangedAt))
  const remoteTimestamp = Date.parse(normalizeSyncTimestamp(remoteChangedAt))
  if (localTimestamp > remoteTimestamp)
    return 'push'
  if (remoteTimestamp > localTimestamp)
    return 'pull'
  return 'noop'
}

export function parseLocalSyncSnapshot(value: unknown): LocalSyncSnapshot<unknown> {
  if (isUnknownRecord(value) && value.version === 1 && 'state' in value) {
    return {
      version: 1,
      state: value.state,
      changedAt: normalizeSyncTimestamp(value.changedAt),
    }
  }

  return {
    version: 1,
    state: value,
    changedAt: CLOUD_SYNC_EPOCH,
  }
}

export function createLocalSyncSnapshot<T>(state: T, changedAt: string): LocalSyncSnapshot<T> {
  return {
    version: 1,
    state,
    changedAt: normalizeSyncTimestamp(changedAt),
  }
}
