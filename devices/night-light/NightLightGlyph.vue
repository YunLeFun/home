<script setup lang="ts">
import type { DeviceGlyphProps } from '../types'
import { crescentPath } from './manifest'

defineProps<DeviceGlyphProps>()
</script>

<template>
  <svg class="device-glyph night-light" viewBox="0 0 64 64" role="img" focusable="false" :aria-hidden="title ? undefined : 'true'" :class="{ 'is-on': active }" data-vector-device="night-light">
    <title v-if="title">{{ title }}</title>
    <ellipse cx="32" cy="53" rx="15" ry="2" fill="#35405b" opacity=".14" />
    <rect x="28" y="42" width="6" height="8" rx="2" fill="#a17e59" />
    <rect x="18" y="48" width="27" height="5" rx="2" fill="#c99a68" />
    <path class="night-light__shade" :d="crescentPath" stroke="#cabc9c" stroke-width=".6" />
  </svg>
</template>

<style scoped>
.night-light { width: 100%; height: 100%; overflow: visible; }
.night-light__shade { fill: #f8f2e6; }
.is-on .night-light__shade { fill: #ffdc88; filter: drop-shadow(0 0 2.5px #ffbf69); }
</style>
