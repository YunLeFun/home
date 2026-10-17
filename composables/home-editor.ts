import { computed, onMounted, onUnmounted, readonly, shallowRef, watch } from 'vue'
import { HOME_TEMPLATES, createDefaultHomeState } from '~/constants/home'
import type { DeviceKind, DevicePlacement, FurnitureEdit, FurnitureKind, HomeSyncStatus, HomeTemplateId, SavedHomeLayout, SurfaceTarget, VirtualHomeState } from '~/types'
import type { FurniturePose, FurnitureProblem } from '~/utils/scene3d/layout'
import { selectCloudSyncDirection } from '~/utils/cloud-sync'
import { clamp, createPlacementAtPoint, createPlacementInRoom, defaultRoomId, hasPlacementCollision, MAX_SAVED_LAYOUTS, normalizeHomeState, normalizeLayoutName, settlePlacements } from '~/utils/home'
import { addFurnitureInRoom, furnitureProblem, moveFurnitureEdit, nearestFurniturePose, poseOf, quarterTurn, removeFurnitureEdit, resolveHomeLayout } from '~/utils/scene3d/layout'

const STORAGE_KEY = 'yun-home:layout:v1'
const ACTIVE_ROOM_STORAGE_KEY = 'yun-home:active-room:v1'

function cloneState(state: VirtualHomeState): VirtualHomeState {
  return {
    ...state,
    placements: state.placements.map(placement => ({ ...placement })),
    furniture: state.furniture.map(edit => ({ ...edit })),
    layouts: state.layouts.map(layout => ({
      ...layout,
      placements: layout.placements.map(placement => ({ ...placement })),
      furniture: layout.furniture.map(edit => ({ ...edit })),
    })),
  }
}

/** What a reset puts back: the furniture, the devices, or both. */
export type HomeResetScope = 'furniture' | 'devices' | 'all'

function sameArrangement(a: Pick<VirtualHomeState, 'templateId' | 'placements' | 'furniture'>, b: Pick<VirtualHomeState, 'templateId' | 'placements' | 'furniture'>) {
  return a.templateId === b.templateId
    && JSON.stringify(a.placements) === JSON.stringify(b.placements)
    && JSON.stringify(a.furniture) === JSON.stringify(b.furniture)
}

export function useHomeEditor() {
  const config = useRuntimeConfig()
  const cloudbase = useCloudBaseClient()
  const cloudSync = useCloudSync()
  const state = useState<VirtualHomeState>('virtual-home-state', () => createDefaultHomeState())
  const hydrated = useState('virtual-home-hydrated', () => false)
  const selectedDeviceId = useState<DeviceKind | null>('virtual-home-selected-device', () => null)
  const activeRoomId = useState<string | null>('virtual-home-active-room', () => state.value.placements.find(item => item.roomId)?.roomId ?? null)
  const selectedFurnitureId = useState<string | null>('virtual-home-selected-furniture', () => null)
  const editMode = useState('virtual-home-edit-mode', () => false)
  const syncStatus = useState<HomeSyncStatus>('virtual-home-sync-status', () => 'local')
  const syncError = useState<string | null>('virtual-home-sync-error', () => null)
  const history = shallowRef<VirtualHomeState[]>([])
  const future = shallowRef<VirtualHomeState[]>([])
  let syncTimer: ReturnType<typeof setTimeout> | undefined

  // The template as the user furnished it: obstacles, tabletops and robot routes follow the furniture.
  const home = computed(() => resolveHomeLayout(state.value.templateId, state.value.furniture))
  const template = computed(() => home.value.template)
  const placements = computed(() => state.value.placements)
  const selectedFurniture = computed(() => home.value.furniture.find(item => item.id === selectedFurnitureId.value) ?? null)
  const layouts = computed(() => state.value.layouts)
  /** The saved layout the home matches right now, if any. */
  const activeLayoutId = computed(() => state.value.layouts.find(layout => sameArrangement(layout, state.value))?.id ?? null)
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

  /**
   * Save new furniture edits. Devices on a tabletop that went with its piece
   * leave the home, like a device moved out of its room.
   */
  function setFurniture(edits: FurnitureEdit[]) {
    const next = cloneState(state.value)
    next.furniture = edits
    next.placements = settlePlacements(resolveHomeLayout(next.templateId, edits).template, next.placements)
    setState(next)
  }

  /**
   * Move or turn a piece of furniture.
   *
   * @returns Why it cannot go there, or null once it has moved
   */
  function moveFurniture(id: string, pose: FurniturePose): FurnitureProblem | null {
    const spec = home.value.furniture.find(item => item.id === id)
    if (!spec)
      return 'fixed'
    const problem = furnitureProblem(home.value, state.value.placements, spec, pose)
    if (problem)
      return problem
    setFurniture(moveFurnitureEdit(state.value.templateId, state.value.furniture, id, pose))
    return null
  }

  /** Give a piece a quarter turn, shifting it a little when it no longer fits where it stands. */
  function rotateFurniture(id: string): FurnitureProblem | null {
    const spec = home.value.furniture.find(item => item.id === id)
    if (!spec)
      return 'fixed'
    const pose = poseOf(spec)
    const target = { ...pose, rotation: quarterTurn(pose.rotation + 90) }
    const fit = nearestFurniturePose(home.value, state.value.placements, spec, target)
    return fit ? moveFurniture(id, fit) : furnitureProblem(home.value, state.value.placements, spec, target)
  }

  function nudgeFurniture(id: string, dx: number, dz: number): FurnitureProblem | null {
    const spec = home.value.furniture.find(item => item.id === id)
    if (!spec)
      return 'fixed'
    const pose = poseOf(spec)
    return moveFurniture(id, { ...pose, x: pose.x + dx, z: pose.z + dz })
  }

  function removeFurniture(id: string) {
    if (selectedFurnitureId.value === id)
      selectedFurnitureId.value = null
    setFurniture(removeFurnitureEdit(state.value.templateId, state.value.furniture, id))
  }

  /**
   * Add a piece from the catalogue, at a free spot in a room.
   *
   * @returns The new piece's id, or null when the room has no space for it
   */
  function addFurniture(kind: FurnitureKind, roomId: string) {
    const added = addFurnitureInRoom(state.value.templateId, state.value.furniture, state.value.placements, kind, roomId)
    if (!added)
      return null
    setFurniture(added.edits)
    selectedFurnitureId.value = added.id
    selectedDeviceId.value = null
    return added.id
  }

  /**
   * Put the furniture, the devices or both back where the template has them.
   * Devices a returning piece would stand on move aside.
   */
  function reset(scope: HomeResetScope) {
    const next = cloneState(state.value)
    if (scope !== 'devices')
      next.furniture = []
    if (scope !== 'furniture')
      next.placements = createDefaultHomeState(next.templateId).placements
    next.placements = settlePlacements(resolveHomeLayout(next.templateId, next.furniture).template, next.placements)
    selectedFurnitureId.value = null
    selectedDeviceId.value = null
    setState(next)
  }

  /** Change the saved layouts; saving is not an edit to undo. */
  function setLayouts(update: (layouts: SavedHomeLayout[]) => SavedHomeLayout[]) {
    const next = cloneState(state.value)
    next.layouts = update(next.layouts)
    setState(next, false)
  }

  function snapshot(id: string, name: string): SavedHomeLayout {
    const current = cloneState(state.value)
    return { id, name, templateId: current.templateId, placements: current.placements, furniture: current.furniture, savedAt: new Date().toISOString() }
  }

  /**
   * Save the home as it stands under a name.
   *
   * @returns The new layout's id, or null when the name is empty or the list is full
   */
  function saveLayout(name: string) {
    const clean = normalizeLayoutName(name)
    if (!clean || state.value.layouts.length >= MAX_SAVED_LAYOUTS)
      return null
    const id = `layout-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    setLayouts(layouts => [snapshot(id, clean), ...layouts])
    return id
  }

  /** Save the home as it stands over a saved layout. */
  function overwriteLayout(id: string) {
    setLayouts(layouts => layouts.map(layout => layout.id === id ? snapshot(id, layout.name) : layout))
  }

  function renameLayout(id: string, name: string) {
    const clean = normalizeLayoutName(name)
    if (clean)
      setLayouts(layouts => layouts.map(layout => layout.id === id ? { ...layout, name: clean } : layout))
    return Boolean(clean)
  }

  function deleteLayout(id: string) {
    setLayouts(layouts => layouts.filter(layout => layout.id !== id))
  }

  /** Arrange the home as a saved layout, which can be undone. */
  function applyLayout(id: string) {
    const layout = state.value.layouts.find(item => item.id === id)
    if (!layout)
      return false
    const next = cloneState(state.value)
    const templateChanged = next.templateId !== layout.templateId
    next.templateId = layout.templateId
    next.furniture = layout.furniture.map(edit => ({ ...edit }))
    next.placements = settlePlacements(resolveHomeLayout(layout.templateId, next.furniture).template, layout.placements)
    setState(next)
    selectedDeviceId.value = null
    selectedFurnitureId.value = null
    if (templateChanged || !HOME_TEMPLATES[next.templateId].rooms.some(room => room.id === activeRoomId.value))
      activeRoomId.value = defaultRoomId(HOME_TEMPLATES[next.templateId])
    return true
  }

  function changeTemplate(templateId: HomeTemplateId) {
    if (templateId === state.value.templateId)
      return
    const next = createDefaultHomeState(templateId)
    next.revision = state.value.revision
    next.layouts = cloneState(state.value).layouts
    setState(next)
    activeRoomId.value = defaultRoomId(HOME_TEMPLATES[templateId])
    selectedDeviceId.value = null
    selectedFurnitureId.value = null
  }

  function undo() {
    const previous = history.value.at(-1)
    if (!previous)
      return
    future.value = [cloneState(state.value), ...future.value].slice(0, 30)
    history.value = history.value.slice(0, -1)
    // Undo steps back through edits, not through saving layouts.
    setState({ ...previous, layouts: state.value.layouts }, false)
  }

  function redo() {
    const next = future.value[0]
    if (!next)
      return
    history.value = [...history.value, cloneState(state.value)].slice(-30)
    future.value = future.value.slice(1)
    setState({ ...next, layouts: state.value.layouts }, false)
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
    home,
    template,
    placements,
    selectedPlacement,
    selectedDeviceId,
    selectedFurnitureId,
    selectedFurniture,
    layouts,
    activeLayoutId,
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
    moveFurniture,
    rotateFurniture,
    nudgeFurniture,
    removeFurniture,
    addFurniture,
    reset,
    saveLayout,
    overwriteLayout,
    renameLayout,
    deleteLayout,
    applyLayout,
    changeTemplate,
    undo,
    redo,
    refreshFromCloud,
  }
}
