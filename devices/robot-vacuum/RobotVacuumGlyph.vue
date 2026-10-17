<script setup lang="ts">
import type { DeviceGlyphProps } from '../types'

withDefaults(defineProps<DeviceGlyphProps>(), {
  active: false,
  tone: 'idle',
  title: '',
})
</script>

<template>
  <svg
    class="device-glyph robot-glyph"
    :class="{ 'is-active': active }"
    :data-tone="tone"
    viewBox="0 0 120 120"
    role="img"
    focusable="false"
    :aria-hidden="title ? undefined : 'true'"
    data-vector-device="robot-vacuum"
  >
    <title v-if="title">{{ title }}</title>
    <ellipse class="robot-glyph__shadow" cx="60" cy="88" rx="42" ry="12" />
    <ellipse class="robot-glyph__base" cx="60" cy="74" rx="45" ry="26" />
    <ellipse class="robot-glyph__body" cx="60" cy="68" rx="45" ry="26" />
    <ellipse class="robot-glyph__panel" cx="60" cy="66" rx="34" ry="18" />
    <circle class="robot-glyph__lidar" cx="48" cy="57" r="9" />
    <circle class="robot-glyph__lidar-top" cx="48" cy="55" r="6" />
    <path class="robot-glyph__detail" d="M71 57h16M71 63h11" />
    <circle class="robot-glyph__led" cx="84" cy="72" r="3" />
  </svg>
</template>

<style scoped>
.robot-glyph {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.robot-glyph__shadow { fill: rgba(40, 49, 47, 0.14); }
.robot-glyph__base { fill: #c4cbc0; stroke: #8a948b; stroke-width: 1.5; }
.robot-glyph__body { fill: #fbfbf8; stroke: #a9b3a6; stroke-width: 2; }
.robot-glyph__panel { fill: #e1e6de; stroke: #a5aea2; stroke-width: 1.5; }
.robot-glyph__lidar { fill: #aab3a8; }
.robot-glyph__lidar-top { fill: #e4e9e1; }
.robot-glyph__detail { fill: none; stroke: #858f86; stroke-linecap: round; stroke-width: 2; }
.robot-glyph__led { fill: #b2bab0; transition: fill var(--dur-3) ease; }

.robot-glyph.is-active .robot-glyph__led { fill: #7fa07e; filter: drop-shadow(0 0 4px rgba(127, 160, 126, 0.8)); }

.robot-glyph.is-active .robot-glyph__lidar-top {
  animation: robot-glyph-lidar 1.6s linear infinite;
  transform-box: fill-box;
  transform-origin: center;
}

@keyframes robot-glyph-lidar {
  50% { fill: #cfe0d0; }
}

@media (prefers-reduced-motion: reduce) {
  .robot-glyph.is-active .robot-glyph__lidar-top { animation: none; }
}
</style>
