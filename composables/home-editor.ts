import { computed, onMounted, onUnmounted, readonly, shallowRef, watch } from 'vue'
import { HOME_TEMPLATES, createDefaultHomeState } from '~/constants/home'
import type { DeviceKind, DevicePlacement, HomePoint, HomeStateLoadResponse, HomeStateSyncResponse, HomeSyncStatus, HomeTemplateId, VirtualHomeState } from '~/types'
import { clamp, createPlacementAtPoint, createPlacementInRoom, hasPlacementCollision, normalizeHomeState } from '~/utils/home'

const STORAGE_KEY = 'yun-home:layout:v1'
const ACTIVE_ROOM_STORAGE_KEY = 'yun-home:active-room:v1'

function cloneState(state: VirtualHomeState): VirtualHomeState {
  return {
    ...state,
    placements: state.placements.map(placement => ({ ...placement })),
  }
}

function getStatusCode(error: unknown) {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const code = Number((error as { statusCode?: unknown }).statusCode)
    return Number.isFinite(code) ? code : undefined
  }
  return undefined
}

export function useHomeEditor() {
  const config = useRuntimeConfig()
  const cloudbase = useCloudBaseClient()
  const state = useState<VirtualHomeState>('virtual-home-state', () => createDefaultHomeState())
  const hydrated = useState('virtual-home-hydrated', () => false)
  const selectedDeviceId = useState<DeviceKind | null>('virtual-home-selected-device', () => null)
  const activeRoomId = useState<string | null>('virtual-home-active-room', () => state.value.placements.find(item => item.roomId)?.roomId ?? null)
  const editMode = useState('virtual-home-edit-mode', () => false)
  const syncStatus = useState<HomeSyncStatus>('virtual-home-sync-status', () => 'local')
  const syncError = useState<string | null>('virtual-home-sync-error', () => null)
  const history = shallowRef<VirtualHomeState[]>([])
  const future = shallowRef<VirtualHomeState[]>([])
  const applyingRemote = shallowRef(false)
  let syncTimer: ReturnType<typeof setTimeout> | undefined

  const template = computed(() => HOME_TEMPLATES[state.value.templateId])
  const placements = computed(() => state.value.placements)
  const selectedPlacement = computed(() => state.value.placements.find(item => item.deviceId === selectedDeviceId.value))
  const canUndo = computed(() => history.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)
  const syncEnabled = computed(() => config.public.homeSyncEnabled === true)

  function setState(next: VirtualHomeState, recordHistory = true) {
    if (recordHistory) {
      history.value = [...history.value.slice(-29), cloneState(state.value)]
      future.value = []
    }
    state.value = {
      ...cloneState(next),
      changedAt: new Date().toISOString(),
    }
  }

  function updatePlacement(deviceId: DeviceKind, placement: DevicePlacement) {
    const next = cloneState(state.value)
    next.placements = next.placements.map(item => item.deviceId === deviceId ? placement : item)
    setState(next)
  }

  function placeDevice(deviceId: DeviceKind, point: HomePoint) {
    const current = state.value.placements.find(item => item.deviceId === deviceId)
    const placement = createPlacementAtPoint(template.value, deviceId, point, state.value.placements, current?.rotation ?? 0)
    if (!placement)
      return false
    updatePlacement(deviceId, placement)
    selectedDeviceId.value = deviceId
    activeRoomId.value = placement.roomId
    return true
  }

  function removeDevice(deviceId: DeviceKind) {
    const current = state.value.placements.find(item => item.deviceId === deviceId)
    if (!current?.surfaceId)
      return
    updatePlacement(deviceId, { ...current, roomId: null, surfaceId: null, u: 0.5, v: 0.5 })
  }

  function moveDeviceToRoom(deviceId: DeviceKind, roomId: string) {
    const current = state.value.placements.find(item => item.deviceId === deviceId)
    const placement = createPlacementInRoom(
      template.value,
      deviceId,
      roomId,
      state.value.placements,
      current?.rotation ?? 0,
    )
    if (!placement)
      return false
    updatePlacement(deviceId, placement)
    selectedDeviceId.value = deviceId
    activeRoomId.value = roomId
    return true
  }

  function rotateDevice(deviceId: DeviceKind) {
    const current = state.value.placements.find(item => item.deviceId === deviceId)
    if (!current)
      return
    const rotations: DevicePlacement['rotation'][] = [0, 90, 180, 270]
    const nextRotation = rotations[(rotations.indexOf(current.rotation) + 1) % rotations.length] ?? 0
    updatePlacement(deviceId, { ...current, rotation: nextRotation })
  }

  function moveDeviceByKeyboard(deviceId: DeviceKind, deltaU: number, deltaV: number) {
    const current = state.value.placements.find(item => item.deviceId === deviceId)
    if (!current?.surfaceId)
      return false
    const candidate = { ...current, u: clamp(current.u + deltaU), v: clamp(current.v + deltaV) }
    if (hasPlacementCollision(template.value, candidate, state.value.placements))
      return false
    updatePlacement(deviceId, candidate)
    return true
  }

  function changeTemplate(templateId: HomeTemplateId) {
    if (templateId === state.value.templateId)
      return
    const next = createDefaultHomeState(templateId)
    next.revision = state.value.revision
    setState(next)
    activeRoomId.value = HOME_TEMPLATES[templateId].rooms[0]?.id ?? null
    selectedDeviceId.value = null
  }

  function undo() {
    const previous = history.value.at(-1)
    if (!previous)
      return
    future.value = [cloneState(state.value), ...future.value].slice(0, 30)
    history.value = history.value.slice(0, -1)
    setState(previous, false)
  }

  function redo() {
    const next = future.value[0]
    if (!next)
      return
    history.value = [...history.value, cloneState(state.value)].slice(-30)
    future.value = future.value.slice(1)
    setState(next, false)
  }

  async function getAuthHeaders() {
    let session = await cloudbase.getSharedSession()
    if (!session.session) {
      await useYunleSession().refresh()
      session = await cloudbase.getSharedSession()
    }
    const accessToken = session.session?.access_token
    if (!accessToken)
      throw Object.assign(new Error('登录 YunLe 后即可同步家园'), { statusCode: 401 })
    return { Authorization: `Bearer ${accessToken}` }
  }

  async function loadRemoteState() {
    if (!syncEnabled.value)
      return
    syncStatus.value = 'syncing'
    syncError.value = null
    try {
      const result = await $fetch<HomeStateLoadResponse>('/api/home/state', { headers: await getAuthHeaders() })
      if (result.found && result.state) {
        applyingRemote.value = true
        state.value = normalizeHomeState(result.state)
        applyingRemote.value = false
        syncStatus.value = 'synced'
      }
      else {
        syncStatus.value = 'local'
      }
    }
    catch (error) {
      syncStatus.value = getStatusCode(error) === 401 ? 'unauthorized' : 'error'
      syncError.value = error instanceof Error ? error.message : '家园同步失败'
    }
  }

  async function syncState() {
    if (!syncEnabled.value || applyingRemote.value)
      return
    syncStatus.value = 'syncing'
    syncError.value = null
    try {
      const result = await $fetch<HomeStateSyncResponse>('/api/home/state', {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: state.value,
      })
      applyingRemote.value = true
      state.value = normalizeHomeState(result.state)
      applyingRemote.value = false
      syncStatus.value = 'synced'
    }
    catch (error) {
      const code = getStatusCode(error)
      if (code === 409) {
        syncStatus.value = 'conflict'
        syncError.value = '检测到其他窗口的更新，已重新载入云端布局'
        await loadRemoteState()
      }
      else {
        syncStatus.value = code === 401 ? 'unauthorized' : 'error'
        syncError.value = error instanceof Error ? error.message : '家园同步失败'
      }
    }
  }

  function scheduleSync() {
    if (syncTimer)
      clearTimeout(syncTimer)
    syncTimer = setTimeout(syncState, 500)
  }

  function refreshFromCloud() {
    void loadRemoteState()
  }

  onMounted(() => {
    if (!hydrated.value) {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        try {
          state.value = normalizeHomeState(JSON.parse(stored))
        }
        catch {
          localStorage.removeItem(STORAGE_KEY)
        }
      }
      hydrated.value = true
    }
    const storedRooms = localStorage.getItem(ACTIVE_ROOM_STORAGE_KEY)
    if (storedRooms) {
      try {
        const roomByTemplate = JSON.parse(storedRooms) as Record<string, unknown>
        const storedRoomId = roomByTemplate[state.value.templateId]
        if (typeof storedRoomId === 'string' && template.value.rooms.some(room => room.id === storedRoomId))
          activeRoomId.value = storedRoomId
      }
      catch {
        localStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY)
      }
    }
    if (!activeRoomId.value || !template.value.rooms.some(room => room.id === activeRoomId.value))
      activeRoomId.value = template.value.rooms[0]?.id ?? null
    window.addEventListener('focus', refreshFromCloud)
    window.addEventListener('online', refreshFromCloud)
    void loadRemoteState()
  })

  onUnmounted(() => {
    if (syncTimer)
      clearTimeout(syncTimer)
    window.removeEventListener('focus', refreshFromCloud)
    window.removeEventListener('online', refreshFromCloud)
  })

  watch(state, (value) => {
    if (typeof window === 'undefined' || !hydrated.value)
      return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    if (!applyingRemote.value)
      scheduleSync()
  }, { deep: true })

  watch([activeRoomId, () => state.value.templateId], ([roomId, templateId]) => {
    if (typeof window === 'undefined' || !roomId)
      return
    let roomByTemplate: Record<string, string> = {}
    try {
      roomByTemplate = JSON.parse(localStorage.getItem(ACTIVE_ROOM_STORAGE_KEY) ?? '{}') as Record<string, string>
    }
    catch {
      localStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY)
    }
    localStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, JSON.stringify({ ...roomByTemplate, [templateId]: roomId }))
  })

  return {
    state: readonly(state),
    template,
    placements,
    selectedPlacement,
    selectedDeviceId,
    activeRoomId,
    editMode,
    syncStatus,
    syncError,
    syncEnabled,
    canUndo,
    canRedo,
    placeDevice,
    moveDeviceToRoom,
    removeDevice,
    rotateDevice,
    moveDeviceByKeyboard,
    changeTemplate,
    undo,
    redo,
    refreshFromCloud,
  }
}
