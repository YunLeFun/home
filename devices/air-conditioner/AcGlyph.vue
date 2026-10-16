<script setup lang="ts">
import type { DeviceTone } from '../types'
import { useId } from 'vue'

withDefaults(defineProps<{
  /** Whether the unit is running */
  active?: boolean
  /** Running tone; picks cool or warm airflow */
  tone?: DeviceTone
  /** Accessible title; the glyph is decorative when empty */
  title?: string
}>(), {
  active: false,
  tone: 'idle',
  title: '',
})

const gradientId = `ac-glyph-body-${useId()}`
</script>

<template>
  <svg
    class="device-glyph ac-glyph"
    :class="{ 'is-active': active }"
    :data-tone="tone"
    viewBox="0 0 120 120"
    role="img"
    focusable="false"
    :aria-hidden="title ? undefined : 'true'"
    data-vector-device="air-conditioner"
  >
    <title v-if="title">{{ title }}</title>
    <defs>
      <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff" />
        <stop offset="1" stop-color="#eef0ea" />
      </linearGradient>
    </defs>

    <g class="ac-glyph__airflow" aria-hidden="true">
      <path d="M30 86c-3 8 3 13 0 21" />
      <path d="M48 86c-3 9 3 15 0 25" />
      <path d="M66 86c-3 9 3 15 0 25" />
      <path d="M84 86c-3 8 3 13 0 21" />
    </g>

    <rect class="ac-glyph__shadow" x="9" y="35" width="102" height="52" rx="15" />
    <rect class="ac-glyph__body" x="9" y="29" width="102" height="52" rx="15" :fill="`url(#${gradientId})`" />
    <path class="ac-glyph__sheen" d="M20 36h60" />
    <g class="ac-glyph__louver">
      <path class="ac-glyph__panel" d="M16 59h88c-2 12-8 16-17 16H33c-9 0-15-4-17-16Z" />
      <path class="ac-glyph__detail" d="M25 64h70" />
      <path class="ac-glyph__detail" d="M35 69h50" />
    </g>
    <circle class="ac-glyph__led-halo" cx="95" cy="43" r="6" />
    <circle class="ac-glyph__led" cx="95" cy="43" r="3" />
  </svg>
</template>

<style scoped>
.ac-glyph {
  --ac-tone: var(--tone-active);
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.ac-glyph[data-tone="cool"] { --ac-tone: var(--tone-cool); }
.ac-glyph[data-tone="heat"] { --ac-tone: var(--tone-heat); }

.ac-glyph__shadow { fill: rgba(40, 49, 47, 0.14); }
.ac-glyph__body { stroke: #a9b3a6; stroke-width: 2; }
.ac-glyph__sheen { fill: none; stroke: white; stroke-linecap: round; stroke-opacity: 0.9; stroke-width: 3; }
.ac-glyph__panel { fill: #e1e6de; stroke: #a5aea2; stroke-width: 1.5; }
.ac-glyph__detail { fill: none; stroke: #858f86; stroke-linecap: round; stroke-width: 2; }
.ac-glyph__led { fill: #b2bab0; transition: fill var(--dur-3) ease; }
.ac-glyph__led-halo { fill: var(--ac-tone); opacity: 0; transform-box: fill-box; transform-origin: center; }

.ac-glyph__louver {
  transform-box: fill-box;
  transform-origin: 50% 0%;
  transition: transform var(--dur-4) var(--ease-spring);
}

.ac-glyph__airflow path {
  fill: none;
  stroke: var(--ac-tone);
  stroke-dasharray: 6 9;
  stroke-linecap: round;
  stroke-width: 3;
  opacity: 0;
  transition: opacity var(--dur-3) ease;
}

.ac-glyph.is-active .ac-glyph__louver { transform: rotateX(28deg) translateY(1px); }
.ac-glyph.is-active .ac-glyph__led { fill: var(--ac-tone); }
.ac-glyph.is-active .ac-glyph__led-halo { animation: breathe 2.4s ease-in-out infinite; opacity: 0.35; }
.ac-glyph.is-active .ac-glyph__airflow path { opacity: 0.6; animation: ac-airflow 1.4s linear infinite; }
.ac-glyph.is-active .ac-glyph__airflow path:nth-child(2) { animation-delay: -0.35s; }
.ac-glyph.is-active .ac-glyph__airflow path:nth-child(3) { animation-delay: -0.7s; }
.ac-glyph.is-active .ac-glyph__airflow path:nth-child(4) { animation-delay: -1.05s; }
.ac-glyph[data-tone="heat"].is-active .ac-glyph__airflow path { animation-duration: 2s; }

@keyframes ac-airflow {
  from { stroke-dashoffset: 0; }
  to { stroke-dashoffset: -30; }
}

@media (prefers-reduced-motion: reduce) {
  .ac-glyph.is-active .ac-glyph__airflow path,
  .ac-glyph.is-active .ac-glyph__led-halo { animation: none; }
}
</style>
