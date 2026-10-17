<script setup lang="ts">
import type { DeviceKind } from '~/types'
import { computed } from 'vue'
import HomeDeviceGlyph from './HomeDeviceGlyph.vue'
import { HOME_DEVICES } from '~/constants/home'
import { getDevicePlugin, resolveDevicePluginComponent } from '~/devices/registry'
import { getDeviceMotionSpeed, getDeviceTone, isDeviceRunning } from '~/utils/device'

const props = defineProps<{ deviceId: DeviceKind }>()
const definition = computed(() => HOME_DEVICES[props.deviceId])
const plugin = computed(() => getDevicePlugin(props.deviceId))
const pluginPanel = computed(() => resolveDevicePluginComponent(props.deviceId, 'panel'))
const device = useDeviceState(props.deviceId)
const running = computed(() => isDeviceRunning(props.deviceId, device.state.value))
const tone = computed(() => getDeviceTone(props.deviceId, device.state.value))
const motionSpeed = computed(() => getDeviceMotionSpeed(props.deviceId, device.state.value))

useHead({ title: () => definition.value.name })
</script>

<template>
  <div class="device-detail" :data-tone="tone">
    <header class="device-detail__topbar">
      <NuxtLink class="ui-chip device-detail__back" to="/">
        <span class="i-carbon-arrow-left" />返回云之彼端
      </NuxtLink>
      <span class="ui-chip" :data-status="running ? 'synced' : 'local'"><i />{{ running ? '运行中' : '待机' }}</span>
    </header>
    <main class="device-detail__main">
      <section class="device-detail__intro">
        <span class="device-detail__eyebrow">{{ plugin ? '设备插件' : '云之彼端设备' }}</span>
        <h1>{{ definition.name }}</h1>
        <p>{{ definition.description }}。设备状态会在本地即时响应，并在登录后同步到你的云之彼端。</p>
        <ul v-if="plugin?.manifest.integrations.length" class="device-detail__integrations" aria-label="支持的集成">
          <li v-for="integration in plugin.manifest.integrations" :key="integration.id">
            <span :class="integration.icon" />{{ integration.name }}<small>{{ integration.domain }}</small>
          </li>
        </ul>
        <div class="device-detail__vector" :class="{ 'is-running': running }">
          <span class="device-detail__aurora" aria-hidden="true" />
          <span class="device-detail__orbit" aria-hidden="true" />
          <HomeDeviceGlyph :device-id="deviceId" :active="running" :tone="tone" :title="definition.name" :speed="motionSpeed" :state="device.state.value" />
        </div>
      </section>
      <section class="device-detail__panel">
        <slot>
          <component :is="pluginPanel" v-if="pluginPanel" />
          <HomeDeviceQuickControl v-else :device-id="deviceId" standalone />
        </slot>
      </section>
    </main>
  </div>
</template>

<style scoped>
.device-detail {
  --detail-tone: var(--brand-secondary);
  position: relative;
  min-height: 100dvh;
  padding: 0 24px 40px;
  color: var(--brand-ink);
}

.device-detail[data-tone="cool"] { --detail-tone: var(--tone-cool); }
.device-detail[data-tone="heat"] { --detail-tone: var(--tone-heat); }
.device-detail[data-tone="warm"] { --detail-tone: var(--tone-warm); }

.device-detail__topbar { display: flex; align-items: center; justify-content: space-between; min-height: 76px; max-width: 1100px; margin: 0 auto; animation: rise-in var(--dur-3) var(--ease-out) backwards; }
.device-detail__back { color: var(--brand-ink); text-decoration: none; transition: transform var(--dur-2) var(--ease-spring); }
.device-detail__back:hover { transform: translateX(-3px); }
.device-detail__main { display: grid; grid-template-columns: minmax(0, 1fr) minmax(340px, 560px); align-items: center; gap: clamp(32px, 7vw, 96px); min-height: calc(100dvh - 120px); max-width: 1100px; margin: 0 auto; }
.device-detail__intro { display: grid; justify-items: start; animation: rise-in var(--dur-3) var(--ease-out) 80ms backwards; }
.device-detail__eyebrow { color: var(--detail-tone); font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; transition: color var(--dur-4) ease; }
.device-detail__intro h1 { margin: 10px 0 12px; font-size: clamp(36px, 5.4vw, 62px); letter-spacing: -0.05em; line-height: 1.02; }
.device-detail__intro p { max-width: 430px; margin: 0; color: var(--brand-muted); font-size: 14px; line-height: 1.8; }
.device-detail__integrations { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 0; padding: 0; list-style: none; }
.device-detail__integrations li { display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border: 1px solid var(--brand-line); border-radius: 999px; background: var(--brand-glass); font-size: 11px; font-weight: 650; }
.device-detail__integrations small { color: var(--brand-faint); font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; }

.device-detail__vector {
  position: relative;
  display: grid;
  place-items: center;
  width: min(90%, 360px);
  aspect-ratio: 1;
  margin-top: 26px;
  view-transition-name: device-hero;
}

.device-detail__vector :deep(.device-glyph) { position: relative; z-index: 1; width: 78%; height: 78%; filter: drop-shadow(0 22px 24px rgba(40, 49, 47, 0.18)); animation: float-y 5s ease-in-out infinite; }
.device-detail__aurora { position: absolute; inset: 6%; border-radius: 50%; background: radial-gradient(circle, color-mix(in oklab, var(--detail-tone) 34%, transparent), transparent 68%); filter: blur(18px); opacity: 0.45; transition: opacity var(--dur-4) ease, background var(--dur-4) ease; }
.device-detail__vector.is-running .device-detail__aurora { opacity: 1; animation: breathe 4s ease-in-out infinite; }
.device-detail__orbit { position: absolute; inset: 2%; border: 1px dashed var(--brand-line-strong); border-radius: 50%; opacity: 0.6; animation: spin 40s linear infinite; }
.device-detail__vector.is-running .device-detail__orbit { border-color: color-mix(in oklab, var(--detail-tone) 50%, transparent); animation-duration: 14s; }
.device-detail__panel { display: grid; place-items: center; min-width: 0; animation: rise-in var(--dur-3) var(--ease-out) 160ms backwards; }

@media (max-width: 860px) {
  .device-detail { padding: 0 14px 30px; }
  .device-detail__main { grid-template-columns: 1fr; gap: 24px; padding-top: 12px; }
  .device-detail__intro { justify-items: center; text-align: center; }
  .device-detail__integrations { justify-content: center; }
  .device-detail__vector { width: min(64%, 220px); margin-top: 14px; }
}
</style>
