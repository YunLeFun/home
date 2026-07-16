<script setup lang="ts">
import type { DeviceKind } from '~/types'

withDefaults(defineProps<{
  deviceId: DeviceKind
  active?: boolean
  title?: string
}>(), {
  active: false,
  title: '',
})
</script>

<template>
  <svg
    class="device-glyph"
    :class="{ 'is-active': active }"
    viewBox="0 0 120 120"
    role="img"
    focusable="false"
    :aria-hidden="title ? undefined : 'true'"
  >
    <title v-if="title">{{ title }}</title>

    <g v-if="deviceId === 'air-conditioner'" class="device-glyph__ac" data-vector-device="air-conditioner">
      <rect class="device-glyph__shadow" x="9" y="35" width="102" height="52" rx="15" />
      <rect class="device-glyph__body" x="9" y="29" width="102" height="52" rx="15" />
      <path class="device-glyph__panel" d="M16 59h88c-2 12-8 16-17 16H33c-9 0-15-4-17-16Z" />
      <path class="device-glyph__detail" d="M25 64h70" />
      <path class="device-glyph__detail" d="M35 69h50" />
      <circle class="device-glyph__led" cx="95" cy="43" r="3" />
    </g>

    <g v-else-if="deviceId === 'fan'" class="device-glyph__fan" data-vector-device="fan">
      <ellipse class="device-glyph__shadow" cx="60" cy="107" rx="26" ry="7" />
      <path class="device-glyph__stand" d="M56 68h8l5 32H51l5-32Z" />
      <rect class="device-glyph__base" x="38" y="98" width="44" height="12" rx="6" />
      <circle class="device-glyph__body" cx="60" cy="43" r="34" />
      <circle class="device-glyph__grille" cx="60" cy="43" r="27" />
      <g class="device-glyph__blades">
        <path class="device-glyph__blade" d="M61 40c5-16 17-19 20-10 3 10-7 16-18 16Z" />
        <path class="device-glyph__blade" d="M57 45c-16-4-20-16-11-20 9-4 17 6 17 17Z" />
        <path class="device-glyph__blade" d="M61 47c10 13 5 25-5 22-10-3-10-15-1-23Z" />
      </g>
      <circle class="device-glyph__hub" cx="60" cy="43" r="6" />
      <circle class="device-glyph__detail-fill" cx="60" cy="43" r="30" />
    </g>

    <g v-else-if="deviceId === 'robot-vacuum'" class="device-glyph__robot" data-vector-device="robot-vacuum">
      <ellipse class="device-glyph__shadow" cx="60" cy="88" rx="42" ry="12" />
      <ellipse class="device-glyph__base" cx="60" cy="74" rx="45" ry="26" />
      <ellipse class="device-glyph__body" cx="60" cy="68" rx="45" ry="26" />
      <ellipse class="device-glyph__panel" cx="60" cy="66" rx="34" ry="18" />
      <circle class="device-glyph__lidar" cx="48" cy="57" r="9" />
      <circle class="device-glyph__lidar-top" cx="48" cy="55" r="6" />
      <path class="device-glyph__detail" d="M71 57h16M71 63h11" />
      <circle class="device-glyph__led" cx="84" cy="72" r="3" />
    </g>

    <g v-else class="device-glyph__warmer" data-vector-device="hand-warmer">
      <ellipse class="device-glyph__shadow" cx="60" cy="104" rx="29" ry="8" />
      <path class="device-glyph__handle" d="M42 37c0-18 36-18 36 0" />
      <rect class="device-glyph__body" x="27" y="31" width="66" height="72" rx="28" />
      <path class="device-glyph__panel" d="M36 68c8-12 40-12 48 0v16c-12 9-36 9-48 0Z" />
      <path class="device-glyph__warm-line" d="M46 58c-5-6 5-9 0-15M60 58c-5-6 5-9 0-15M74 58c-5-6 5-9 0-15" />
      <circle class="device-glyph__led" cx="60" cy="83" r="3" />
    </g>
  </svg>
</template>

<style scoped>
.device-glyph {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.device-glyph__shadow { fill: rgba(54, 67, 96, 0.18); }
.device-glyph__body { fill: #f9fbff; stroke: #a4b2cc; stroke-width: 2; }
.device-glyph__panel { fill: #dce4f2; stroke: #a3b1c9; stroke-width: 1.5; }
.device-glyph__detail { fill: none; stroke: #8191ad; stroke-linecap: round; stroke-width: 2; }
.device-glyph__detail-fill { fill: none; stroke: #8292ad; stroke-opacity: .6; stroke-width: 1.5; }
.device-glyph__led { fill: #7aa6ea; }
.device-glyph__stand { fill: #cad4e4; stroke: #8f9db7; stroke-width: 1.5; }
.device-glyph__base { fill: #b7c3d7; stroke: #8291ad; stroke-width: 1.5; }
.device-glyph__grille { fill: #dfe7f3; }
.device-glyph__blade { fill: #9fb2ce; }
.device-glyph__hub { fill: #7083a7; }
.device-glyph__lidar { fill: #a3b2c9; }
.device-glyph__lidar-top { fill: #dce6f5; }
.device-glyph__handle { fill: none; stroke: #a994b9; stroke-linecap: round; stroke-width: 8; }
.device-glyph__warmer .device-glyph__body { fill: #f0c6bb; stroke: #bd8f8a; }
.device-glyph__warmer .device-glyph__panel { fill: #e9aaa0; stroke: #b77f7b; }
.device-glyph__warm-line { fill: none; stroke: #fff5ef; stroke-linecap: round; stroke-width: 2.5; }
.device-glyph__warmer .device-glyph__led { fill: #fff2b0; }

.device-glyph.is-active .device-glyph__led { fill: #62caa8; filter: drop-shadow(0 0 4px rgba(98, 202, 168, .75)); }
.device-glyph.is-active .device-glyph__blades { animation: device-fan-spin 1.15s linear infinite; transform-box: fill-box; transform-origin: center; }
.device-glyph.is-active .device-glyph__warm-line { animation: device-warm-rise 1.8s ease-in-out infinite; }

@keyframes device-fan-spin {
  to { transform: rotate(360deg); }
}

@keyframes device-warm-rise {
  50% { opacity: .45; transform: translateY(-2px); }
}

@media (prefers-reduced-motion: reduce) {
  .device-glyph.is-active .device-glyph__blades,
  .device-glyph.is-active .device-glyph__warm-line { animation: none; }
}
</style>
