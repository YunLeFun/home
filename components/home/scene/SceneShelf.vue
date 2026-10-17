<script setup lang="ts">
/** Wall shelves with books, jars and a trailing plant; canonical 270 × 230. */
import ScenePlant from './ScenePlant.vue'

withDefaults(defineProps<{ x: number, y: number, s?: number }>(), { s: 1 })
</script>

<template>
  <g class="sc-shelf" :transform="`translate(${x} ${y}) scale(${s})`">
    <g v-for="row in [70, 150, 230]" :key="row">
      <rect x="0" :y="row" width="270" height="9" rx="2" fill="url(#sc-wood-light)" />
      <rect x="4" :y="row + 9" width="262" height="4" fill="#2b2418" fill-opacity=".08" />
    </g>
    <rect x="18" y="26" width="16" height="44" rx="2" style="fill: var(--sc-fabric-2)" />
    <rect x="36" y="32" width="14" height="38" rx="2" style="fill: var(--sc-accent)" />
    <rect x="52" y="22" width="18" height="48" rx="2" style="fill: var(--sc-oat-2)" />
    <rect x="72" y="36" width="12" height="34" rx="2" transform="rotate(14 78 70)" style="fill: var(--sc-fabric-3)" />
    <path d="M150 70c-14 0-16-30-4-36h20c12 6 10 36-4 36Z" fill="url(#sc-ceramic)" />
    <ScenePlant :x="196" :y="-16" :s="0.9" variant="trailing" :delay="-3" />
    <rect x="24" y="118" width="40" height="32" rx="6" fill="url(#sc-ceramic)" />
    <rect x="70" y="112" width="44" height="38" rx="6" style="fill: var(--sc-oat-2)" />
    <path d="M140 150v-34h34v34Z" fill="url(#sc-ceramic)" />
    <rect x="186" y="124" width="62" height="26" rx="4" style="fill: var(--sc-linen-2)" />
    <rect x="186" y="112" width="62" height="12" rx="4" style="fill: var(--sc-fabric-1)" />
    <rect x="30" y="196" width="74" height="34" rx="6" style="fill: var(--sc-oat-1)" />
    <path d="M36 208h62M36 218h62" style="stroke: var(--sc-accent)" stroke-opacity=".4" stroke-width="2" />
    <rect x="132" y="190" width="40" height="40" rx="20" fill="url(#sc-ceramic)" />
    <ScenePlant :x="186" :y="150" :s="0.72" variant="bush" :delay="-1" />
  </g>
</template>

