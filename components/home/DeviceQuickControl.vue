<script setup lang="ts">
import type { DeviceKind } from '~/types'
import { computed } from 'vue'
import { HOME_DEVICES } from '~/constants/home'
import { resolveDevicePluginComponent } from '~/devices/registry'
import { getDeviceMotionSpeed, getDeviceTone, isDeviceRunning } from '~/utils/device'

const props = withDefaults(defineProps<{
  deviceId: DeviceKind
  standalone?: boolean
}>(), { standalone: false })

const emit = defineEmits<{ close: [] }>()
const devices = {
  'air-conditioner': useDeviceState('air-conditioner'),
  'fan': useDeviceState('fan'),
  'robot-vacuum': useDeviceState('robot-vacuum'),
  'hand-warmer': useDeviceState('hand-warmer'),
  'television': useDeviceState('television'),
}
const current = computed(() => devices[props.deviceId])
const definition = computed(() => HOME_DEVICES[props.deviceId])
const control = computed(() => resolveDevicePluginComponent(props.deviceId, 'quickControl'))
const running = computed(() => isDeviceRunning(props.deviceId, current.value.state.value))
const tone = computed(() => getDeviceTone(props.deviceId, current.value.state.value))
const motionSpeed = computed(() => getDeviceMotionSpeed(props.deviceId, current.value.state.value))

const syncStatus = computed(() => current.value.binding.value ? current.value.linkStatus.value : current.value.syncStatus.value)
const syncLabel = computed(() => {
  if (current.value.binding.value)
    return current.value.linkLabel.value
  const status = current.value.syncStatus.value
  if (status === 'syncing')
    return '同步中'
  if (status === 'synced')
    return '云端同步'
  if (status === 'unauthorized')
    return '游客本地'
  if (status === 'error')
    return '等待重连'
  return '本地设备'
})
</script>

<template>
  <aside class="quick-control ui-card" :class="{ 'is-standalone': standalone }" :data-tone="tone" :aria-label="`${definition.name}快捷控制`">
    <span class="quick-control__glow" aria-hidden="true" />
    <header class="quick-control__header">
      <div class="quick-control__device">
        <span class="quick-control__thumb" :class="{ 'is-running': running }">
          <PluginIcon :icon="definition.appIcon" :size="50" :active="running" :tone="tone" :speed="motionSpeed" />
        </span>
        <span><small>{{ standalone ? '设备控制' : '快捷控制' }}</small><strong>{{ definition.name }}</strong></span>
      </div>
      <button v-if="!standalone" class="quick-control__close" type="button" aria-label="关闭快捷控制" @click="emit('close')">
        <span class="i-carbon-close" />
      </button>
    </header>

    <span class="ui-chip" :data-status="syncStatus" role="status" aria-live="polite" aria-atomic="true"><i />{{ syncLabel }}</span>

    <Transition name="body-swap" mode="out-in">
      <section :key="deviceId" class="quick-control__body">
        <component :is="control" v-if="control" />
      </section>
    </Transition>

    <NuxtLink v-if="!standalone" class="ui-cta" :to="definition.route">
      完整控制 <span class="i-carbon-arrow-right" />
    </NuxtLink>
  </aside>
</template>

<style scoped>
.quick-control {
  --qc-tone: var(--brand-secondary);
  position: relative;
  display: grid;
  gap: 14px;
  width: 316px;
  overflow: hidden;
  padding: 18px;
}

.quick-control[data-tone="cool"] { --qc-tone: var(--tone-cool); }
.quick-control[data-tone="heat"] { --qc-tone: var(--tone-heat); }
.quick-control[data-tone="warm"] { --qc-tone: var(--tone-warm); }
.quick-control.is-standalone { width: min(100%, 420px); }

/* Tinted light that follows the device state */
.quick-control__glow {
  position: absolute;
  z-index: -1;
  top: -40%;
  left: -20%;
  width: 140%;
  height: 80%;
  background: radial-gradient(closest-side, color-mix(in oklab, var(--qc-tone) 22%, transparent), transparent);
  opacity: 0.5;
  pointer-events: none;
  transition: background var(--dur-4) ease, opacity var(--dur-4) ease;
}

.quick-control:not([data-tone="idle"]) .quick-control__glow { opacity: 1; }
.quick-control__header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.quick-control__close { display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 11px; background: var(--brand-glass-sunken); color: var(--brand-muted); cursor: pointer; transition: transform var(--dur-2) var(--ease-spring), background var(--dur-1) ease; }
.quick-control__close:hover { transform: rotate(90deg); }
.quick-control__device { display: flex; align-items: center; gap: 11px; min-width: 0; }
.quick-control__device > span:last-child { display: grid; gap: 2px; }
.quick-control__device small { color: var(--brand-faint); font-size: 9px; font-weight: 650; letter-spacing: 0.1em; }
.quick-control__device strong { font-size: 15px; letter-spacing: -0.01em; }
.quick-control__thumb { display: grid; place-items: center; width: 50px; height: 50px; border-radius: 27%; }
.quick-control:not(.is-standalone) .quick-control__thumb { view-transition-name: device-hero; }
.quick-control__thumb.is-running { animation: float-y 3.2s ease-in-out infinite; }
.quick-control__body { display: grid; gap: 14px; }
.body-swap-enter-active, .body-swap-leave-active { transition: opacity var(--dur-2) var(--ease-out), transform var(--dur-2) var(--ease-out); }
.body-swap-enter-from { opacity: 0; transform: translateY(8px); }
.body-swap-leave-to { opacity: 0; transform: translateY(-6px); }

@media (max-width: 720px) {
  .quick-control { width: 100%; padding: 16px 16px calc(16px + env(safe-area-inset-bottom)); border-radius: 26px 26px 0 0; }
  .quick-control:not(.is-standalone)::before { justify-self: center; width: 38px; height: 4px; margin: -6px 0 2px; border-radius: 999px; background: var(--brand-line-strong); content: ''; }
}
</style>
