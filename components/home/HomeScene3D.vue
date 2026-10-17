<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import type { DeviceKind, DevicePlacement, FurnitureKind, SurfaceTarget } from '~/types'
import type { DeviceVisual } from '~/utils/scene3d/devices'
import type { HomeResetScope } from '~/composables/home-editor'
import type { FurniturePose, ResolvedHome } from '~/utils/scene3d/layout'
import type { HomeScene3D, ScreenAnchor } from '~/utils/scene3d/scene'
import { FURNITURE_CATALOGUE, FURNITURE_KINDS } from '~/constants/furniture'
import { HOME_DEVICES } from '~/constants/home'
import { FURNITURE_SNAP } from '~/utils/scene3d/layout'

const props = defineProps<{
  /** The home as the user furnished it. */
  home: ResolvedHome
  placements: DevicePlacement[]
  selectedDeviceId: DeviceKind | null
  selectedFurnitureId?: string | null
  activeRoomId: string | null
  overviewMode: boolean
  activeDevices: DeviceKind[]
  visuals: Partial<Record<DeviceKind, DeviceVisual>>
  robotProgress: number
  robotCleaning: boolean
  /** Placing devices: surfaces light up and devices can be dragged. */
  editMode?: boolean
  /** Width of an overlay covering the right side, in CSS pixels. */
  insetRight?: number
}>()

const emit = defineEmits<{
  select: [deviceId: DeviceKind]
  roomSelect: [roomId: string]
  place: [deviceId: DeviceKind, target: SurfaceTarget]
  nudge: [deviceId: DeviceKind, deltaU: number, deltaV: number]
  rotate: [deviceId: DeviceKind]
  remove: [deviceId: DeviceKind]
  selectFurniture: [id: string | null]
  moveFurniture: [id: string, pose: FurniturePose]
  nudgeFurniture: [id: string, dx: number, dz: number]
  rotateFurniture: [id: string]
  removeFurniture: [id: string]
  addFurniture: [kind: FurnitureKind]
  reset: [scope: HomeResetScope]
  ready: []
  failed: []
}>()

const { phase } = useSceneTime()
const shell = shallowRef<HTMLElement | null>(null)
const canvas = shallowRef<HTMLCanvasElement | null>(null)
const ready = shallowRef(false)
const hovered = shallowRef<DeviceKind | null>(null)
const draggingId = shallowRef<DeviceKind | null>(null)
const draggingFurniture = shallowRef<string | null>(null)
const hoveredFurniture = shallowRef<string | null>(null)
/** The open menu of the edit bar, and the reset waiting for a second click. */
const barMenu = shallowRef<'catalogue' | 'reset' | null>(null)
const pendingReset = shallowRef<HomeResetScope | null>(null)
const RESET_LABELS: Record<HomeResetScope, string> = { furniture: '重置家具', devices: '重置设备', all: '全部重置' }
const RESET_HINTS: Record<HomeResetScope, string> = {
  furniture: '家具回到户型默认位置',
  devices: '设备回到户型默认位置',
  all: '家具和设备都回到默认',
}
const dropValid = shallowRef(true)
const hotspots = new Map<DeviceKind, HTMLElement>()
let scene: HomeScene3D | null = null
let resizeObserver: ResizeObserver | undefined
let motionQuery: MediaQueryList | undefined
let visibilityObserver: IntersectionObserver | undefined
let onScreen = true

const placed = computed(() => props.placements.filter(placement => placement.surfaceId).map(placement => placement.deviceId))
const selectedPlacement = computed(() => props.placements.find(placement => placement.deviceId === props.selectedDeviceId && placement.surfaceId))
const template = computed(() => props.home.template)
const selectedFurniture = computed(() => props.home.furniture.find(item => item.id === props.selectedFurnitureId) ?? null)
const showToolbar = computed(() => Boolean(props.editMode && selectedPlacement.value && !draggingId.value))
const showFurnitureToolbar = computed(() => Boolean(props.editMode && !showToolbar.value && selectedFurniture.value && !draggingFurniture.value))
const showFurnitureBar = computed(() => Boolean(props.editMode && !showToolbar.value && !showFurnitureToolbar.value && !draggingId.value && !draggingFurniture.value))
// Wall devices always face the room, so turning them changes nothing.
const canRotate = computed(() => template.value.surfaces.find(surface => surface.id === selectedPlacement.value?.surfaceId)?.kind !== 'wall')

function setHotspot(id: DeviceKind, element: unknown) {
  if (element instanceof HTMLElement)
    hotspots.set(id, element)
  else
    hotspots.delete(id)
}

function applyAnchors(anchors: ScreenAnchor[]) {
  for (const anchor of anchors) {
    const element = hotspots.get(anchor.id)
    if (!element)
      continue
    element.style.transform = `translate3d(${anchor.x.toFixed(1)}px, ${anchor.y.toFixed(1)}px, 0)`
    element.dataset.visible = String(anchor.visible)
  }
}

function syncPaused() {
  scene?.setPaused(!onScreen)
}

// Pointer: a short press picks. A drag slides the view over the home; a
// right-button or Shift drag turns it, the wheel or a pinch zooms. On a phone
// one finger turns the home (vertical swipes still scroll the page) and two
// fingers slide and zoom. While editing, a drag that starts on a device or a
// piece of furniture moves it instead, and one finger slides the view.
let press: { id: number, x: number, y: number, lastX: number, lastY: number, dragging: boolean, deviceId: DeviceKind | null, furnitureId: string | null, gesture: 'pan' | 'rotate' } | null = null
const touches = new Map<number, { x: number, y: number }>()
let pinch: { distance: number, x: number, y: number } | null = null
const viewMoved = shallowRef(false)
let dropTarget: SurfaceTarget | null = null
let furnitureDrop: FurniturePose | null = null

function localPoint(event: { clientX: number, clientY: number }) {
  const rect = canvas.value!.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

function pinchState() {
  const [a, b] = [...touches.values()]
  return a && b ? { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null
}

function handlePointerDown(event: PointerEvent, deviceId: DeviceKind | null = null) {
  if (event.pointerType === 'touch') {
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (touches.size === 2) {
      // A second finger turns the gesture into a slide and pinch.
      handlePointerCancel()
      pinch = pinchState()
      for (const id of touches.keys())
        canvas.value?.setPointerCapture(id)
      return
    }
    if (touches.size > 2)
      return
  }
  const rotating = event.button === 2 || (event.button === 0 && (event.shiftKey || event.altKey))
  if (event.button !== 0 && !rotating)
    return
  const gesture = rotating || (event.pointerType === 'touch' && !props.editMode) ? 'rotate' : 'pan'
  let device = deviceId
  let furniture: string | null = null
  if (props.editMode && !device && !rotating && scene) {
    const point = localPoint(event)
    const hit = scene.pick(point.x, point.y)
    device = hit.deviceId
    furniture = device ? null : hit.furnitureId
  }
  barMenu.value = null
  press = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, dragging: false, deviceId: props.editMode && !rotating ? device : null, furnitureId: props.editMode ? furniture : null, gesture }
  if ((press.deviceId || press.furnitureId) && event.currentTarget instanceof Element)
    event.currentTarget.setPointerCapture(event.pointerId)
}

function handlePointerMove(event: PointerEvent) {
  if (touches.has(event.pointerId)) {
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const next = pinch && pinchState()
    if (pinch && next && scene) {
      scene.panBy(next.x - pinch.x, next.y - pinch.y)
      if (next.distance > 0)
        scene.zoomBy(pinch.distance / next.distance)
      pinch = next
      viewMoved.value = true
      return
    }
  }
  if (press && press.id === event.pointerId) {
    const dx = event.clientX - press.lastX
    const dy = event.clientY - press.lastY
    if (!press.dragging && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) {
      press.dragging = true
      if (!press.deviceId)
        canvas.value?.setPointerCapture(event.pointerId)
    }
    if (press.dragging && press.deviceId)
      previewDrop(press.deviceId, event.clientX, event.clientY)
    else if (press.dragging && press.furnitureId)
      previewFurniture(press.furnitureId, event.clientX, event.clientY)
    else if (press.dragging && press.gesture === 'pan')
      scene?.panBy(dx, dy)
    else if (press.dragging)
      scene?.rotateBy(dx, event.pointerType === 'touch' ? 0 : dy)
    if (press.dragging && !press.deviceId && !press.furnitureId)
      viewMoved.value = true
    press.lastX = event.clientX
    press.lastY = event.clientY
    return
  }
  if (event.pointerType !== 'mouse' || !scene)
    return
  const point = localPoint(event)
  const hit = scene.pick(point.x, point.y)
  if (hit.deviceId !== hovered.value) {
    hovered.value = hit.deviceId
    scene.setSelection(props.selectedDeviceId, hit.deviceId)
  }
  hoveredFurniture.value = props.editMode && !hit.deviceId ? hit.furnitureId : null
}

function releaseTouch(event: PointerEvent) {
  touches.delete(event.pointerId)
  if (touches.size < 2)
    pinch = null
}

function handlePointerUp(event: PointerEvent) {
  const pinching = Boolean(pinch)
  releaseTouch(event)
  if (!press || press.id !== event.pointerId || pinching)
    return
  const { dragging, deviceId, furnitureId, gesture } = press
  press = null
  if (furnitureId) {
    const pose = furnitureDrop
    endFurnitureDrag()
    emit('selectFurniture', furnitureId)
    if (dragging && pose)
      emit('moveFurniture', furnitureId, pose)
    return
  }
  if (deviceId) {
    if (!dragging) {
      emit('select', deviceId)
      return
    }
    const target = dropTarget
    endDrag()
    // Select first, so a turned-down drop still leaves the dragged device in hand.
    emit('select', deviceId)
    if (target)
      emit('place', deviceId, target)
    return
  }
  if (dragging || (gesture === 'rotate' && event.button === 2) || !scene)
    return
  const point = localPoint(event)
  // A tap on a surface places the selected device when it has no spot yet.
  if (props.editMode && props.selectedDeviceId && !selectedPlacement.value) {
    const target = scene.surfacePointAt(props.selectedDeviceId, point.x, point.y)
    if (target)
      emit('place', props.selectedDeviceId, target)
    return
  }
  const hit = scene.pick(point.x, point.y)
  if (props.editMode && props.selectedFurnitureId)
    emit('selectFurniture', null)
  if (hit.deviceId)
    emit('select', hit.deviceId)
  else if (hit.roomId)
    emit('roomSelect', hit.roomId)
}

function handleWheel(event: WheelEvent) {
  if (!scene)
    return
  // Trackpad pinches arrive as wheel events with Ctrl held, in finer steps.
  scene.zoomBy(Math.exp(event.deltaY * (event.ctrlKey ? 0.01 : 0.0015)))
  viewMoved.value = true
}

function resetView() {
  scene?.resetView()
  viewMoved.value = false
}

function handlePointerCancel() {
  if (press?.deviceId)
    endDrag()
  if (press?.furnitureId)
    endFurnitureDrag()
  press = null
}

function previewFurniture(id: string, clientX: number, clientY: number) {
  if (!scene)
    return
  draggingFurniture.value = id
  const point = localPoint({ clientX, clientY })
  const result = scene.dragFurniture(id, point.x, point.y)
  furnitureDrop = result.pose
  dropValid.value = !result.problem
}

function endFurnitureDrag() {
  scene?.endFurnitureDrag()
  draggingFurniture.value = null
  furnitureDrop = null
  dropValid.value = true
}

function handleFurnitureKeydown(event: KeyboardEvent) {
  const id = selectedFurniture.value?.id
  if (!id)
    return
  const step = FURNITURE_SNAP * (event.shiftKey ? 4 : 1)
  if (event.key === 'ArrowLeft')
    emit('nudgeFurniture', id, -step, 0)
  else if (event.key === 'ArrowRight')
    emit('nudgeFurniture', id, step, 0)
  else if (event.key === 'ArrowUp')
    emit('nudgeFurniture', id, 0, -step)
  else if (event.key === 'ArrowDown')
    emit('nudgeFurniture', id, 0, step)
  else if (event.key.toLowerCase() === 'r')
    emit('rotateFurniture', id)
  else if (event.key === 'Delete' || event.key === 'Backspace')
    emit('removeFurniture', id)
  else if (event.key === 'Escape')
    emit('selectFurniture', null)
  else
    return
  event.preventDefault()
}

function chooseFurniture(kind: FurnitureKind) {
  barMenu.value = null
  emit('addFurniture', kind)
}

function toggleMenu(menu: 'catalogue' | 'reset') {
  barMenu.value = barMenu.value === menu ? null : menu
  pendingReset.value = null
}

function chooseReset(scope: HomeResetScope) {
  // A first click asks; the second resets. Either way it can be undone.
  if (pendingReset.value !== scope) {
    pendingReset.value = scope
    return
  }
  pendingReset.value = null
  barMenu.value = null
  emit('reset', scope)
}

function insideCanvas(clientX: number, clientY: number) {
  const rect = canvas.value?.getBoundingClientRect()
  return Boolean(rect && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom)
}

/**
 * Preview a device dragged to a point of the page, such as from the device
 * tray. Outside the canvas the device stays where it was.
 */
function previewDrop(deviceId: DeviceKind, clientX: number, clientY: number) {
  if (!scene)
    return
  draggingId.value = deviceId
  if (!insideCanvas(clientX, clientY)) {
    scene.endDrag()
    dropTarget = null
    dropValid.value = true
    return
  }
  const point = localPoint({ clientX, clientY })
  const result = scene.dragDevice(deviceId, point.x, point.y)
  dropTarget = result.target
  dropValid.value = result.valid
}

function endDrag() {
  scene?.endDrag()
  draggingId.value = null
  dropTarget = null
  dropValid.value = true
}

/** The surface point under a point of the page, for dropping a device there. */
function getWorldPoint(clientX: number, clientY: number, deviceId: DeviceKind): SurfaceTarget | null {
  if (!scene || !insideCanvas(clientX, clientY))
    return null
  const point = localPoint({ clientX, clientY })
  return scene.surfacePointAt(deviceId, point.x, point.y)
}

function handleHotspotClick(id: DeviceKind, event: MouseEvent) {
  // While editing, pointer presses are handled on pointer up; keyboard clicks still select.
  if (!props.editMode || event.detail === 0)
    emit('select', id)
}

function handleHotspotKeydown(id: DeviceKind, event: KeyboardEvent) {
  if (!props.editMode)
    return
  const step = event.shiftKey ? 0.05 : 0.018
  if (event.key === 'ArrowLeft')
    emit('nudge', id, -step, 0)
  else if (event.key === 'ArrowRight')
    emit('nudge', id, step, 0)
  else if (event.key === 'ArrowUp')
    emit('nudge', id, 0, -step)
  else if (event.key === 'ArrowDown')
    emit('nudge', id, 0, step)
  else if (event.key.toLowerCase() === 'r')
    emit('rotate', id)
  else if (event.key === 'Delete' || event.key === 'Backspace')
    emit('remove', id)
  else
    return
  event.preventDefault()
}

defineExpose({ getWorldPoint, previewDrop, endDrag })

function handlePointerLeave() {
  if (hovered.value) {
    hovered.value = null
    scene?.setSelection(props.selectedDeviceId, null)
  }
}

function hoverHotspot(id: DeviceKind | null) {
  hovered.value = id
  scene?.setSelection(props.selectedDeviceId, id)
}

function insetFor() {
  return window.innerWidth > 720 ? props.insetRight ?? 0 : 0
}

onMounted(async () => {
  const element = canvas.value
  if (!element)
    return
  try {
    const { HomeScene3D } = await import('~/utils/scene3d/scene')
    if (!canvas.value)
      return
    const mobile = window.innerWidth <= 720
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    motionQuery.addEventListener('change', syncMotion)
    scene = new HomeScene3D({
      canvas: element,
      mobile,
      reducedMotion: motionQuery.matches,
      onProject: applyAnchors,
    })
    element.addEventListener('webglcontextlost', (event) => {
      event.preventDefault()
      emit('failed')
    })
    const rect = shell.value!.getBoundingClientRect()
    scene.resize(rect.width, rect.height)
    scene.setPhase(phase.value, true)
    scene.setPlacements(props.placements)
    scene.setHome(props.home)
    scene.setFurnitureSelection(props.selectedFurnitureId ?? null)
    scene.setVisuals(props.visuals)
    scene.setRobot(props.robotCleaning, props.robotProgress)
    scene.setFocus(props.activeRoomId, props.overviewMode && !mobile)
    scene.setSelection(props.selectedDeviceId)
    scene.setEditing(Boolean(props.editMode))
    scene.setInsetRight(insetFor())
    resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry || !scene)
        return
      const phone = window.innerWidth <= 720
      scene.setMobile(phone)
      scene.setFocus(props.activeRoomId, props.overviewMode && !phone)
      scene.setInsetRight(insetFor())
      scene.resize(entry.contentRect.width, entry.contentRect.height)
    })
    resizeObserver.observe(shell.value!)
    visibilityObserver = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true
      syncPaused()
    })
    visibilityObserver.observe(shell.value!)
    syncPaused()
    requestAnimationFrame(() => {
      ready.value = true
      emit('ready')
    })
  }
  catch (error) {
    console.error('[home] 3D scene failed to start', error)
    emit('failed')
  }
})

function syncMotion() {
  scene?.setReducedMotion(Boolean(motionQuery?.matches))
}

onUnmounted(() => {
  motionQuery?.removeEventListener('change', syncMotion)
  resizeObserver?.disconnect()
  visibilityObserver?.disconnect()
  scene?.dispose()
  scene = null
})

watch(() => props.home, home => scene?.setHome(home))
watch(() => props.selectedFurnitureId, id => scene?.setFurnitureSelection(id ?? null))
watch(() => props.placements, placements => scene?.setPlacements(placements), { deep: true })
watch(() => props.visuals, visuals => scene?.setVisuals(visuals), { deep: true })
watch(() => [props.robotCleaning, props.robotProgress] as const, ([cleaning, progress], previous) => {
  // Progress ticks while cleaning; the scene extrapolates between ticks, so
  // only resync on a state change or a large jump.
  if (!previous || cleaning !== previous[0] || Math.abs(progress - previous[1]) > 0.05 || !cleaning)
    scene?.setRobot(cleaning, progress)
})
watch(() => [props.activeRoomId, props.overviewMode] as const, ([roomId, overview]) => {
  scene?.setFocus(roomId, overview && window.innerWidth > 720)
  viewMoved.value = false
})
watch(() => props.selectedDeviceId, selected => scene?.setSelection(selected))
watch(() => props.editMode, (editing) => {
  if (!editing && (press?.deviceId || press?.furnitureId))
    handlePointerCancel()
  if (!editing)
    barMenu.value = null
  scene?.setEditing(Boolean(editing))
})
watch(() => props.insetRight, () => scene?.setInsetRight(insetFor()))
watch(phase, value => scene?.setPhase(value))
</script>

<template>
  <section
    ref="shell"
    class="home-scene3d home-sky"
    :class="{ 'is-ready': ready, 'is-editing': editMode, 'is-dragging': draggingId || draggingFurniture, 'is-over-furniture': hoveredFurniture }"
    :data-phase="phase"
    aria-label="云之彼端 3D 家园"
  >
    <canvas
      ref="canvas"
      class="home-scene3d__canvas"
      aria-hidden="true"
      @pointerdown="handlePointerDown($event)"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="releaseTouch($event); handlePointerCancel()"
      @pointerleave="handlePointerLeave"
      @wheel.prevent="handleWheel"
      @contextmenu.prevent
    />
    <Transition name="toolbar">
      <button v-if="viewMoved" type="button" class="home-scene3d__reset-view" title="回到默认视角" @click="resetView">
        <span class="i-carbon-center-to-fit" />重置视角
      </button>
    </Transition>
    <div class="home-scene3d__hotspots">
      <button
        v-for="id in placed"
        :key="id"
        :ref="element => setHotspot(id, element)"
        type="button"
        class="home-scene3d__hotspot"
        :data-selected="selectedDeviceId === id"
        :data-hovered="hovered === id"
        :data-active="activeDevices.includes(id)"
        :data-dragging="draggingId === id"
        :data-invalid="draggingId === id && !dropValid"
        :aria-pressed="selectedDeviceId === id"
        :aria-label="editMode
          ? `${HOME_DEVICES[id].name}，可拖动摆放，方向键微调，R 旋转，Delete 移出房间`
          : `${HOME_DEVICES[id].name}${activeDevices.includes(id) ? '，运行中' : '，已关闭'}`"
        @click="handleHotspotClick(id, $event)"
        @keydown="handleHotspotKeydown(id, $event)"
        @pointerdown="editMode && handlePointerDown($event, id)"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @pointercancel="handlePointerCancel"
        @pointerenter="hoverHotspot(id)"
        @pointerleave="hoverHotspot(null)"
      >
        <span class="home-scene3d__label">
          <i />{{ HOME_DEVICES[id].name }}
        </span>
      </button>
    </div>
    <Transition name="toolbar">
      <div
        v-if="showToolbar && selectedPlacement"
        class="home-scene3d__toolbar"
        role="toolbar"
        :aria-label="`${HOME_DEVICES[selectedPlacement.deviceId].name}摆放操作`"
      >
        <strong>{{ HOME_DEVICES[selectedPlacement.deviceId].name }}</strong>
        <button v-if="canRotate" type="button" title="旋转 (R)" @click="emit('rotate', selectedPlacement.deviceId)">
          <span class="i-carbon-rotate-clockwise" />旋转
        </button>
        <button type="button" title="移出房间 (Delete)" @click="emit('remove', selectedPlacement.deviceId)">
          <span class="i-carbon-logout" />移出房间
        </button>
      </div>
    </Transition>
    <Transition name="toolbar">
      <div
        v-if="showFurnitureToolbar && selectedFurniture"
        class="home-scene3d__toolbar"
        role="toolbar"
        :aria-label="`${FURNITURE_KINDS[selectedFurniture.kind].name}摆放操作，方向键移动，R 旋转，Delete 移除`"
        @keydown="handleFurnitureKeydown"
      >
        <strong>{{ FURNITURE_KINDS[selectedFurniture.kind].name }}</strong>
        <button type="button" title="旋转 (R)" @click="emit('rotateFurniture', selectedFurniture.id)">
          <span class="i-carbon-rotate-clockwise" />旋转
        </button>
        <button type="button" title="移除 (Delete)" @click="emit('removeFurniture', selectedFurniture.id)">
          <span class="i-carbon-trash-can" />移除
        </button>
        <button type="button" title="完成 (Esc)" aria-label="取消选择" @click="emit('selectFurniture', null)">
          <span class="i-carbon-close" />
        </button>
      </div>
    </Transition>
    <Transition name="toolbar">
      <div v-if="showFurnitureBar" class="home-scene3d__toolbar is-furniture" role="toolbar" aria-label="家具">
        <button type="button" :aria-expanded="barMenu === 'catalogue'" aria-haspopup="menu" @click="toggleMenu('catalogue')">
          <span class="i-carbon-add" />添加家具
        </button>
        <button type="button" :aria-expanded="barMenu === 'reset'" aria-haspopup="menu" @click="toggleMenu('reset')">
          <span class="i-carbon-reset" />重置
        </button>
        <div v-if="barMenu === 'catalogue'" class="home-scene3d__catalogue" role="menu" aria-label="添加到当前房间" @keydown.esc="barMenu = null">
          <button v-for="kind in FURNITURE_CATALOGUE" :key="kind" type="button" role="menuitem" @click="chooseFurniture(kind)">
            {{ FURNITURE_KINDS[kind].name }}
          </button>
        </div>
        <div v-if="barMenu === 'reset'" class="home-scene3d__catalogue is-list" role="menu" aria-label="重置" @keydown.esc="barMenu = null">
          <button
            v-for="scope in (['furniture', 'devices', 'all'] as const)"
            :key="scope"
            type="button"
            role="menuitem"
            :class="{ 'is-confirm': pendingReset === scope }"
            @click="chooseReset(scope)"
          >
            <strong>{{ pendingReset === scope ? `确定${RESET_LABELS[scope]}？` : RESET_LABELS[scope] }}</strong>
            <small>{{ pendingReset === scope ? '再点一次确认，之后可以撤销' : RESET_HINTS[scope] }}</small>
          </button>
        </div>
      </div>
    </Transition>
    <p v-if="editMode && !showToolbar && !showFurnitureToolbar" class="home-scene3d__hint is-edit">
      <span class="i-carbon-move" />
      拖动设备或家具 · 空白处拖动平移 · 右键旋转
    </p>
    <p v-else-if="!editMode" class="home-scene3d__hint" aria-hidden="true">
      <span class="i-carbon-touch-interaction" />
      <span class="is-desktop">拖动平移 · 右键旋转 · 滚轮缩放 · 点击设备控制</span>
      <span class="is-phone">拖动旋转 · 双指缩放 · 点击设备控制</span>
    </p>
  </section>
</template>

<style scoped>
.home-scene3d {
  position: relative;
  overflow: hidden;
  width: min(100%, calc((100dvh - 222px) * 2));
  margin-inline: auto;
  aspect-ratio: 2 / 1;
  border: 1px solid var(--brand-line);
  border-radius: var(--ylf-radius-xl);
  box-shadow: var(--shadow-lg), inset 0 1px var(--brand-highlight);
  opacity: 0;
  transition: opacity 700ms var(--ease-out), background 1.6s ease;
}

.home-scene3d.is-ready { opacity: 1; }
.home-scene3d__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: pan-y;
}

.home-scene3d__canvas:active { cursor: grabbing; }

.home-scene3d__hotspots {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.home-scene3d__hotspot {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  padding: 0;
  border: 0;
  background: none;
  pointer-events: auto;
  cursor: pointer;
}

.home-scene3d__hotspot[data-visible="false"] { visibility: hidden; }

/* Dragging a device needs every touch move, so nothing pans the page while editing. */
.is-editing .home-scene3d__canvas { touch-action: none; }
.is-editing .home-scene3d__hotspot { cursor: grab; touch-action: none; }
.is-editing .home-scene3d__hotspot::before { top: -32px; left: -32px; width: 64px; height: 64px; }
.is-dragging .home-scene3d__canvas,
.is-dragging .home-scene3d__hotspot { cursor: grabbing; }
.is-over-furniture .home-scene3d__canvas { cursor: move; }

/* A generous invisible hit target around the device. */
.home-scene3d__hotspot::before {
  position: absolute;
  top: -26px;
  left: -26px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  content: '';
}

/* Selection ring. */
.home-scene3d__hotspot::after {
  position: absolute;
  top: -30px;
  left: -30px;
  width: 60px;
  height: 60px;
  border: 2px solid var(--brand-primary);
  border-radius: 50%;
  box-shadow: 0 0 0 6px rgba(var(--brand-focus-rgb), 0.16);
  content: '';
  opacity: 0;
  transform: scale(0.6);
  transition: opacity var(--dur-2) ease, transform var(--dur-3) var(--ease-spring);
}

.home-scene3d__hotspot[data-selected="true"]::after,
.home-scene3d__hotspot:focus-visible::after { opacity: 1; transform: scale(1); }
.home-scene3d__hotspot[data-selected="true"]::after { animation: hotspot-pulse 2.4s ease-in-out infinite; }
.home-scene3d__hotspot:focus-visible { outline: none; }

.home-scene3d__label {
  position: absolute;
  bottom: 38px;
  left: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid var(--brand-line);
  border-radius: 999px;
  background: var(--brand-glass-strong);
  box-shadow: var(--shadow-sm);
  color: var(--brand-ink);
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 6px) scale(0.92);
  transition: opacity var(--dur-2) ease, transform var(--dur-3) var(--ease-spring);
  backdrop-filter: blur(12px);
}

.home-scene3d__label > i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--brand-faint);
}

.home-scene3d__hotspot[data-active="true"] .home-scene3d__label > i {
  background: var(--tone-active);
  box-shadow: 0 0 0 3px var(--tone-active-soft);
}

.is-editing .home-scene3d__label,
.home-scene3d__hotspot[data-hovered="true"] .home-scene3d__label,
.home-scene3d__hotspot[data-selected="true"] .home-scene3d__label,
.home-scene3d__hotspot:focus-visible .home-scene3d__label {
  opacity: 1;
  transform: translate(-50%, 0) scale(1);
}

.home-scene3d__hotspot[data-invalid="true"] .home-scene3d__label {
  border-color: color-mix(in oklab, var(--tone-danger) 60%, transparent);
  color: var(--tone-danger);
}

.home-scene3d__toolbar {
  position: absolute;
  right: 12px;
  bottom: 10px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 4px 4px 12px;
  border: 1px solid var(--brand-line);
  border-radius: 999px;
  background: var(--brand-glass-strong);
  box-shadow: var(--shadow-md);
  color: var(--brand-ink);
  font-size: 11px;
  backdrop-filter: blur(12px);
}

.home-scene3d__toolbar strong { margin-right: 6px; font-weight: 700; }

.home-scene3d__toolbar button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 32px;
  padding: 0 11px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 650;
  cursor: pointer;
  transition: background var(--dur-1) ease;
}

.home-scene3d__toolbar button > span { font-size: 14px; }
.home-scene3d__toolbar button:hover,
.home-scene3d__toolbar button:focus-visible { background: var(--brand-glass-sunken); outline: none; }

.home-scene3d__toolbar.is-furniture { padding-left: 4px; }

.home-scene3d__reset-view {
  position: absolute;
  top: 12px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid var(--brand-line);
  border-radius: 999px;
  background: var(--brand-glass-strong);
  box-shadow: var(--shadow-sm);
  color: var(--brand-ink);
  font: inherit;
  font-size: 11px;
  font-weight: 650;
  cursor: pointer;
  backdrop-filter: blur(12px);
}

.home-scene3d__reset-view > span { font-size: 14px; }
.home-scene3d__reset-view:hover,
.home-scene3d__reset-view:focus-visible { background: var(--brand-glass-sunken); outline: none; }
.home-scene3d__hint .is-phone { display: none; }

.home-scene3d__catalogue {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2px;
  width: max-content;
  max-width: calc(100vw - 48px);
  padding: 6px;
  border: 1px solid var(--brand-line);
  border-radius: 16px;
  background: var(--brand-glass-strong);
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(12px);
}

.home-scene3d__catalogue button { justify-content: center; min-width: 72px; }
.home-scene3d__catalogue.is-list { grid-template-columns: 1fr; min-width: 200px; }
.home-scene3d__catalogue.is-list button { display: grid; justify-content: start; gap: 1px; min-height: 44px; padding: 6px 12px; border-radius: 12px; text-align: left; }
.home-scene3d__catalogue.is-list small { color: var(--brand-muted); font-size: 10px; font-weight: 500; }
.home-scene3d__catalogue.is-list button.is-confirm { background: color-mix(in oklab, var(--tone-danger) 12%, transparent); color: var(--tone-danger); }

.toolbar-enter-active { transition: opacity var(--dur-2) ease, translate var(--dur-3) var(--ease-spring); }
.toolbar-leave-active { transition: opacity var(--dur-1) ease, translate var(--dur-2) ease; }
.toolbar-enter-from, .toolbar-leave-to { opacity: 0; translate: 0 8px; }

.home-scene3d__hint {
  position: absolute;
  bottom: 12px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 6px 11px;
  border-radius: 999px;
  background: var(--brand-glass);
  color: var(--brand-muted);
  font-size: 10px;
  font-weight: 600;
  pointer-events: none;
  backdrop-filter: blur(10px);
  animation: hint-fade 6s var(--ease-out) 1.2s forwards;
}

@keyframes hotspot-pulse {
  50% { box-shadow: 0 0 0 11px rgba(var(--brand-focus-rgb), 0.06); }
}

.home-scene3d__hint.is-edit {
  background: var(--brand-glass-strong);
  box-shadow: var(--shadow-sm);
  color: var(--brand-ink);
  font-size: 11px;
  animation: none;
}

@keyframes hint-fade {
  0%, 70% { opacity: 1; }
  100% { opacity: 0; }
}

@media (max-width: 720px) {
  .home-scene3d { width: 100%; aspect-ratio: 1 / 1; border-radius: 24px; }
  /* The furniture bar takes the bottom edge on phones. */
  .home-scene3d__hint.is-edit { display: none; }
  .home-scene3d__hint .is-desktop { display: none; }
  .home-scene3d__hint .is-phone { display: inline; }
}

@media (min-width: 721px) and (max-height: 850px) {
  .home-scene3d { width: min(100%, calc((100dvh - 222px) * 2)); }
}

@media (prefers-reduced-motion: reduce) {
  .home-scene3d__hotspot[data-selected="true"]::after,
  .home-scene3d { transition: none; }
  .home-scene3d__hint { animation: none; }
  .toolbar-enter-active, .toolbar-leave-active { transition: none; }
}
</style>
