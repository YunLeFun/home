<script setup lang="ts">
import HomeSceneCloudApartment from './HomeSceneCloudApartment.vue'
import HomeSceneComfortSuite from './HomeSceneComfortSuite.vue'
import HomeSceneStudio from './HomeSceneStudio.vue'
import type { HomeTemplateId } from '~/types'

defineProps<{ templateId: HomeTemplateId }>()
</script>

<template>
  <g class="scene-art" data-layer="editable-scene-art">
    <defs>
      <linearGradient id="yun-home-wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f8faff" />
        <stop offset="1" stop-color="#e9eef9" />
      </linearGradient>
      <linearGradient id="yun-home-wall-lilac" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f5f2fc" />
        <stop offset="1" stop-color="#e8e7f6" />
      </linearGradient>
      <linearGradient id="yun-home-floor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#dfe7f4" />
        <stop offset="1" stop-color="#bdc9dc" />
      </linearGradient>
      <linearGradient id="yun-home-window" x1="0" y1="0" x2="0.8" y2="1">
        <stop offset="0" stop-color="#d9f2ff" />
        <stop offset="0.55" stop-color="#b9d8f0" />
        <stop offset="1" stop-color="#94b3d4" />
      </linearGradient>
      <linearGradient id="yun-home-wood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#d2bda9" />
        <stop offset="1" stop-color="#aa917e" />
      </linearGradient>
      <linearGradient id="yun-home-fabric" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#b8c8e1" />
        <stop offset="1" stop-color="#879bbd" />
      </linearGradient>
      <linearGradient id="yun-home-fabric-lilac" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#c7c1dd" />
        <stop offset="1" stop-color="#9790b4" />
      </linearGradient>
      <pattern id="yun-home-floor-lines" width="80" height="80" patternUnits="userSpaceOnUse">
        <path d="M0 79.5H80M79.5 0V80" fill="none" stroke="#8fa0b8" stroke-opacity=".18" stroke-width="1" />
      </pattern>
      <filter id="yun-home-shadow" x="-25%" y="-25%" width="150%" height="170%">
        <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#42506d" flood-opacity=".18" />
      </filter>
      <filter id="yun-home-soft-shadow" x="-25%" y="-25%" width="150%" height="170%">
        <feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#42506d" flood-opacity=".13" />
      </filter>
    </defs>

    <HomeSceneCloudApartment v-if="templateId === 'cloud-apartment'" />
    <HomeSceneStudio v-else-if="templateId === 'studio'" />
    <HomeSceneComfortSuite v-else />
  </g>
</template>

<style scoped>
.scene-art {
  pointer-events: none;
}

.scene-art :deep(.scene-room-label) {
  font-family: inherit;
  font-size: 18px !important;
  font-weight: 700;
  letter-spacing: 0.16em;
  opacity: 0.58;
}
</style>
