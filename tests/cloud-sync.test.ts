import { describe, expect, it } from 'vitest'
import {
  CLOUD_SYNC_EPOCH,
  createLocalSyncSnapshot,
  normalizeSyncTimestamp,
  parseLocalSyncSnapshot,
  selectCloudSyncDirection,
} from '~/utils/cloud-sync'

describe('cloud synchronization timestamps', () => {
  it('selects the newest side and treats equal timestamps as settled', () => {
    const earlier = '2026-07-26T08:00:00.000Z'
    const later = '2026-07-26T08:01:00.000Z'

    expect(selectCloudSyncDirection(later, earlier)).toBe('push')
    expect(selectCloudSyncDirection(earlier, later)).toBe('pull')
    expect(selectCloudSyncDirection(later, later)).toBe('noop')
    expect(selectCloudSyncDirection(earlier, null)).toBe('push')
  })

  it('normalizes invalid timestamps to the migration epoch', () => {
    expect(normalizeSyncTimestamp('not-a-date')).toBe(CLOUD_SYNC_EPOCH)
    expect(normalizeSyncTimestamp(null)).toBe(CLOUD_SYNC_EPOCH)
  })
})

describe('local synchronization snapshots', () => {
  it('migrates legacy raw state without making it newer than cloud data', () => {
    const legacy = { power: true }

    expect(parseLocalSyncSnapshot(legacy)).toEqual({
      version: 1,
      state: legacy,
      changedAt: CLOUD_SYNC_EPOCH,
    })
  })

  it('round-trips versioned state with its change timestamp', () => {
    const changedAt = '2026-07-26T08:01:00.000Z'
    const snapshot = createLocalSyncSnapshot({ volume: 42 }, changedAt)

    expect(parseLocalSyncSnapshot(snapshot)).toEqual(snapshot)
  })
})
