<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import HomeDeviceGlyph from './HomeDeviceGlyph.vue'
import HomeRoomTabs from './HomeRoomTabs.vue'
import { HOME_DEVICES } from '~/constants/home'
import type { DeviceKind, HomePoint, HomeTemplateId } from '~/types'

interface SceneApi {
  getWorldPoint: (clientX: number, clientY: number) => HomePoint | null
}

const editor = useHomeEditor()
const robot = useDeviceState('robot-vacuum')
const airConditioner = useDeviceState('air-conditioner')
const fan = useDeviceState('fan')
const warmer = useDeviceState('hand-warmer')
const television = useDeviceState('television')
const sceneRef = shallowRef<SceneApi | null>(null)
const trayDrag = shallowRef<{ deviceId: DeviceKind; x: number; y: number } | null>(null)
const notice = shallowRef<string | null>(null)
const overviewMode = shallowRef(false)
let noticeTimer: ReturnType<typeof setTimeout> | undefined

const robotState = computed(() => robot.state.value)
const currentRoom = computed(() => editor.template.value.rooms.find(room => room.id === editor.activeRoomId.value) ?? editor.template.value.rooms[0])
const trayRoomId = computed(() => overviewMode.value ? null : editor.activeRoomId.value)
const trayRoomName = computed(() => overviewMode.value ? '全屋设备' : currentRoom.value?.name ?? '我的设备')
const activeDevices = computed<DeviceKind[]>(() => {
  const active: DeviceKind[] = []
  if (airConditioner.state.value.status)
    active.push('air-conditioner')
  if (fan.state.value.power)
    active.push('fan')
  if (robotState.value.status === 'cleaning' || robotState.value.status === 'returning')
    active.push('robot-vacuum')
  if (warmer.state.value.power)
    active.push('hand-warmer')
  if (television.state.value.power)
    active.push('television')
  return active
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
      <HomeDeviceGlyph :device-id="trayDrag.deviceId" />
    </div>
  </div>
</template>

<style scoped>
.home-experience { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; min-height: 100%; overflow: hidden; background: radial-gradient(circle at 18% 0%, rgba(222, 232, 255, 0.95), transparent 30%), linear-gradient(155deg, #f8faff 0%, #edf2fc 55%, #f7f4fb 100%); color: #303b55; }
.home-stage { position: relative; display: grid; align-items: center; min-height: 0; padding: 0 22px 14px; }
.home-stage__control { position: absolute; z-index: 12; top: 50%; right: 42px; transform: translateY(-50%); }
.home-notice { position: absolute; z-index: 16; bottom: 28px; left: 50%; padding: 9px 14px; border: 1px solid rgba(255, 255, 255, 0.72); border-radius: 999px; background: rgba(46, 57, 83, 0.82); box-shadow: 0 10px 30px rgba(38, 48, 75, 0.24); color: white; font-size: 11px; transform: translateX(-50%); backdrop-filter: blur(12px); }
.device-drag-ghost { position: fixed; z-index: 100; display: grid; place-items: center; width: 88px; height: 88px; border: 1px solid rgba(126, 149, 219, 0.5); border-radius: 50%; background: rgba(247, 250, 255, 0.82); box-shadow: 0 15px 34px rgba(53, 72, 122, 0.25); pointer-events: none; transform: translate(-50%, -50%); backdrop-filter: blur(12px); }
.device-drag-ghost :deep(.device-glyph) { width: 76%; height: 76%; }
.control-panel-enter-active, .control-panel-leave-active { transition: opacity 180ms ease, transform 180ms ease; }
.control-panel-enter-from, .control-panel-leave-to { opacity: 0; transform: translate(18px, -50%); }
.notice-enter-active, .notice-leave-active { transition: opacity 160ms ease, transform 160ms ease; }
.notice-enter-from, .notice-leave-to { opacity: 0; transform: translate(-50%, 8px); }
@media (min-width: 721px) and (max-height: 850px) { .home-stage { max-height: calc(100vh - 206px); } }
@media (max-width: 720px) {
  .home-experience { display: block; min-height: 100%; overflow-y: auto; padding-bottom: env(safe-area-inset-bottom); }
  .home-stage { display: block; padding: 0 10px 12px; }
  .home-stage__control { position: fixed; z-index: 40; top: auto; right: 0; bottom: 0; left: 0; max-height: 76vh; overflow-y: auto; transform: none; }
  .home-notice { position: fixed; bottom: 84px; white-space: nowrap; }
  .control-panel-enter-from, .control-panel-leave-to { transform: translateY(24px); }
}
</style>
