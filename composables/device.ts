import { computed, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import type {
  DeviceActionByKind,
  DeviceKind,
  DeviceStateByKind,
  DeviceStateSyncStatus,
} from '~/types'
import {
  CLOUD_SYNC_EPOCH,
  createLocalSyncSnapshot,
  parseLocalSyncSnapshot,
  selectCloudSyncDirection,
} from '~/utils/cloud-sync'
import { createDefaultDeviceState, normalizeDeviceState, reduceDeviceState } from '~/utils/device'

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error)
    return String((error as { message?: unknown }).message)
  return '设备状态同步失败'
}

function getDeviceStorageKey(kind: DeviceKind, deviceId: string) {
  return kind === 'air-conditioner'
    ? `yun-home:device:${deviceId}:ac`
    : `yun-home:device:${deviceId}:${kind}`
}

export function useDeviceState<K extends DeviceKind>(kind: K, deviceId: string = kind) {
  const config = useRuntimeConfig()
  const cloudbase = useCloudBaseClient()
  const cloudSync = useCloudSync()
  const key = `${kind}:${deviceId}`
  const state = useState<DeviceStateByKind<K>>(`device-state:${key}`, () => createDefaultDeviceState(kind))
  const changedAt = useState(`device-changed-at:${key}`, () => CLOUD_SYNC_EPOCH)
  const hydrated = useState(`device-hydrated:${key}`, () => false)
  const syncStatus = useState<DeviceStateSyncStatus>(`device-sync:${key}`, () => 'local')
  const syncError = useState<string | null>(`device-error:${key}`, () => null)
  const lastSyncedAt = useState<string | null>(`device-synced-at:${key}`, () => null)
  const widgetRevision = useState(`device-widget-revision:${key}`, () => 0)
  const storageKey = getDeviceStorageKey(kind, deviceId)
  const collection = computed(() => String(config.public.cloudbaseDeviceStatesCollection || 'home_device_states'))
  const syncEnabled = computed(() => config.public.deviceSyncEnabled === true && cloudbase.isConfigured.value)
  const widgetKey = computed(() => `${storageKey}:${widgetRevision.value}`)
  const clock = shallowRef(Date.now())
  let clockTimer: ReturnType<typeof setInterval> | undefined
  let syncTimer: ReturnType<typeof setTimeout> | undefined

  const visualProgress = computed(() => {
    if (kind !== 'robot-vacuum')
      return 0
    const robot = state.value as DeviceStateByKind<'robot-vacuum'>
    if (robot.status !== 'cleaning')
      return robot.progress
    const elapsed = Math.max(0, clock.value - Date.parse(robot.stateChangedAt))
    return (robot.progress + elapsed / 30_000) % 1
  })

  function getRecordOptions() {
    return {
      collection: collection.value,
      keyField: 'deviceId' as const,
      keyValue: deviceId,
    }
  }

  function setUnauthorized(error: unknown) {
    syncStatus.value = isCloudSyncUnauthorizedError(error) ? 'unauthorized' : 'error'
    syncError.value = isCloudSyncUnauthorizedError(error)
      ? '登录 YunLe 后即可同步到云端'
      : getErrorMessage(error)
  }

  async function reconcileCloudState() {
    if (!syncEnabled.value || !hydrated.value)
      return

    syncStatus.value = 'syncing'
    syncError.value = null
    try {
      const remote = await cloudSync.readRecord<DeviceStateByKind<K>>(getRecordOptions())
      const direction = selectCloudSyncDirection(changedAt.value, remote?.changedAt ?? null)

      if (direction === 'pull' && remote) {
        state.value = normalizeDeviceState(kind, remote.state)
        changedAt.value = remote.changedAt
        widgetRevision.value += 1
      }
      else if (direction === 'push') {
        const winningRemote = await cloudSync.writeRecord(getRecordOptions(), state.value, changedAt.value, remote)
        if (winningRemote && selectCloudSyncDirection(changedAt.value, winningRemote.changedAt) === 'pull') {
          state.value = normalizeDeviceState(kind, winningRemote.state)
          changedAt.value = winningRemote.changedAt
          widgetRevision.value += 1
        }
      }

      lastSyncedAt.value = changedAt.value
      syncStatus.value = 'synced'
    }
    catch (error) {
      setUnauthorized(error)
    }
  }

  function scheduleSync() {
    if (!syncEnabled.value)
      return
    if (syncTimer)
      clearTimeout(syncTimer)
    syncTimer = setTimeout(reconcileCloudState, 400)
  }

  function replaceState(value: unknown, _action?: DeviceActionByKind<K>) {
    state.value = normalizeDeviceState(kind, value)
    changedAt.value = new Date().toISOString()
    widgetRevision.value += 1
    scheduleSync()
  }

  function dispatch(action: DeviceActionByKind<K>) {
    const nextChangedAt = new Date().toISOString()
    state.value = reduceDeviceState(kind, state.value, action, nextChangedAt)
    changedAt.value = nextChangedAt
    scheduleSync()
  }

  function refreshFromCloud() {
    void reconcileCloudState()
  }

  function updateClock() {
    clock.value = Date.now()
  }

  onMounted(() => {
    if (!hydrated.value) {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        try {
          const snapshot = parseLocalSyncSnapshot(JSON.parse(stored))
          state.value = normalizeDeviceState(kind, snapshot.state)
          changedAt.value = snapshot.changedAt
        }
        catch {
          localStorage.removeItem(storageKey)
        }
      }
      hydrated.value = true
    }
    clockTimer = setInterval(updateClock, 1000)
    window.addEventListener('focus', refreshFromCloud)
    window.addEventListener('online', refreshFromCloud)
    void reconcileCloudState()
  })

  onUnmounted(() => {
    if (clockTimer)
      clearInterval(clockTimer)
    if (syncTimer)
      clearTimeout(syncTimer)
    window.removeEventListener('focus', refreshFromCloud)
    window.removeEventListener('online', refreshFromCloud)
  })

  watch([state, changedAt], ([value, snapshotChangedAt]) => {
    if (typeof window !== 'undefined' && hydrated.value) {
      localStorage.setItem(
        storageKey,
        JSON.stringify(createLocalSyncSnapshot(value, snapshotChangedAt)),
      )
    }
  }, { deep: true })

  return {
    state,
    storageKey,
    widgetKey,
    syncStatus,
    syncError,
    syncEnabled,
    lastSyncedAt,
    visualProgress,
    dispatch,
    replaceState,
    syncChange: reconcileCloudState,
    loadRemoteState: reconcileCloudState,
  }
}
