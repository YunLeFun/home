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
    class="device-glyph tv-glyph"
    :class="{ 'is-active': active }"
    :data-tone="tone"
    viewBox="0 0 160 110"
    role="img"
    focusable="false"
    :aria-hidden="title ? undefined : 'true'"
    data-vector-device="television"
  >
    <title v-if="title">{{ title }}</title>
    <ellipse class="tv-glyph__shadow" cx="80" cy="102" rx="56" ry="6" />
    <path class="tv-glyph__stand" d="M72 88h16l5 9H67l5-9Z" />
    <path class="tv-glyph__foot" d="M52 98h56" />
    <rect class="tv-glyph__body" x="7" y="8" width="146" height="82" rx="9" />
    <rect class="tv-glyph__screen" x="14" y="15" width="132" height="68" rx="4" />
    <path class="tv-glyph__sky" d="M14 55c21-16 43-10 60-23 17-13 39-9 72-1v52H14Z" />
    <path class="tv-glyph__cloud" d="M34 60c2-9 11-15 21-12 5-12 24-13 31 1 11-4 22 3 23 13H34Z" />
    <path class="tv-glyph__shine" d="M22 21h52" />
    <circle class="tv-glyph__led" cx="140" cy="87" r="2" />
  </svg>
</template>

<style scoped>
.tv-glyph {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.tv-glyph__shadow { fill: rgba(59, 70, 88, 0.14); }
.tv-glyph__body { fill: #2e3542; stroke: #171c25; stroke-width: 2; }
.tv-glyph__screen { fill: #182235; stroke: #65718a; stroke-width: 1.5; transition: fill 180ms ease; }
.tv-glyph__sky { fill: #435575; opacity: 0.28; }
.tv-glyph__cloud { fill: #8da2c7; opacity: 0.18; }
.tv-glyph__shine { fill: none; stroke: white; stroke-linecap: round; stroke-opacity: 0.2; stroke-width: 3; }
.tv-glyph__stand { fill: #596272; stroke: #252b36; stroke-width: 1.5; }
.tv-glyph__foot { fill: none; stroke: #343c49; stroke-linecap: round; stroke-width: 5; }
.tv-glyph__led { fill: #758099; }

.tv-glyph.is-active .tv-glyph__screen { fill: #a3d2f6; }
.tv-glyph.is-active .tv-glyph__sky { fill: #d8ecfc; opacity: 0.76; }
.tv-glyph.is-active .tv-glyph__cloud { fill: #f5f8ff; opacity: 0.9; animation: tv-glyph-cloud 5s ease-in-out infinite; transform-box: fill-box; }
.tv-glyph.is-active .tv-glyph__led { fill: #22c55e; filter: drop-shadow(0 0 3px rgba(34, 197, 94, 0.9)); }

@keyframes tv-glyph-cloud {
  50% { transform: translateX(5px); }
}

@media (prefers-reduced-motion: reduce) {
  .tv-glyph.is-active .tv-glyph__cloud { animation: none; }
}
</style>
