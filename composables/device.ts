import { computed, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import type {
  DeviceActionByKind,
  DeviceKind,
  DeviceStateByKind,
  DeviceStateLoadResponse,
  DeviceStateSyncResponse,
  DeviceStateSyncStatus,
} from '~/types'
import { createDefaultDeviceState, normalizeDeviceState, reduceDeviceState } from '~/utils/device'

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error)
    return String((error as { message?: unknown }).message)
  return '设备状态同步失败'
}

function getStatusCode(error: unknown) {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const code = Number((error as { statusCode?: unknown }).statusCode)
    return Number.isFinite(code) ? code : undefined
  }
  return undefined
}

function getDeviceStorageKey(kind: DeviceKind, deviceId: string) {
  return kind === 'air-conditioner'
    ? `yun-home:device:${deviceId}:ac`
    : `yun-home:device:${deviceId}:${kind}`
}

export function useDeviceState<K extends DeviceKind>(kind: K, deviceId: string = kind) {
  const config = useRuntimeConfig()
  const cloudbase = useCloudBaseClient()
  const key = `${kind}:${deviceId}`
  const state = useState<DeviceStateByKind<K>>(`device-state:${key}`, () => createDefaultDeviceState(kind))
  const hydrated = useState(`device-hydrated:${key}`, () => false)
  const syncStatus = useState<DeviceStateSyncStatus>(`device-sync:${key}`, () => 'local')
  const syncError = useState<string | null>(`device-error:${key}`, () => null)
  const lastSyncedAt = useState<string | null>(`device-synced-at:${key}`, () => null)
  const widgetRevision = useState(`device-widget-revision:${key}`, () => 0)
  const storageKey = getDeviceStorageKey(kind, deviceId)
  const syncEnabled = computed(() => config.public.deviceSyncEnabled === true)
  const widgetKey = computed(() => `${storageKey}:${widgetRevision.value}`)
  const clock = shallowRef(Date.now())
  let clockTimer: ReturnType<typeof setInterval> | undefined

  const visualProgress = computed(() => {
    if (kind !== 'robot-vacuum')
      return 0
    const robot = state.value as DeviceStateByKind<'robot-vacuum'>
    if (robot.status !== 'cleaning')
      return robot.progress
    const elapsed = Math.max(0, clock.value - Date.parse(robot.stateChangedAt))
    return (robot.progress + elapsed / 30_000) % 1
  })

  async function getAuthHeaders() {
    let session = await cloudbase.getSharedSession()
    if (!session.session) {
      await useYunleSession().refresh()
      session = await cloudbase.getSharedSession()
    }
    const accessToken = session.session?.access_token
    if (!accessToken)
      throw Object.assign(new Error('登录 YunLe 后即可同步到云端'), { statusCode: 401 })
    return { Authorization: `Bearer ${accessToken}` }
  }

  async function loadRemoteState() {
    if (!syncEnabled.value)
      return
    syncStatus.value = 'syncing'
    syncError.value = null
    try {
      const result = await $fetch<DeviceStateLoadResponse<DeviceStateByKind<K>>>(`/api/devices/${deviceId}/state`, {
        headers: await getAuthHeaders(),
      })
      if (result.found && result.state) {
        state.value = normalizeDeviceState(kind, result.state)
        widgetRevision.value += 1
        lastSyncedAt.value = result.changedAt ?? new Date().toISOString()
        syncStatus.value = 'synced'
      }
      else {
        syncStatus.value = 'local'
      }
    }
    catch (error) {
      syncStatus.value = getStatusCode(error) === 401 ? 'unauthorized' : 'error'
      syncError.value = getErrorMessage(error)
    }
  }

  async function syncChange(action?: DeviceActionByKind<K>, changedAt = new Date().toISOString()) {
    if (!syncEnabled.value)
      return
    syncStatus.value = 'syncing'
    syncError.value = null
    try {
      const result = await $fetch<DeviceStateSyncResponse>(`/api/devices/${deviceId}/state`, {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: { deviceId, kind, state: state.value, action, changedAt },
      })
      syncStatus.value = result.synced ? 'synced' : 'local'
      lastSyncedAt.value = result.changedAt
    }
    catch (error) {
      syncStatus.value = getStatusCode(error) === 401 ? 'unauthorized' : 'error'
      syncError.value = getErrorMessage(error)
    }
  }

  function replaceState(value: unknown, action?: DeviceActionByKind<K>) {
    state.value = normalizeDeviceState(kind, value)
    widgetRevision.value += 1
    void syncChange(action)
  }

  function dispatch(action: DeviceActionByKind<K>) {
    const changedAt = new Date().toISOString()
    state.value = reduceDeviceState(kind, state.value, action, changedAt)
    void syncChange(action, changedAt)
  }

  function handleFocus() {
    void loadRemoteState()
  }

  function updateClock() {
    clock.value = Date.now()
  }

  onMounted(() => {
    if (!hydrated.value) {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        try {
          state.value = normalizeDeviceState(kind, JSON.parse(stored))
        }
        catch {
          localStorage.removeItem(storageKey)
        }
      }
      hydrated.value = true
    }
    clockTimer = setInterval(updateClock, 1000)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('online', handleFocus)
    void loadRemoteState()
  })

  onUnmounted(() => {
    if (clockTimer)
      clearInterval(clockTimer)
    window.removeEventListener('focus', handleFocus)
    window.removeEventListener('online', handleFocus)
  })

  watch(state, (value) => {
    if (typeof window !== 'undefined' && hydrated.value)
      localStorage.setItem(storageKey, JSON.stringify(value))
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
    syncChange,
    loadRemoteState,
  }
}
