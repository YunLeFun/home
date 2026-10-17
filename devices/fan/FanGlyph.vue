<script setup lang="ts">
import type { DeviceGlyphProps } from '../types'
import { computed, shallowRef } from 'vue'

const props = withDefaults(defineProps<DeviceGlyphProps>(), {
  active: false,
  tone: 'idle',
  title: '',
  speed: 1,
})

// The ElpsyCN electric fan's petal, radius 90 around its hub.
const PETAL = 'M0 -10C16 -10 29 -23 29 -39C29 -67.2 16 -90 0 -90C-16 -90 -29 -67.2 -29 -39C-29 -23 -16 -10 0 -10Z'
const BLADE_ANGLES = [0, 120, 240]

const root = shallowRef<SVGSVGElement | null>(null)
const oscillating = computed(() => {
  const state = props.state
  return props.active && typeof state === 'object' && state !== null && (state as { oscillating?: unknown }).oscillating === true
})

// Blade speed follows the fan's speed level and eases between levels.
useEasedSpin(root, '.fan-glyph__blades', {
  active: () => props.active,
  speed: () => props.speed,
})
</script>

<template>
  <svg
    ref="root"
    class="device-glyph fan-glyph"
    :class="{ 'is-active': active, 'is-oscillating': oscillating }"
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
    <g class="fan-glyph__head">
      <circle class="fan-glyph__body" cx="60" cy="43" r="34" />
      <circle class="fan-glyph__grille" cx="60" cy="43" r="27" />
      <g class="fan-glyph__blades">
        <path v-for="angle in BLADE_ANGLES" :key="angle" :d="PETAL" :transform="`translate(60 43) rotate(${angle}) skewX(-8) scale(0.27)`" />
      </g>
      <circle class="fan-glyph__hub" cx="60" cy="43" r="6" />
      <circle class="fan-glyph__ring" cx="60" cy="43" r="30" />
    </g>
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

/* Spin and sway around the hub and the neck, not the groups' bounding boxes. */
.fan-glyph__blades {
  transform-box: view-box;
  transform-origin: 60px 43px;
}

.fan-glyph__head {
  transform-box: view-box;
  transform-origin: 60px 70px;
  transition: transform 600ms var(--ease-out, ease-out);
}

/* Oscillation, seen from the front: the head turns left and right. */
/* Start a quarter in, facing forward, so switching it on never jumps. */
.fan-glyph.is-oscillating .fan-glyph__head { animation: fan-glyph-sway 4.4s ease-in-out -1.1s infinite; }

@keyframes fan-glyph-sway {
  0%, 100% { transform: translateX(-2.5px) scaleX(0.88) skewY(3deg); }
  25%, 75% { transform: none; }
  50% { transform: translateX(2.5px) scaleX(0.88) skewY(-3deg); }
}

@media (prefers-reduced-motion: reduce) {
  .fan-glyph.is-oscillating .fan-glyph__head { animation: none; }
}
</style>
