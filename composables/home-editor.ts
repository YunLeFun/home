import { computed, onMounted, onUnmounted, readonly, shallowRef, watch } from 'vue'
import { HOME_TEMPLATES, createDefaultHomeState } from '~/constants/home'
import type { DeviceKind, DevicePlacement, HomeSyncStatus, HomeTemplateId, SurfaceTarget, VirtualHomeState } from '~/types'
import { selectCloudSyncDirection } from '~/utils/cloud-sync'
import { clamp, createPlacementAtPoint, createPlacementInRoom, defaultRoomId, hasPlacementCollision, normalizeHomeState } from '~/utils/home'

const STORAGE_KEY = 'yun-home:layout:v1'
const ACTIVE_ROOM_STORAGE_KEY = 'yun-home:active-room:v1'

function cloneState(state: VirtualHomeState): VirtualHomeState {
  return {
    ...state,
    placements: state.placements.map(placement => ({ ...placement })),
  }
}

export function useHomeEditor() {
  const config = useRuntimeConfig()
  const cloudbase = useCloudBaseClient()
  const cloudSync = useCloudSync()
  const state = useState<VirtualHomeState>('virtual-home-state', () => createDefaultHomeState())
  const hydrated = useState('virtual-home-hydrated', () => false)
  const selectedDeviceId = useState<DeviceKind | null>('virtual-home-selected-device', () => null)
  const activeRoomId = useState<string | null>('virtual-home-active-room', () => state.value.placements.find(item => item.roomId)?.roomId ?? null)
  const editMode = useState('virtual-home-edit-mode', () => false)
  const syncStatus = useState<HomeSyncStatus>('virtual-home-sync-status', () => 'local')
  const syncError = useState<string | null>('virtual-home-sync-error', () => null)
  const history = shallowRef<VirtualHomeState[]>([])
  const future = shallowRef<VirtualHomeState[]>([])
  let syncTimer: ReturnType<typeof setTimeout> | undefined

  const template = computed(() => HOME_TEMPLATES[state.value.templateId])
  const placements = computed(() => state.value.placements)
  const selectedPlacement = computed(() => state.value.placements.find(item => item.deviceId === selectedDeviceId.value))
  const canUndo = computed(() => history.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)
  const collection = computed(() => String(config.public.cloudbaseHomeLayoutsCollection || 'home_layouts'))
  const syncEnabled = computed(() => config.public.homeSyncEnabled === true && cloudbase.isConfigured.value)

  function scheduleSync() {
    if (!syncEnabled.value)
      return
    if (syncTimer)
      clearTimeout(syncTimer)
    syncTimer = setTimeout(reconcileCloudState, 500)
  }

  function setState(next: VirtualHomeState, recordHistory = true) {
    if (recordHistory) {
      history.value = [...history.value.slice(-29), cloneState(state.value)]
      future.value = []
    }
    state.value = {
      ...cloneState(next),
      revision: state.value.revision + 1,
      changedAt: new Date().toISOString(),
    }
    scheduleSync()
  }

  function updatePlacement(deviceId: DeviceKind, placement: DevicePlacement) {
    const next = cloneState(state.value)
    next.placements = next.placements.map(item => item.deviceId === deviceId ? placement : item)
    setState(next)
  }

  function placeDevice(deviceId: DeviceKind, target: SurfaceTarget) {
    const current = state.value.placements.find(item => item.deviceId === deviceId)
    const placement = createPlacementAtPoint(template.value, deviceId, target.point, state.value.placements, current?.rotation ?? 0, target.surfaceId)
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
    activeRoomId.value = defaultRoomId(HOME_TEMPLATES[templateId])
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

  function getRecordOptions() {
    return {
      collection: collection.value,
      keyField: 'slot' as const,
      keyValue: 'primary',
    }
  }

  async function reconcileCloudState() {
    if (!syncEnabled.value || !hydrated.value)
      return

    syncStatus.value = 'syncing'
    syncError.value = null
    try {
      const remote = await cloudSync.readRecord<VirtualHomeState>(getRecordOptions())
      const direction = selectCloudSyncDirection(state.value.changedAt, remote?.changedAt ?? null)

      if (direction === 'pull' && remote) {
        state.value = {
          ...normalizeHomeState(remote.state),
          changedAt: remote.changedAt,
        }
      }
      else if (direction === 'push') {
        const winningRemote = await cloudSync.writeRecord(getRecordOptions(), state.value, state.value.changedAt, remote)
        if (winningRemote && selectCloudSyncDirection(state.value.changedAt, winningRemote.changedAt) === 'pull') {
          state.value = {
            ...normalizeHomeState(winningRemote.state),
            changedAt: winningRemote.changedAt,
          }
        }
      }
      syncStatus.value = 'synced'
    }
    catch (error) {
      syncStatus.value = isCloudSyncUnauthorizedError(error) ? 'unauthorized' : 'error'
      syncError.value = isCloudSyncUnauthorizedError(error)
        ? '登录 YunLe 后即可同步家园'
        : error instanceof Error ? error.message : '家园同步失败'
    }
  }

  function refreshFromCloud() {
    void reconcileCloudState()
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
      activeRoomId.value = defaultRoomId(template.value)
    window.addEventListener('focus', refreshFromCloud)
    window.addEventListener('online', refreshFromCloud)
    void reconcileCloudState()
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
