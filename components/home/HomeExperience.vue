<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import HomeDeviceGlyph from './HomeDeviceGlyph.vue'
import HomeRoomTabs from './HomeRoomTabs.vue'
import type { DeviceTone } from '~/devices/types'
import type { DeviceKind, HomePoint, HomeTemplateId } from '~/types'
import { HOME_DEVICES, HOME_DEVICE_ORDER } from '~/constants/home'
import { getDeviceTone, isDeviceRunning } from '~/utils/device'

interface SceneApi {
  getWorldPoint: (clientX: number, clientY: number) => HomePoint | null
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
const sceneRef = shallowRef<SceneApi | null>(null)
const trayDrag = shallowRef<{ deviceId: DeviceKind; x: number; y: number } | null>(null)
const notice = shallowRef<string | null>(null)
const overviewMode = shallowRef(false)
let noticeTimer: ReturnType<typeof setTimeout> | undefined

const robotState = computed(() => robot.state.value)
const currentRoom = computed(() => editor.template.value.rooms.find(room => room.id === editor.activeRoomId.value) ?? editor.template.value.rooms[0])
const trayRoomId = computed(() => overviewMode.value ? null : editor.activeRoomId.value)
const trayRoomName = computed(() => overviewMode.value ? '全屋设备' : currentRoom.value?.name ?? '我的设备')
const activeDevices = computed<DeviceKind[]>(() => HOME_DEVICE_ORDER.filter(kind => isDeviceRunning(kind, deviceStates[kind].state.value)))
const deviceTones = computed(() => Object.fromEntries(
  HOME_DEVICE_ORDER.map(kind => [kind, getDeviceTone(kind, deviceStates[kind].state.value)]),
) as Record<DeviceKind, DeviceTone>)

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
  if (trayDrag.value?.deviceId === deviceId)
    trayDrag.value = { deviceId, x: event.clientX, y: event.clientY }
}

function handleTrayDragEnd(deviceId: DeviceKind, event: PointerEvent) {
  const point = sceneRef.value?.getWorldPoint(event.clientX, event.clientY)
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
  const unplaced = editor.placements.value.find(placement => !placement.surfaceId)
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
      @change-template="changeTemplate"
      @toggle-edit="toggleEditMode"
      @undo="editor.undo"
      @redo="editor.redo"
    />

    <main class="home-stage">
      <HomeRoomTabs
        :rooms="editor.template.value.rooms"
        :placements="editor.placements.value"
        :active-room-id="editor.activeRoomId.value"
        :overview="overviewMode"
        @select-overview="selectOverview"
        @select-room="selectRoom"
      />

      <HomeScene
        ref="sceneRef"
        :template="editor.template.value"
        :placements="editor.placements.value"
        :selected-device-id="editor.selectedDeviceId.value"
        :active-room-id="editor.activeRoomId.value"
        :overview-mode="overviewMode"
        :edit-mode="editor.editMode.value"
        :robot-progress="robot.visualProgress.value"
        :robot-cleaning="robotState.status === 'cleaning'"
        :active-devices="activeDevices"
        :device-tones="deviceTones"
        @select="selectDevice"
        @place="placeDevice"
        @nudge="editor.moveDeviceByKeyboard"
        @rotate="editor.rotateDevice"
        @remove="editor.removeDevice"
        @room-select="selectRoom"
      />

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
      :placements="editor.placements.value"
      :selected-device-id="editor.selectedDeviceId.value"
      :rooms="editor.template.value.rooms"
      :active-room-id="trayRoomId"
      :active-room-name="trayRoomName"
      :edit-mode="editor.editMode.value"
      :active-devices="activeDevices"
      :device-tones="deviceTones"
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
      <HomeDeviceGlyph :device-id="trayDrag.deviceId" :tone="deviceTones[trayDrag.deviceId]" />
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

.home-stage__control { position: absolute; z-index: 12; top: 50%; right: 42px; transform: translateY(-50%); }
.home-notice { position: absolute; z-index: 16; bottom: 28px; left: 50%; display: flex; align-items: center; gap: 8px; padding: 10px 16px; border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 999px; background: color-mix(in oklab, var(--brand-primary) 88%, transparent); box-shadow: var(--shadow-md); color: white; font-size: 11px; font-weight: 600; transform: translateX(-50%); backdrop-filter: blur(12px); }
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
