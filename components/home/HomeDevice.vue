<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import HomeDeviceGlyph from './HomeDeviceGlyph.vue'
import type { DeviceTone } from '~/devices/types'
import type { DeviceKind, HomePoint } from '~/types'
import { HOME_DEVICES } from '~/constants/home'

const props = defineProps<{
  deviceId: DeviceKind
  point: HomePoint
  viewport: { x: number; y: number; width: number; height: number }
  rotation: number
  selected: boolean
  editMode: boolean
  active?: boolean
  invalid?: boolean
  tone?: DeviceTone
  /** Motion speed multiplier for the glyph */
  speed?: number
  /** Device state, passed to the plugin's glyph */
  state?: unknown
}>()

const emit = defineEmits<{
  select: [deviceId: DeviceKind]
  drag: [deviceId: DeviceKind, event: PointerEvent]
  drop: [deviceId: DeviceKind, event: PointerEvent]
  nudge: [deviceId: DeviceKind, deltaU: number, deltaV: number]
  rotate: [deviceId: DeviceKind]
  remove: [deviceId: DeviceKind]
}>()

const definition = computed(() => HOME_DEVICES[props.deviceId])
const dragging = shallowRef(false)
const moved = shallowRef(false)
const startPoint = shallowRef({ x: 0, y: 0 })
const style = computed(() => ({
  'left': `${((props.point.x - props.viewport.x) / props.viewport.width) * 100}%`,
  'top': `${((props.point.y - props.viewport.y) / props.viewport.height) * 100}%`,
  'width': `${(definition.value.width / props.viewport.width) * 100}%`,
  '--device-rotation': `${props.rotation}deg`,
}))

function onPointerDown(event: PointerEvent) {
  if (!props.editMode)
    return
  dragging.value = true
  moved.value = false
  startPoint.value = { x: event.clientX, y: event.clientY }
  if (event.currentTarget instanceof HTMLElement)
    event.currentTarget.setPointerCapture(event.pointerId)
  emit('select', props.deviceId)
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value)
    return
  if (Math.hypot(event.clientX - startPoint.value.x, event.clientY - startPoint.value.y) > 4)
    moved.value = true
  emit('drag', props.deviceId, event)
}

function onPointerUp(event: PointerEvent) {
  if (!dragging.value)
    return
  dragging.value = false
  emit('drop', props.deviceId, event)
}

function onClick() {
  if (!moved.value)
    emit('select', props.deviceId)
  moved.value = false
}

function onKeydown(event: KeyboardEvent) {
  const step = event.shiftKey ? 0.05 : 0.018
  if (event.key === 'ArrowLeft')
    emit('nudge', props.deviceId, -step, 0)
  else if (event.key === 'ArrowRight')
    emit('nudge', props.deviceId, step, 0)
  else if (event.key === 'ArrowUp')
    emit('nudge', props.deviceId, 0, -step)
  else if (event.key === 'ArrowDown')
    emit('nudge', props.deviceId, 0, step)
  else if (event.key.toLowerCase() === 'r')
    emit('rotate', props.deviceId)
  else if (event.key === 'Delete' || event.key === 'Backspace')
    emit('remove', props.deviceId)
  else
    return
  event.preventDefault()
}
</script>

<template>
  <button
    class="home-device"
    :class="{ 'is-selected': selected, 'is-dragging': dragging, 'is-active': active, 'is-invalid': invalid }"
    :data-device="deviceId"
    :data-tone="tone ?? 'idle'"
    :style="style"
    type="button"
    :aria-label="`${definition.name}${editMode ? '，可拖动摆放' : '，打开快捷控制'}`"
    @click="onClick"
    @keydown="onKeydown"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <span class="home-device__halo" />
    <span v-if="active" class="home-device__pulse" aria-hidden="true" />
    <HomeDeviceGlyph :device-id="deviceId" :active="active" :tone="tone" :title="definition.name" :speed="speed" :state="state" />
    <Transition name="status-pop">
      <span v-if="active" class="home-device__status" aria-label="设备运行中" />
    </Transition>
  </button>
</template>

<style scoped>
.home-device {
  --device-anchor-y: -62%;
  --device-tone: var(--tone-active);
  --device-lift: 0px;
  position: absolute;
  z-index: 4;
  display: grid;
  align-items: center;
  min-width: 34px;
  aspect-ratio: 1;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  filter: drop-shadow(0 9px 10px rgba(40, 49, 47, 0.2));
  transform: translate(-50%, calc(var(--device-anchor-y) + var(--device-lift))) rotate(var(--device-rotation));
  transform-origin: 50% 70%;
  transition: filter var(--dur-2) ease, transform var(--dur-3) var(--ease-spring);
  touch-action: none;
}

.home-device[data-tone="cool"] { --device-tone: var(--tone-cool); }
.home-device[data-tone="heat"] { --device-tone: var(--tone-heat); }
.home-device[data-tone="warm"] { --device-tone: var(--tone-warm); }

.home-device[data-device="air-conditioner"] { --device-anchor-y: -50%; }
.home-device[data-device="television"] { --device-anchor-y: -54%; aspect-ratio: 16 / 10; }
.home-device[data-device="robot-vacuum"] { --device-anchor-y: -54%; }
.home-device[data-device="fan"] { --device-anchor-y: -88%; }
.home-device[data-device="hand-warmer"] { --device-anchor-y: -88%; }

.home-device:hover,
.home-device:focus-visible,
.home-device.is-selected {
  --device-lift: -4px;
  z-index: 6;
  filter: drop-shadow(0 14px 18px color-mix(in oklab, var(--device-tone) 45%, transparent));
  outline: none;
}

.home-device.is-dragging {
  z-index: 8;
  transform: translate(-50%, var(--device-anchor-y)) rotate(var(--device-rotation)) scale(1.08);
  transition: none;
}

.home-device.is-invalid { filter: drop-shadow(0 0 8px color-mix(in oklab, var(--tone-danger) 90%, transparent)); }

.home-device :deep(.device-glyph) {
  position: relative;
  z-index: 2;
  width: 100%;
  pointer-events: none;
  user-select: none;
}

.home-device__halo {
  position: absolute;
  inset: -17%;
  border: 2px solid transparent;
  border-radius: 50%;
  background: color-mix(in oklab, var(--device-tone) 14%, transparent);
  opacity: 0;
  transform: scale(0.7);
  transition: opacity var(--dur-2) ease, transform var(--dur-3) var(--ease-spring);
}

.home-device.is-selected .home-device__halo,
.home-device:focus-visible .home-device__halo {
  border-color: color-mix(in oklab, var(--device-tone) 70%, transparent);
  opacity: 1;
  transform: scale(1);
}

/* Soft sonar ring while running */
.home-device__pulse {
  position: absolute;
  inset: -8%;
  border: 2px solid color-mix(in oklab, var(--device-tone) 55%, transparent);
  border-radius: 50%;
  animation: ripple-out 2.8s var(--ease-out) infinite;
  pointer-events: none;
}

.home-device__status {
  position: absolute;
  z-index: 3;
  top: -4px;
  right: -4px;
  width: 10px;
  height: 10px;
  border: 2px solid white;
  border-radius: 50%;
  background: var(--device-tone);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--device-tone) 24%, transparent);
}

.status-pop-enter-active { transition: transform var(--dur-3) var(--ease-spring), opacity var(--dur-2) ease; }
.status-pop-leave-active { transition: transform var(--dur-2) ease, opacity var(--dur-1) ease; }
.status-pop-enter-from, .status-pop-leave-to { opacity: 0; transform: scale(0); }
</style>
