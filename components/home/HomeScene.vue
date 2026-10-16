<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import HomeSceneArt from './HomeSceneArt.vue'
import type { DeviceTone } from '~/devices/types'
import type { DeviceKind, DevicePlacement, HomePoint, HomeTemplate } from '~/types'
import { createPlacementAtPoint, getPointAlongRoute, getRobotRoute, placementToWorld } from '~/utils/home'

const props = defineProps<{
  template: HomeTemplate
  placements: DevicePlacement[]
  selectedDeviceId: DeviceKind | null
  activeRoomId: string | null
  overviewMode: boolean
  editMode: boolean
  robotProgress: number
  robotCleaning: boolean
  activeDevices: DeviceKind[]
  deviceTones?: Partial<Record<DeviceKind, DeviceTone>>
}>()

const emit = defineEmits<{
  select: [deviceId: DeviceKind]
  place: [deviceId: DeviceKind, point: HomePoint]
  nudge: [deviceId: DeviceKind, deltaU: number, deltaV: number]
  rotate: [deviceId: DeviceKind]
  remove: [deviceId: DeviceKind]
  roomSelect: [roomId: string]
}>()

const sceneRef = shallowRef<HTMLElement | null>(null)
const mobile = shallowRef(false)
const viewportRevision = shallowRef(0)
const draggingDeviceId = shallowRef<DeviceKind | null>(null)
const previewPoint = shallowRef<HomePoint | null>(null)

watch(mobile, () => {
  viewportRevision.value += 1
})

function updateMobileViewport() {
  mobile.value = window.innerWidth <= 720
}

onMounted(() => {
  updateMobileViewport()
  window.addEventListener('resize', updateMobileViewport)
})

onUnmounted(() => {
  cancelAnimationFrame(cameraFrame)
  window.removeEventListener('resize', updateMobileViewport)
})

interface SceneViewport { x: number, y: number, width: number, height: number }

const targetViewport = computed<SceneViewport>(() => {
  if (!mobile.value && props.overviewMode)
    return { x: 0, y: 0, width: props.template.width, height: props.template.height }
  const room = props.template.rooms.find(item => item.id === props.activeRoomId) ?? props.template.rooms[0]
  const minimumWidth = mobile.value ? 620 : 700
  const roomPadding = mobile.value ? 0 : 160
  const width = Math.min(props.template.width, Math.max(minimumWidth, (room?.width ?? minimumWidth) + roomPadding))
  const center = (room?.x ?? 0) + (room?.width ?? width) / 2
  return {
    x: Math.max(0, Math.min(props.template.width - width, center - width / 2)),
    y: 0,
    width,
    height: props.template.height,
  }
})

// The camera glides between rooms; every overlay is positioned from this tweened viewport.
const CAMERA_DURATION = 620
const viewport = shallowRef<SceneViewport>(targetViewport.value)
let cameraFrame = 0

function sameViewport(a: SceneViewport, b: SceneViewport) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

watch(targetViewport, (to) => {
  if (sameViewport(viewport.value, to))
    return
  cancelAnimationFrame(cameraFrame)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    viewport.value = to
    return
  }
  const from = viewport.value
  const startedAt = performance.now()
  const step = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / CAMERA_DURATION)
    const eased = 1 - (1 - progress) ** 4
    viewport.value = {
      x: from.x + (to.x - from.x) * eased,
      y: from.y + (to.y - from.y) * eased,
      width: from.width + (to.width - from.width) * eased,
      height: from.height + (to.height - from.height) * eased,
    }
    if (progress < 1)
      cameraFrame = requestAnimationFrame(step)
  }
  cameraFrame = requestAnimationFrame(step)
})

const viewBox = computed(() => `${viewport.value.x} ${viewport.value.y} ${viewport.value.width} ${viewport.value.height}`)
const sceneStyle = computed(() => ({ aspectRatio: `${viewport.value.width} / ${viewport.value.height}` }))
const sceneShellStyle = computed(() => {
  if (mobile.value || props.overviewMode)
    return undefined
  return {
    width: `min(100%, calc((100dvh - 222px) * ${viewport.value.width / viewport.value.height}))`,
    marginInline: 'auto',
  }
})
const robotPlacement = computed(() => props.placements.find(item => item.deviceId === 'robot-vacuum'))
const robotRoute = computed(() => getRobotRoute(props.template, robotPlacement.value))
const robotRoutePoints = computed(() => robotRoute.value.map(point => `${point.x},${point.y}`).join(' '))
const robotVisualPoint = computed(() => props.robotCleaning ? getPointAlongRoute(robotRoute.value, props.robotProgress) : null)
const robotDockStyle = computed(() => {
  const point = robotPlacement.value ? placementToWorld(props.template, robotPlacement.value) : null
  if (!point)
    return undefined
  return {
    left: `${((point.x - viewport.value.x) / viewport.value.width) * 100}%`,
    top: `${((point.y - viewport.value.y) / viewport.value.height) * 100}%`,
  }
})

const visiblePlacements = computed(() => props.placements
  .filter(placement => placement.surfaceId)
  .map((placement) => {
    let point = placementToWorld(props.template, placement)
    if (placement.deviceId === 'robot-vacuum' && robotVisualPoint.value)
      point = robotVisualPoint.value
    if (placement.deviceId === draggingDeviceId.value && previewPoint.value)
      point = previewPoint.value
    return { placement, point }
  })
  .filter(item => item.point !== null) as Array<{ placement: DevicePlacement; point: HomePoint }>)

const previewValid = computed(() => {
  if (!draggingDeviceId.value || !previewPoint.value)
    return true
  return Boolean(createPlacementAtPoint(props.template, draggingDeviceId.value, previewPoint.value, props.placements))
})

function getWorldPoint(clientX: number, clientY: number): HomePoint | null {
  const rect = sceneRef.value?.getBoundingClientRect()
  if (!rect || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom)
    return null
  return {
    x: viewport.value.x + ((clientX - rect.left) / rect.width) * viewport.value.width,
    y: viewport.value.y + ((clientY - rect.top) / rect.height) * viewport.value.height,
  }
}

function handleDrag(deviceId: DeviceKind, event: PointerEvent) {
  draggingDeviceId.value = deviceId
  previewPoint.value = getWorldPoint(event.clientX, event.clientY)
}

function handleDrop(deviceId: DeviceKind, event: PointerEvent) {
  const point = getWorldPoint(event.clientX, event.clientY)
  if (point)
    emit('place', deviceId, point)
  draggingDeviceId.value = null
  previewPoint.value = null
}

function handleSceneClick(event: MouseEvent) {
  if (event.target instanceof Element && event.target.closest('.home-device'))
    return
  const point = getWorldPoint(event.clientX, event.clientY)
  if (!point)
    return

  if (props.editMode && props.selectedDeviceId) {
    const placement = props.placements.find(item => item.deviceId === props.selectedDeviceId)
    if (!placement?.surfaceId)
      emit('place', props.selectedDeviceId, point)
    return
  }

  if (!props.editMode) {
    const room = props.template.rooms.find(item => point.x >= item.x && point.x <= item.x + item.width)
    if (room)
      emit('roomSelect', room.id)
  }
}

defineExpose({ getWorldPoint })
</script>

<template>
  <section class="home-scene-shell" :style="sceneShellStyle" aria-label="云之彼端家园画布">
    <div ref="sceneRef" class="home-scene" :data-overview="overviewMode" :style="sceneStyle" @click="handleSceneClick">
      <svg :key="viewportRevision" class="home-scene__geometry" :viewBox="viewBox" preserveAspectRatio="none" aria-hidden="true">
        <HomeSceneArt :template-id="template.id" />

        <g v-if="editMode" class="home-scene__surfaces">
          <polygon
            v-for="surface in template.surfaces"
            :key="surface.id"
            :points="surface.polygon.map(point => `${point.x},${point.y}`).join(' ')"
            :data-active="selectedDeviceId ? surface.accepts.includes(selectedDeviceId) : false"
          />
        </g>

        <g v-if="robotCleaning && robotRoutePoints" class="home-scene__route">
          <polyline :points="robotRoutePoints" />
        </g>
      </svg>

      <div v-if="editMode" class="home-scene__hint">
        <span class="i-carbon-move" />
        拖动设备，或点击高亮区域
      </div>

      <HomeDevice
        v-for="item in visiblePlacements"
        :key="item.placement.deviceId"
        :device-id="item.placement.deviceId"
        :point="item.point"
        :viewport="viewport"
        :rotation="item.placement.rotation"
        :selected="selectedDeviceId === item.placement.deviceId"
        :edit-mode="editMode"
        :active="activeDevices.includes(item.placement.deviceId)"
        :tone="deviceTones?.[item.placement.deviceId]"
        :invalid="draggingDeviceId === item.placement.deviceId && !previewValid"
        @select="emit('select', $event)"
        @drag="handleDrag"
        @drop="handleDrop"
        @nudge="(deviceId, deltaU, deltaV) => emit('nudge', deviceId, deltaU, deltaV)"
        @rotate="emit('rotate', $event)"
        @remove="emit('remove', $event)"
      />

      <div v-if="robotCleaning && robotPlacement" class="home-scene__dock" :style="robotDockStyle" role="img" aria-label="扫地机器人充电基站">
        <span class="i-carbon-charging-station" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-scene-shell {
  position: relative;
  overflow: hidden;
  min-width: 0;
  border: 1px solid var(--brand-line);
  border-radius: 30px;
  background: #eef0ea;
  box-shadow: var(--shadow-lg), inset 0 1px var(--brand-highlight);
}

.home-scene {
  position: relative;
  overflow: hidden;
  width: 100%;
  user-select: none;
}

.home-scene[data-overview="true"] { cursor: zoom-in; }

.home-scene::after {
  position: absolute;
  z-index: 2;
  inset: 0;
  background:
    radial-gradient(120% 60% at 50% -10%, rgba(255, 252, 240, 0.32), transparent 60%),
    linear-gradient(180deg, transparent 60%, rgba(40, 49, 47, 0.06));
  content: '';
  pointer-events: none;
}

.home-scene__geometry {
  position: absolute;
  z-index: 1;
  inset: 0;
  width: 100%;
  height: 100%;
}

.home-scene__surfaces polygon {
  fill: rgba(104, 123, 103, 0.05);
  stroke: rgba(104, 123, 103, 0.28);
  stroke-dasharray: 10 9;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.home-scene__surfaces polygon[data-active="true"] {
  fill: rgba(104, 123, 103, 0.16);
  stroke: rgba(104, 123, 103, 0.85);
  animation: surface-pulse 1.8s ease-in-out infinite;
}

.home-scene__route polyline {
  fill: none;
  stroke: rgba(95, 147, 158, 0.9);
  stroke-dasharray: 12 10;
  stroke-linecap: round;
  stroke-width: 4;
  vector-effect: non-scaling-stroke;
  animation: route-move 1s linear infinite;
}

.home-scene__hint {
  position: absolute;
  z-index: 7;
  top: 16px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  border: 1px solid var(--brand-line);
  border-radius: 999px;
  background: var(--brand-glass-strong);
  box-shadow: var(--shadow-md);
  color: var(--brand-ink);
  animation: rise-in var(--dur-3) var(--ease-out);
  font-size: 12px;
  font-weight: 650;
  transform: translateX(-50%);
  backdrop-filter: blur(12px);
}

.home-scene__dock {
  position: absolute;
  z-index: 3;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--brand-line-strong);
  border-radius: 9px;
  background: var(--brand-glass-strong);
  box-shadow: var(--shadow-sm);
  color: var(--brand-secondary);
  font-size: 17px;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

@keyframes surface-pulse {
  50% { fill: rgba(104, 123, 103, 0.26); }
}

@keyframes route-move {
  to { stroke-dashoffset: -22; }
}

@media (max-width: 720px) {
  .home-scene-shell { border-radius: 24px; }
  .home-scene__hint { top: 10px; white-space: nowrap; }
}

@media (min-width: 721px) and (max-height: 850px) {
  .home-scene-shell {
    width: min(100%, calc((100dvh - 222px) * 2));
    margin-inline: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-scene__surfaces polygon[data-active="true"],
  .home-scene__route polyline { animation: none; }
}
</style>
