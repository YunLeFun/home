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
    class="device-glyph warmer-glyph"
    :class="{ 'is-active': active }"
    :data-tone="tone"
    viewBox="0 0 120 120"
    role="img"
    focusable="false"
    :aria-hidden="title ? undefined : 'true'"
    data-vector-device="hand-warmer"
  >
    <title v-if="title">{{ title }}</title>
    <ellipse class="warmer-glyph__shadow" cx="60" cy="104" rx="29" ry="8" />
    <path class="warmer-glyph__handle" d="M42 37c0-18 36-18 36 0" />
    <rect class="warmer-glyph__body" x="27" y="31" width="66" height="72" rx="28" />
    <path class="warmer-glyph__panel" d="M36 68c8-12 40-12 48 0v16c-12 9-36 9-48 0Z" />
    <path class="warmer-glyph__warm-line" d="M46 58c-5-6 5-9 0-15M60 58c-5-6 5-9 0-15M74 58c-5-6 5-9 0-15" />
    <circle class="warmer-glyph__led" cx="60" cy="83" r="3" />
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

.warmer-glyph__shadow { fill: rgba(40, 49, 47, 0.14); }
.warmer-glyph__handle { fill: none; stroke: #b9a07e; stroke-linecap: round; stroke-width: 8; }
.warmer-glyph__body { fill: #f2d6c0; stroke: #c39d84; stroke-width: 2; }
.warmer-glyph__panel { fill: #e6b391; stroke: #b98a6c; stroke-width: 1.5; }
.warmer-glyph__warm-line { fill: none; stroke: #fff5ef; stroke-linecap: round; stroke-width: 2.5; }
.warmer-glyph__led { fill: #fff2b0; transition: fill var(--dur-3) ease; }

.warmer-glyph.is-active .warmer-glyph__warm-line { animation: warmer-glyph-rise 1.8s ease-in-out infinite; }
.warmer-glyph.is-active .warmer-glyph__led { fill: #ffe7a8; filter: drop-shadow(0 0 5px rgba(197, 154, 85, 0.9)); }

@keyframes warmer-glyph-rise {
  50% { opacity: 0.45; transform: translateY(-2px); }
}

@media (prefers-reduced-motion: reduce) {
  .warmer-glyph.is-active .warmer-glyph__warm-line { animation: none; }
}
</style>
