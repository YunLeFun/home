<script setup lang="ts">
import type { DeviceTone } from '../types'

withDefaults(defineProps<{
  /** Whether the fan is running; spins the blades */
  active?: boolean
  tone?: DeviceTone
  /** Accessible title; the glyph is decorative when empty */
  title?: string
}>(), {
  active: false,
  tone: 'idle',
  title: '',
})
</script>

<template>
  <svg
    class="device-glyph fan-glyph"
    :class="{ 'is-active': active }"
    :data-tone="tone"
    viewBox="0 0 120 120"
    role="img"
    focusable="false"
    :aria-hidden="title ? undefined : 'true'"
    data-vector-device="fan"
  >
    <title v-if="title">{{ title }}</title>
    <ellipse class="fan-glyph__shadow" cx="60" cy="107" rx="26" ry="7" />
    <path class="fan-glyph__stand" d="M56 68h8l5 32H51l5-32Z" />
    <rect class="fan-glyph__base" x="38" y="98" width="44" height="12" rx="6" />
    <circle class="fan-glyph__body" cx="60" cy="43" r="34" />
    <circle class="fan-glyph__grille" cx="60" cy="43" r="27" />
    <g class="fan-glyph__blades">
      <path d="M61 40c5-16 17-19 20-10 3 10-7 16-18 16Z" />
      <path d="M57 45c-16-4-20-16-11-20 9-4 17 6 17 17Z" />
      <path d="M61 47c10 13 5 25-5 22-10-3-10-15-1-23Z" />
    </g>
    <circle class="fan-glyph__hub" cx="60" cy="43" r="6" />
    <circle class="fan-glyph__ring" cx="60" cy="43" r="30" />
  </svg>
</template>

<style scoped>
.fan-glyph {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.fan-glyph__shadow { fill: rgba(40, 49, 47, 0.14); }
.fan-glyph__stand { fill: #d4d9d0; stroke: #939d92; stroke-width: 1.5; }
.fan-glyph__base { fill: #c4cbc0; stroke: #8a948b; stroke-width: 1.5; }
.fan-glyph__body { fill: #fbfbf8; stroke: #a9b3a6; stroke-width: 2; }
.fan-glyph__grille { fill: #e6eae2; }
.fan-glyph__blades { fill: #a3b4a5; }
.fan-glyph__hub { fill: #687b67; }
.fan-glyph__ring { fill: none; stroke: #8a948b; stroke-opacity: 0.6; stroke-width: 1.5; }

.fan-glyph.is-active .fan-glyph__blades {
  animation: fan-glyph-spin 1.15s linear infinite;
  /* Spin around the hub, not the blade group's lopsided bounding box. */
  transform-box: view-box;
  transform-origin: 60px 43px;
}

@keyframes fan-glyph-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .fan-glyph.is-active .fan-glyph__blades { animation: none; }
}
</style>
