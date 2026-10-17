<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import HomeDeviceGlyph from './HomeDeviceGlyph.vue'
import HomeRoomTabs from './HomeRoomTabs.vue'
import type { DeviceTone } from '~/devices/types'
import type { DeviceKind, HomePoint, HomeTemplateId } from '~/types'
import type { DeviceVisual } from '~/utils/scene3d/devices'
import { HOME_DEVICES, HOME_DEVICE_ORDER } from '~/constants/home'
import { getDeviceMotionSpeed, getDeviceTone, isDeviceRunning } from '~/utils/device'

interface Scene2dApi {
  getWorldPoint: (clientX: number, clientY: number) => HomePoint | null
}

interface Scene3dApi {
  getWorldPoint: (clientX: number, clientY: number, deviceId: DeviceKind) => HomePoint | null
  previewDrop: (deviceId: DeviceKind, clientX: number, clientY: number) => void
  endDrag: () => void
}

const editor = useHomeEditor()
const robot = useDeviceState('robot-vacuum')
const deviceStates = {
  'air-conditioner': useDeviceState('air-conditioner'),
  'fan': useDeviceState('fan'),
  'robot-vacuum': robot,
  'hand-warmer': useDeviceState('hand-warmer'),
  'television': useDeviceState('television'),
}
const scene2dRef = shallowRef<Scene2dApi | null>(null)
const scene3dRef = shallowRef<Scene3dApi | null>(null)
const trayDrag = shallowRef<{ deviceId: DeviceKind; x: number; y: number } | null>(null)
const notice = shallowRef<string | null>(null)
const overviewMode = shallowRef(false)
let noticeTimer: ReturnType<typeof setTimeout> | undefined

const library = usePluginLibrary()
// Uninstalled plugins keep their placement and state, but leave the home.
const placements = computed(() => editor.placements.value.filter(placement => library.isInstalled(placement.deviceId)))
const sceneMode = useSceneMode()
const scene3dReady = shallowRef(false)
const mount3d = computed(() => sceneMode.mode.value === '3d')
const show2d = computed(() => !mount3d.value || !scene3dReady.value)
const use3d = computed(() => mount3d.value && scene3dReady.value)

const robotState = computed(() => robot.state.value)
const currentRoom = computed(() => editor.template.value.rooms.find(room => room.id === editor.activeRoomId.value) ?? editor.template.value.rooms[0])
const trayRoomId = computed(() => overviewMode.value ? null : editor.activeRoomId.value)
const trayRoomName = computed(() => overviewMode.value ? '全屋设备' : currentRoom.value?.name ?? '我的设备')
const activeDevices = computed<DeviceKind[]>(() => library.installed.value.filter(kind => isDeviceRunning(kind, deviceStates[kind].state.value)))
const deviceTones = computed(() => Object.fromEntries(
  HOME_DEVICE_ORDER.map(kind => [kind, getDeviceTone(kind, deviceStates[kind].state.value)]),
) as Record<DeviceKind, DeviceTone>)
const deviceStateMap = computed(() => Object.fromEntries(
  HOME_DEVICE_ORDER.map(kind => [kind, deviceStates[kind].state.value]),
) as Record<DeviceKind, unknown>)
const deviceMotionSpeeds = computed(() => Object.fromEntries(
  HOME_DEVICE_ORDER.map(kind => [kind, getDeviceMotionSpeed(kind, deviceStates[kind].state.value)]),
) as Record<DeviceKind, number>)
const deviceVisuals = computed(() => {
  const fan = deviceStates.fan.state.value
  const ac = deviceStates['air-conditioner']
  const visuals = Object.fromEntries(HOME_DEVICE_ORDER.map(kind => [kind, {
    active: activeDevices.value.includes(kind),
    tone: deviceTones.value[kind],
  }])) as Record<DeviceKind, DeviceVisual>
  visuals.fan = { ...visuals.fan, speed: fan.speed, oscillating: fan.oscillating }
  const temperature = ac.targetTemperature.value
  visuals['air-conditioner'] = { ...visuals['air-conditioner'], display: temperature === null ? '' : `${temperature}°` }
  return visuals
})

function showNotice(message: string) {
  notice.value = message
  if (noticeTimer)
    clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    notice.value = null
  }, 2400)
}

function selectDevice(deviceId: DeviceKind) {
  editor.selectedDeviceId.value = deviceId
  const placement = editor.placements.value.find(item => item.deviceId === deviceId)
  if (placement?.roomId) {
    editor.activeRoomId.value = placement.roomId
  }
  else {
    editor.editMode.value = true
    showNotice(`为${HOME_DEVICES[deviceId].name}选择房间，或拖到高亮区域`)
  }
}

function placeDevice(deviceId: DeviceKind, point: HomePoint) {
  const placed = editor.placeDevice(deviceId, point)
  showNotice(placed ? `${HOME_DEVICES[deviceId].name}已吸附到合适位置` : '这里不能摆放，设备已回到原位')
}

function handleTrayDragStart(deviceId: DeviceKind, event: PointerEvent) {
  editor.editMode.value = true
  editor.selectedDeviceId.value = deviceId
  trayDrag.value = { deviceId, x: event.clientX, y: event.clientY }
}

function handleTrayDragMove(deviceId: DeviceKind, event: PointerEvent) {
  if (trayDrag.value?.deviceId !== deviceId)
    return
  trayDrag.value = { deviceId, x: event.clientX, y: event.clientY }
  if (use3d.value)
    scene3dRef.value?.previewDrop(deviceId, event.clientX, event.clientY)
}

function handleTrayDragEnd(deviceId: DeviceKind, event: PointerEvent) {
  const point = use3d.value
    ? scene3dRef.value?.getWorldPoint(event.clientX, event.clientY, deviceId)
    : scene2dRef.value?.getWorldPoint(event.clientX, event.clientY)
  scene3dRef.value?.endDrag()
  trayDrag.value = null
  if (point)
    placeDevice(deviceId, point)
  else
    showNotice('拖到房间里的高亮区域即可完成摆放')
}

function changeTemplate(templateId: HomeTemplateId) {
  editor.changeTemplate(templateId)
  overviewMode.value = window.innerWidth > 720
  showNotice(`已切换到${editor.template.value.name}`)
}

function selectRoom(roomId: string) {
  editor.activeRoomId.value = roomId
  editor.selectedDeviceId.value = null
  overviewMode.value = false
}

function selectOverview() {
  editor.selectedDeviceId.value = null
  overviewMode.value = true
}

function toggleEditMode() {
  editor.editMode.value = !editor.editMode.value
  if (!editor.editMode.value)
    editor.selectedDeviceId.value = null
}

function requestEditMode() {
  editor.editMode.value = true
  const unplaced = placements.value.find(placement => !placement.surfaceId)
  if (unplaced)
    editor.selectedDeviceId.value = unplaced.deviceId
  showNotice(unplaced ? '选择房间即可自动安置，也可以拖到高亮区域' : '选择设备后，可直接在场景中拖动调整')
}

function moveDeviceToRoom(deviceId: DeviceKind, roomId: string) {
  const moved = editor.moveDeviceToRoom(deviceId, roomId)
  if (!moved) {
    showNotice('目标房间没有合适位置，请先移动其他设备')
    return
  }
  overviewMode.value = false
  showNotice(`${HOME_DEVICES[deviceId].name}已移动到${currentRoom.value?.shortName ?? '目标房间'}`)
}

function removeDevice(deviceId: DeviceKind) {
  editor.removeDevice(deviceId)
  showNotice(`${HOME_DEVICES[deviceId].name}已移出房间，可在待安置中重新摆放`)
}

function changeSceneMode(mode: '3d' | '2d') {
  sceneMode.setMode(mode)
  showNotice(mode === '3d' ? '已切换到 3D 家园，拖动可旋转视角' : '已切换到怀旧 2D 平面')
}

function handle3dFailed() {
  sceneMode.disable3d()
  scene3dReady.value = false
  showNotice('当前设备无法显示 3D，已切换到 2D')
}

watch(mount3d, (mounted) => {
  if (!mounted)
    scene3dReady.value = false
})

function handleViewportResize() {
  if (window.innerWidth <= 720)
    overviewMode.value = false
}

onMounted(() => {
  overviewMode.value = window.innerWidth > 720
  editor.selectedDeviceId.value = null
  window.addEventListener('resize', handleViewportResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleViewportResize)
})
</script>

<template>
  <div class="home-experience">
    <div class="home-ambient" aria-hidden="true">
      <span /><span /><span />
    </div>
    <HomeTopbar
      :template-id="editor.state.value.templateId"
      :sync-status="editor.syncStatus.value"
      :sync-enabled="editor.syncEnabled.value"
      :edit-mode="editor.editMode.value"
      :can-undo="editor.canUndo.value"
      :can-redo="editor.canRedo.value"
      :scene-mode="sceneMode.mode.value"
      :scene-mode-supported="sceneMode.supported.value"
      @change-template="changeTemplate"
      @change-scene-mode="changeSceneMode"
      @toggle-edit="toggleEditMode"
      @undo="editor.undo"
      @redo="editor.redo"
    />

    <main class="home-stage">
      <HomeRoomTabs
        :rooms="editor.template.value.rooms"
        :placements="placements"
        :active-room-id="editor.activeRoomId.value"
        :overview="overviewMode"
        @select-overview="selectOverview"
        @select-room="selectRoom"
      />

      <div class="home-scene-stack" :data-mode="mount3d ? '3d' : '2d'">
      <HomeScene
        v-if="show2d"
        ref="scene2dRef"
        :template="editor.template.value"
        :placements="placements"
        :selected-device-id="editor.selectedDeviceId.value"
        :active-room-id="editor.activeRoomId.value"
        :overview-mode="overviewMode"
        :edit-mode="editor.editMode.value"
        :robot-progress="robot.visualProgress.value"
        :robot-cleaning="robotState.status === 'cleaning'"
        :active-devices="activeDevices"
        :device-tones="deviceTones"
        :device-motion-speeds="deviceMotionSpeeds"
        :device-states="deviceStateMap"
        @select="selectDevice"
        @place="placeDevice"
        @nudge="editor.moveDeviceByKeyboard"
        @rotate="editor.rotateDevice"
        @remove="removeDevice"
        @room-select="selectRoom"
      />
      <ClientOnly>
        <HomeScene3D
          v-if="mount3d"
          ref="scene3dRef"
          :template="editor.template.value"
          :placements="placements"
          :selected-device-id="editor.selectedDeviceId.value"
          :active-room-id="editor.activeRoomId.value"
          :overview-mode="overviewMode"
          :active-devices="activeDevices"
          :visuals="deviceVisuals"
          :robot-progress="robot.visualProgress.value"
          :robot-cleaning="robotState.status === 'cleaning'"
          :edit-mode="editor.editMode.value"
          :inset-right="editor.selectedDeviceId.value && !editor.editMode.value ? 380 : 0"
          @select="selectDevice"
          @room-select="selectRoom"
          @place="placeDevice"
          @nudge="editor.moveDeviceByKeyboard"
          @rotate="editor.rotateDevice"
          @remove="removeDevice"
          @ready="scene3dReady = true"
          @failed="handle3dFailed"
        />
      </ClientOnly>
      </div>

      <Transition name="control-panel">
        <div v-if="editor.selectedDeviceId.value && !editor.editMode.value" class="home-stage__control">
          <HomeDeviceQuickControl :device-id="editor.selectedDeviceId.value" @close="editor.selectedDeviceId.value = null" />
        </div>
      </Transition>

      <Transition name="notice">
        <div v-if="notice" class="home-notice" role="status">
          {{ notice }}
        </div>
      </Transition>
    </main>

    <HomeDeviceTray
      :placements="placements"
      :selected-device-id="editor.selectedDeviceId.value"
      :rooms="editor.template.value.rooms"
      :active-room-id="trayRoomId"
      :active-room-name="trayRoomName"
      :edit-mode="editor.editMode.value"
      :active-devices="activeDevices"
      :device-tones="deviceTones"
      :device-ids="library.installed.value"
      :device-motion-speeds="deviceMotionSpeeds"
      @select="selectDevice"
      @drag-start="handleTrayDragStart"
      @drag-move="handleTrayDragMove"
      @drag-end="handleTrayDragEnd"
      @move-room="moveDeviceToRoom"
      @request-edit="requestEditMode"
    />

    <div
      v-if="trayDrag"
      class="device-drag-ghost"
      :style="{ left: `${trayDrag.x}px`, top: `${trayDrag.y}px` }"
      aria-hidden="true"
    >
      <HomeDeviceGlyph :device-id="trayDrag.deviceId" :tone="deviceTones[trayDrag.deviceId]" :state="deviceStateMap[trayDrag.deviceId]" />
    </div>
  </div>
</template>

<style scoped>
.home-experience { position: relative; isolation: isolate; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; min-height: 100%; overflow: hidden; background: var(--brand-page-background); color: var(--brand-ink); }
.home-experience > :deep(.home-topbar) { animation: rise-in var(--dur-3) var(--ease-out) backwards; }
.home-stage { position: relative; display: grid; align-items: center; min-height: 0; padding: 0 22px 14px; animation: rise-in var(--dur-4) var(--ease-out) 90ms backwards; }
.home-experience > :deep(.device-tray) { animation: rise-in var(--dur-3) var(--ease-out) 200ms backwards; }

/* Slow drifting light behind the glass, like clouds over a garden */
.home-ambient { position: absolute; z-index: -1; inset: 0; overflow: hidden; pointer-events: none; }
.home-ambient span { position: absolute; width: 46vmax; height: 46vmax; border-radius: 50%; filter: blur(60px); animation: ambient-drift 28s ease-in-out infinite; }
.home-ambient span:nth-child(1) { top: -18vmax; left: -10vmax; background: var(--ambient-a); }
.home-ambient span:nth-child(2) { top: -12vmax; right: -14vmax; background: var(--ambient-b); animation-duration: 34s; animation-delay: -9s; }
.home-ambient span:nth-child(3) { bottom: -24vmax; left: 30%; background: var(--ambient-c); animation-duration: 40s; animation-delay: -17s; }

.home-scene-stack { display: grid; min-width: 0; }
.home-scene-stack > * { grid-area: 1 / 1; }
.home-stage__control { position: absolute; z-index: 12; top: 50%; right: 42px; transform: translateY(-50%); }
.home-notice { position: absolute; z-index: 16; bottom: 28px; left: 50%; display: flex; align-items: center; gap: 8px; padding: 10px 16px; border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 999px; background: color-mix(in oklab, var(--brand-primary) 92%, transparent); box-shadow: var(--shadow-md); color: var(--ylf-c-text-on-accent); font-size: 11px; font-weight: 600; transform: translateX(-50%); backdrop-filter: blur(12px); }
.home-notice::before { width: 6px; height: 6px; border-radius: 50%; background: var(--brand-warm); content: ''; animation: breathe 1.6s ease-in-out infinite; }
.device-drag-ghost { position: fixed; z-index: 100; display: grid; place-items: center; width: 92px; height: 92px; border: 1px solid var(--brand-line-strong); border-radius: 50%; background: var(--brand-glass-strong); box-shadow: var(--shadow-lg); pointer-events: none; transform: translate(-50%, -50%) rotate(-4deg) scale(1.04); backdrop-filter: blur(12px); animation: ghost-in var(--dur-2) var(--ease-spring); }
.device-drag-ghost :deep(.device-glyph) { width: 76%; height: 76%; }
.control-panel-enter-active { transition: opacity var(--dur-2) var(--ease-out), transform var(--dur-3) var(--ease-spring), filter var(--dur-2) ease; }
.control-panel-leave-active { transition: opacity var(--dur-1) ease, transform var(--dur-2) var(--ease-out), filter var(--dur-1) ease; }
.control-panel-enter-from, .control-panel-leave-to { opacity: 0; filter: blur(6px); transform: translate(24px, -50%) scale(0.96); }
.notice-enter-active { transition: opacity var(--dur-2) ease, transform var(--dur-3) var(--ease-spring); }
.notice-leave-active { transition: opacity var(--dur-1) ease, transform var(--dur-2) ease; }
.notice-enter-from, .notice-leave-to { opacity: 0; transform: translate(-50%, 14px) scale(0.92); }
@keyframes ghost-in { from { opacity: 0; transform: translate(-50%, -50%) scale(0.6); } }
@media (min-width: 721px) and (max-height: 850px) { .home-stage { max-height: calc(100vh - 206px); } }
@media (max-width: 720px) {
  .home-experience { display: block; min-height: 100%; overflow-y: auto; padding-bottom: env(safe-area-inset-bottom); }
  .home-stage { display: block; padding: 0 10px 12px; }
  .home-stage__control { position: fixed; z-index: 40; top: auto; right: 0; bottom: 0; left: 0; max-height: 80vh; overflow-y: auto; transform: none; }
  .home-notice { position: fixed; bottom: 84px; white-space: nowrap; }
  .control-panel-enter-from, .control-panel-leave-to { filter: none; transform: translateY(100%); }
  .control-panel-enter-active { transition: transform var(--dur-3) var(--ease-out), opacity var(--dur-2) ease; }
}
</style>
