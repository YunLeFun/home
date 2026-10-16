<script setup lang="ts">
import type { DeviceTone } from '~/devices/types'
import type { DeviceKind } from '~/types'
import { computed } from 'vue'
import { resolveDevicePluginComponent } from '~/devices/registry'

const props = withDefaults(defineProps<{
  deviceId: DeviceKind
  active?: boolean
  tone?: DeviceTone
  title?: string
}>(), {
  active: false,
  tone: 'idle',
  title: '',
})

const pluginGlyph = computed(() => resolveDevicePluginComponent(props.deviceId, 'glyph'))
const viewBox = computed(() => props.deviceId === 'television' ? '0 0 160 110' : '0 0 120 120')
</script>

<template>
  <component :is="pluginGlyph" v-if="pluginGlyph" :active="active" :tone="tone" :title="title" />
  <svg
    v-else
    class="device-glyph"
    :class="{ 'is-active': active }"
    :data-tone="tone"
    :viewBox="viewBox"
    role="img"
    focusable="false"
    :aria-hidden="title ? undefined : 'true'"
  >
    <title v-if="title">{{ title }}</title>

    <g v-if="deviceId === 'fan'" class="device-glyph__fan" data-vector-device="fan">
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

    <g v-else-if="deviceId === 'hand-warmer'" class="device-glyph__warmer" data-vector-device="hand-warmer">
      <ellipse class="device-glyph__shadow" cx="60" cy="104" rx="29" ry="8" />
      <path class="device-glyph__handle" d="M42 37c0-18 36-18 36 0" />
      <rect class="device-glyph__body" x="27" y="31" width="66" height="72" rx="28" />
      <path class="device-glyph__panel" d="M36 68c8-12 40-12 48 0v16c-12 9-36 9-48 0Z" />
      <path class="device-glyph__warm-line" d="M46 58c-5-6 5-9 0-15M60 58c-5-6 5-9 0-15M74 58c-5-6 5-9 0-15" />
      <circle class="device-glyph__led" cx="60" cy="83" r="3" />
    </g>

    <g v-else class="device-glyph__television" data-vector-device="television">
      <ellipse class="device-glyph__shadow" cx="80" cy="102" rx="56" ry="6" />
      <path class="device-glyph__tv-stand" d="M72 88h16l5 9H67l5-9Z" />
      <path class="device-glyph__tv-foot" d="M52 98h56" />
      <rect class="device-glyph__tv-body" x="7" y="8" width="146" height="82" rx="9" />
      <rect class="device-glyph__tv-screen" x="14" y="15" width="132" height="68" rx="4" />
      <path class="device-glyph__tv-sky" d="M14 55c21-16 43-10 60-23 17-13 39-9 72-1v52H14Z" />
      <path class="device-glyph__tv-cloud" d="M34 60c2-9 11-15 21-12 5-12 24-13 31 1 11-4 22 3 23 13H34Z" />
      <path class="device-glyph__tv-shine" d="M22 21h52" />
      <circle class="device-glyph__tv-led" cx="140" cy="87" r="2" />
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

.device-glyph__shadow { fill: rgba(40, 49, 47, 0.14); }
.device-glyph__body { fill: #fbfbf8; stroke: #a9b3a6; stroke-width: 2; }
.device-glyph__panel { fill: #e1e6de; stroke: #a5aea2; stroke-width: 1.5; }
.device-glyph__detail { fill: none; stroke: #858f86; stroke-linecap: round; stroke-width: 2; }
.device-glyph__detail-fill { fill: none; stroke: #8a948b; stroke-opacity: .6; stroke-width: 1.5; }
.device-glyph__led { fill: #b2bab0; transition: fill var(--dur-3) ease; }
.device-glyph__stand { fill: #d4d9d0; stroke: #939d92; stroke-width: 1.5; }
.device-glyph__base { fill: #c4cbc0; stroke: #8a948b; stroke-width: 1.5; }
.device-glyph__grille { fill: #e6eae2; }
.device-glyph__blade { fill: #a3b4a5; }
.device-glyph__hub { fill: #687b67; }
.device-glyph__lidar { fill: #aab3a8; }
.device-glyph__lidar-top { fill: #e4e9e1; }
.device-glyph__handle { fill: none; stroke: #b9a07e; stroke-linecap: round; stroke-width: 8; }
.device-glyph__warmer .device-glyph__body { fill: #f2d6c0; stroke: #c39d84; }
.device-glyph__warmer .device-glyph__panel { fill: #e6b391; stroke: #b98a6c; }
.device-glyph__warm-line { fill: none; stroke: #fff5ef; stroke-linecap: round; stroke-width: 2.5; }
.device-glyph__warmer .device-glyph__led { fill: #fff2b0; }
.device-glyph__tv-body { fill: #2e3542; stroke: #171c25; stroke-width: 2; }
.device-glyph__tv-screen { fill: #182235; stroke: #65718a; stroke-width: 1.5; transition: fill 180ms ease; }
.device-glyph__tv-sky { fill: #435575; opacity: .28; }
.device-glyph__tv-cloud { fill: #8da2c7; opacity: .18; }
.device-glyph__tv-shine { fill: none; stroke: white; stroke-linecap: round; stroke-opacity: .2; stroke-width: 3; }
.device-glyph__tv-stand { fill: #596272; stroke: #252b36; stroke-width: 1.5; }
.device-glyph__tv-foot { fill: none; stroke: #343c49; stroke-linecap: round; stroke-width: 5; }
.device-glyph__tv-led { fill: #758099; }

.device-glyph.is-active .device-glyph__led { fill: #7fa07e; filter: drop-shadow(0 0 4px rgba(127, 160, 126, .8)); }
.device-glyph.is-active .device-glyph__tv-screen { fill: #6f949c; }
.device-glyph.is-active .device-glyph__tv-sky { fill: #b6d3d4; opacity: .76; }
.device-glyph.is-active .device-glyph__tv-cloud { fill: #f5f8ff; opacity: .9; animation: device-tv-cloud 5s ease-in-out infinite; transform-box: fill-box; }
.device-glyph.is-active .device-glyph__tv-led { fill: #7fa07e; filter: drop-shadow(0 0 3px rgba(127, 160, 126, .9)); }
.device-glyph.is-active .device-glyph__blades { animation: device-fan-spin 1.15s linear infinite; transform-box: fill-box; transform-origin: center; }
.device-glyph.is-active .device-glyph__warm-line { animation: device-warm-rise 1.8s ease-in-out infinite; }
.device-glyph.is-active .device-glyph__warmer .device-glyph__led { fill: #ffe7a8; filter: drop-shadow(0 0 5px rgba(197, 154, 85, .9)); }
.device-glyph.is-active .device-glyph__lidar-top { animation: device-lidar 1.6s linear infinite; transform-box: fill-box; transform-origin: center; }

@keyframes device-fan-spin {
  to { transform: rotate(360deg); }
}

@keyframes device-warm-rise {
  50% { opacity: .45; transform: translateY(-2px); }
}

@keyframes device-lidar {
  50% { fill: #cfe0d0; }
}

@keyframes device-tv-cloud {
  50% { transform: translateX(5px); }
}

@media (prefers-reduced-motion: reduce) {
  .device-glyph.is-active .device-glyph__blades,
  .device-glyph.is-active .device-glyph__warm-line,
  .device-glyph.is-active .device-glyph__tv-cloud { animation: none; }
}
</style>
