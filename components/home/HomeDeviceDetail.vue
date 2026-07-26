<script setup lang="ts">
import { computed } from 'vue'
import HomeDeviceGlyph from './HomeDeviceGlyph.vue'
import { HOME_DEVICES } from '~/constants/home'
import type { DeviceKind } from '~/types'

const props = defineProps<{ deviceId: DeviceKind }>()
const definition = computed(() => HOME_DEVICES[props.deviceId])
</script>

<template>
  <div class="device-detail">
    <header class="device-detail__topbar">
      <NuxtLink to="/">
        <span class="i-carbon-arrow-left" />返回云之彼端
      </NuxtLink>
      <span><span class="i-carbon-cloud" />云端设备</span>
    </header>
    <main class="device-detail__main">
      <section class="device-detail__intro">
        <span class="device-detail__eyebrow">Yun Home Device</span>
        <h1>{{ definition.name }}</h1>
        <p>{{ definition.description }}。设备状态会在本地即时响应，并在登录后同步到你的云之彼端。</p>
        <div class="device-detail__vector">
          <HomeDeviceGlyph :device-id="deviceId" :title="definition.name" />
        </div>
      </section>
      <section class="device-detail__panel">
        <slot><HomeDeviceQuickControl :device-id="deviceId" standalone /></slot>
      </section>
    </main>
  </div>
</template>

<style scoped>
.device-detail { min-height: 100vh; padding: 0 24px 40px; background: radial-gradient(circle at 10% 5%, #e4ecff, transparent 32%), linear-gradient(145deg, #f9fbff, #eef2fb); color: #33405d; }
.device-detail__topbar { display: flex; align-items: center; justify-content: space-between; min-height: 76px; max-width: 1100px; margin: 0 auto; }
.device-detail__topbar a, .device-detail__topbar > span { display: inline-flex; align-items: center; gap: 7px; color: #697794; font-size: 12px; font-weight: 650; text-decoration: none; }
.device-detail__main { display: grid; grid-template-columns: minmax(0, 1fr) minmax(360px, 520px); align-items: center; gap: clamp(32px, 8vw, 110px); min-height: calc(100vh - 120px); max-width: 1050px; margin: 0 auto; }
.device-detail__intro { display: grid; justify-items: start; }
.device-detail__eyebrow { color: #7b8fc9; font-size: 11px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; }
.device-detail__intro h1 { margin: 10px 0 12px; color: #2f3a54; font-size: clamp(34px, 5vw, 58px); letter-spacing: -0.05em; }
.device-detail__intro p { max-width: 430px; margin: 0; color: #7a869d; font-size: 14px; line-height: 1.8; }
.device-detail__vector { width: min(90%, 360px); aspect-ratio: 1; margin-top: 22px; filter: drop-shadow(0 22px 25px rgba(60, 75, 112, 0.2)); }
.device-detail__panel { display: grid; place-items: center; min-width: 0; }
@media (max-width: 760px) { .device-detail { padding: 0 14px 30px; } .device-detail__main { grid-template-columns: 1fr; gap: 24px; padding-top: 24px; } .device-detail__intro { justify-items: center; text-align: center; } .device-detail__vector { width: min(72%, 210px); margin-top: 16px; } }
</style>
