<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import HomeDeviceGlyph from './HomeDeviceGlyph.vue'
import { HOME_DEVICES, HOME_DEVICE_ORDER } from '~/constants/home'
import type { DeviceKind, DevicePlacement, HomeRoom } from '~/types'

const props = defineProps<{
  placements: DevicePlacement[]
  selectedDeviceId: DeviceKind | null
  rooms: HomeRoom[]
  activeRoomId: string | null
  activeRoomName: string
  editMode: boolean
  activeDevices: DeviceKind[]
}>()

const emit = defineEmits<{
  select: [deviceId: DeviceKind]
  dragStart: [deviceId: DeviceKind, event: PointerEvent]
  dragMove: [deviceId: DeviceKind, event: PointerEvent]
  dragEnd: [deviceId: DeviceKind, event: PointerEvent]
  moveRoom: [deviceId: DeviceKind, roomId: string]
  requestEdit: []
}>()

const dragging = shallowRef<DeviceKind | null>(null)
const roomNameById = computed(() => Object.fromEntries(props.rooms.map(room => [room.id, room.name])))
const devices = computed(() => HOME_DEVICE_ORDER.map((deviceId) => {
  const placement = props.placements.find(item => item.deviceId === deviceId)
  return {
    ...HOME_DEVICES[deviceId],
    placement,
    placed: Boolean(placement?.surfaceId),
    active: props.activeDevices.includes(deviceId),
    roomName: placement?.roomId ? roomNameById.value[placement.roomId] : '',
  }
}))
const unplacedDevices = computed(() => devices.value.filter(device => !device.placed))
const currentDevices = computed(() => devices.value.filter((device) => {
  if (!device.placed)
    return false
  return props.activeRoomId === null || device.placement?.roomId === props.activeRoomId
}))
const groups = computed(() => {
  if (!props.editMode)
    return [{ id: 'current', title: '', devices: currentDevices.value }]
  return [
    { id: 'unplaced', title: '待安置', devices: unplacedDevices.value },
    { id: 'current', title: props.activeRoomId ? '本房间' : '已安置', devices: currentDevices.value },
  ].filter(group => group.devices.length > 0)
})
const headingSubtitle = computed(() => {
  if (props.editMode)
    return unplacedDevices.value.length > 0 ? `${unplacedDevices.value.length} 台待安置` : '拖动设备调整位置'
  return `${currentDevices.value.length} 台设备已连接`
})

function deviceSubtitle(device: typeof devices.value[number]) {
  if (!device.placed)
    return '待安置 · 点击后再点房间'
  if (props.editMode)
    return `${device.roomName} · 可拖动调整`
  return device.active ? '运行中 · 点击控制' : `${device.roomName} · 在线`
}

function onPointerDown(deviceId: DeviceKind, placed: boolean, event: PointerEvent) {
  emit('select', deviceId)
  if (placed)
    return
  dragging.value = deviceId
  if (event.currentTarget instanceof HTMLElement)
    event.currentTarget.setPointerCapture(event.pointerId)
  emit('dragStart', deviceId, event)
}

function onPointerMove(deviceId: DeviceKind, event: PointerEvent) {
  if (dragging.value === deviceId)
    emit('dragMove', deviceId, event)
}

function onPointerUp(deviceId: DeviceKind, event: PointerEvent) {
  if (dragging.value !== deviceId)
    return
  dragging.value = null
  emit('dragEnd', deviceId, event)
}

function onRoomChange(deviceId: DeviceKind, event: Event) {
  const roomId = (event.target as HTMLSelectElement).value
  if (roomId)
    emit('moveRoom', deviceId, roomId)
}
</script>

<template>
  <aside class="device-tray" aria-label="智能设备库">
    <div class="device-tray__heading">
      <span>{{ activeRoomName }}</span><small>{{ headingSubtitle }}</small>
    </div>

    <div v-if="groups.some(group => group.devices.length > 0)" class="device-tray__groups">
      <section v-for="group in groups" :key="group.id" class="device-tray__group" :aria-label="group.title || activeRoomName">
        <header v-if="group.title" class="device-tray__group-title">
          {{ group.title }}<small>{{ group.devices.length }}</small>
        </header>
        <div class="device-tray__list">
          <div v-for="device in group.devices" :key="device.id" class="device-tray__card">
            <button
              class="device-tray__item"
              :class="{ 'is-selected': selectedDeviceId === device.id, 'is-dragging': dragging === device.id, 'is-active': device.active }"
              :data-placed="device.placed"
              :aria-label="`${device.name}，${deviceSubtitle(device)}`"
              :aria-pressed="selectedDeviceId === device.id"
              type="button"
              @click="emit('select', device.id)"
              @pointerdown="onPointerDown(device.id, device.placed, $event)"
              @pointermove="onPointerMove(device.id, $event)"
              @pointerup="onPointerUp(device.id, $event)"
              @pointercancel="onPointerUp(device.id, $event)"
            >
              <span class="device-tray__image"><HomeDeviceGlyph :device-id="device.id" :active="device.active" :title="device.name" /></span>
              <span class="device-tray__copy"><strong>{{ device.name }}</strong><small>{{ deviceSubtitle(device) }}</small></span>
              <span class="device-tray__badge" :class="device.active ? 'i-carbon-play-filled-alt' : device.placed ? 'i-carbon-checkmark-filled' : 'i-carbon-add-alt'" />
            </button>

            <label v-if="editMode" class="device-tray__room-select" @click.stop @pointerdown.stop>
              <span class="sr-only">设置{{ device.name }}所在房间</span>
              <span class="i-carbon-location" />
              <select :value="device.placement?.roomId ?? ''" @change="onRoomChange(device.id, $event)">
                <option value="" disabled>选择房间</option>
                <option v-for="room in rooms" :key="room.id" :value="room.id">
                  {{ room.shortName }}
                </option>
              </select>
              <span class="i-carbon-chevron-down" />
            </label>
          </div>
        </div>
      </section>
    </div>

    <div v-else class="device-tray__empty">
      <span class="i-carbon-cube" />
      <span><strong>这个房间还没有设备</strong><small>进入编辑模式，把已添加设备放进来</small></span>
      <button type="button" @click="emit('requestEdit')">
        安置设备
      </button>
    </div>

    <button v-if="!editMode && unplacedDevices.length" class="device-tray__unplaced" type="button" @click="emit('requestEdit')">
      <span class="i-carbon-inbox" />
      <span><strong>待安置设备</strong><small>{{ unplacedDevices.length }} 台设备等待选择房间</small></span>
      <span class="i-carbon-arrow-right" />
    </button>
  </aside>
</template>

<style scoped>
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
.device-tray { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 18px; margin: 0 22px 18px; padding: 12px 16px; border: 1px solid rgba(171, 186, 221, 0.6); border-radius: 22px; background: rgba(250, 252, 255, 0.92); box-shadow: 0 18px 54px rgba(58, 76, 119, 0.13); backdrop-filter: blur(18px); }
.device-tray__heading { display: grid; gap: 2px; min-width: 112px; padding-left: 4px; color: #34415d; }
.device-tray__heading span { font-size: 13px; font-weight: 750; }
.device-tray__heading small { color: #939db2; font-size: 10px; white-space: nowrap; }
.device-tray__groups { display: flex; align-items: stretch; gap: 14px; min-width: 0; overflow-x: auto; }
.device-tray__group { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 8px; min-width: 0; }
.device-tray__group + .device-tray__group { padding-left: 14px; border-left: 1px solid rgba(173, 185, 214, 0.38); }
.device-tray__group-title { display: grid; justify-items: center; gap: 4px; color: #7e89a0; font-size: 9px; font-weight: 700; white-space: nowrap; }
.device-tray__group-title small { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: #e6ebf6; color: #6e7fae; font-size: 8px; }
.device-tray__list { display: flex; gap: 9px; min-width: 0; }
.device-tray__card { position: relative; flex: 0 0 204px; min-width: 0; }
.device-tray__item { display: grid; grid-template-columns: 50px 1fr auto; align-items: center; gap: 9px; width: 100%; min-width: 0; height: 64px; padding: 6px 9px; border: 1px solid transparent; border-radius: 16px; background: rgba(239, 243, 252, 0.72); color: #3b4660; text-align: left; cursor: pointer; touch-action: none; transition: border-color 150ms ease, background 150ms ease, transform 150ms ease; }
.device-tray__item:hover, .device-tray__item.is-selected { border-color: rgba(121, 146, 222, 0.64); background: #f8faff; }
.device-tray__item.is-active { background: rgba(238, 249, 247, 0.9); }
.device-tray__item.is-dragging { transform: scale(0.97); }
.device-tray__image { display: grid; place-items: center; overflow: hidden; width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(145deg, #ffffff, #edf2fc); }
.device-tray__image :deep(.device-glyph) { width: 88%; height: 88%; }
.device-tray__copy { display: grid; min-width: 0; gap: 3px; }
.device-tray__copy strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.device-tray__copy small { overflow: hidden; color: #8b96ac; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.device-tray__badge { color: #61bfa0; font-size: 15px; }
.device-tray__item.is-active .device-tray__badge { color: #4dbb98; }
.device-tray__item[data-placed="false"] .device-tray__badge { color: #7e92d8; }
.device-tray__room-select { position: absolute; z-index: 2; right: 7px; bottom: 5px; display: flex; align-items: center; gap: 3px; max-width: 96px; padding: 2px 5px; border: 1px solid rgba(161, 176, 211, 0.44); border-radius: 8px; background: rgba(250, 252, 255, 0.94); color: #7a89ad; font-size: 8px; }
.device-tray__room-select select { min-width: 0; border: 0; outline: 0; appearance: none; background: transparent; color: #667493; font: inherit; font-size: 8px; cursor: pointer; }
.device-tray__room-select > span:last-child { font-size: 8px; pointer-events: none; }
.device-tray__empty { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 64px; color: #77839d; }
.device-tray__empty > span:first-child { font-size: 24px; color: #91a2d1; }
.device-tray__empty > span:nth-child(2) { display: grid; gap: 2px; }
.device-tray__empty strong { font-size: 11px; }
.device-tray__empty small { color: #98a2b4; font-size: 9px; }
.device-tray__empty button { min-height: 32px; padding: 0 11px; border: 0; border-radius: 10px; background: #788bd3; color: white; font: inherit; font-size: 9px; font-weight: 700; cursor: pointer; }
.device-tray__unplaced { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; min-width: 178px; padding: 9px 10px; border: 1px solid rgba(123, 146, 216, 0.48); border-radius: 14px; background: rgba(239, 243, 255, 0.9); color: #596b9d; text-align: left; cursor: pointer; }
.device-tray__unplaced > span:nth-child(2) { display: grid; gap: 2px; }
.device-tray__unplaced strong { font-size: 10px; }
.device-tray__unplaced small { color: #8794b4; font-size: 8px; }

@media (max-width: 980px) {
  .device-tray { grid-template-columns: 1fr; gap: 8px; }
  .device-tray__heading { display: flex; justify-content: space-between; }
  .device-tray__groups { overflow-x: auto; padding-bottom: 2px; }
  .device-tray__unplaced { grid-row: 2; width: 100%; }
}

@media (max-width: 720px) {
  .device-tray { margin: 0 10px 10px; padding: 10px; border-radius: 19px; }
  .device-tray__groups { gap: 10px; }
  .device-tray__group { grid-template-columns: 1fr; align-items: stretch; }
  .device-tray__group + .device-tray__group { padding-left: 10px; }
  .device-tray__group-title { display: flex; justify-content: flex-start; }
  .device-tray__card { flex-basis: 160px; }
  .device-tray__item { grid-template-columns: 44px 1fr; height: 60px; padding: 6px 8px; }
  .device-tray__image { width: 42px; height: 42px; }
  .device-tray__badge { display: none; }
  .device-tray__room-select { right: 5px; bottom: 4px; }
  .device-tray__empty { justify-content: flex-start; }
}
</style>
