<script setup lang="ts">
import type { DeviceGlyphProps } from '../types'
import { cloudPath, sleevePath } from './outline'

withDefaults(defineProps<DeviceGlyphProps>(), {
  active: false,
  tone: 'idle',
  title: '',
})
</script>

<template>
  <svg
    class="device-glyph warmer-glyph"
    :class="{ 'is-active': active }"
    :data-tone="tone"
    viewBox="0 0 64 64"
    role="img"
    focusable="false"
    :aria-hidden="title ? undefined : 'true'"
    data-vector-device="hand-warmer"
  >
    <title v-if="title">{{ title }}</title>
    <ellipse cx="32" cy="54" rx="16" ry="2" fill="#6a2a10" opacity=".12" />
    <path v-if="active" class="warmer-glyph__heat" d="M23 16q-2-2.5 0-5m9-1q-2-2.5 0-5m9 11q-2-2.5 0-5" />
    <path class="warmer-glyph__body" :d="cloudPath" />
    <path :d="sleevePath" fill="#ffc658" />
    <path d="M20 45Q32 48 44 45" stroke="#ffe096" stroke-width="1.3" stroke-linecap="round" fill="none" />
    <g fill="#3b4658">
      <ellipse cx="26" cy="32" rx="1.5" ry="2" />
      <ellipse cx="38" cy="32" rx="1.5" ry="2" />
      <path d="M30 36Q32 38 34 36" stroke="#3b4658" stroke-width="1.4" stroke-linecap="round" fill="none" />
    </g>
    <g fill="#ffb3a7">
      <ellipse cx="21" cy="36" rx="2.6" ry="1.6" />
      <ellipse cx="43" cy="36" rx="2.6" ry="1.6" />
    </g>
  </svg>
</template>

<style scoped>
.warmer-glyph {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.warmer-glyph__body { fill: #fff8ee; stroke: #e6d7c8; stroke-width: 0.6; }
.warmer-glyph.is-active .warmer-glyph__body { fill: #ffead2; }
.warmer-glyph__heat { fill: none; stroke: #f2a34f; stroke-linecap: round; stroke-width: 1.8; animation: warmer-glyph-rise 1.8s ease-in-out infinite; }

@keyframes warmer-glyph-rise {
  50% { opacity: 0.55; transform: translateY(-1.5px); }
}

@media (prefers-reduced-motion: reduce) {
  .warmer-glyph__heat { animation: none; }
}
</style>
