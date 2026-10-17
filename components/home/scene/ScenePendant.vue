<script setup lang="ts">
/** Brass pendant hanging from the ceiling; its glow is drawn by SceneLampGlow. */
withDefaults(defineProps<{ x: number, y: number, ceiling?: number }>(), { ceiling: 30 })
</script>

<template>
  <g class="sc-pendant">
    <path :d="`M${x} ${ceiling}V${y - 26}`" style="stroke: var(--sc-ink)" stroke-opacity=".5" stroke-width="1.5" />
    <path :d="`M${x - 30} ${y}c0-18 13-28 30-28s30 10 30 28Z`" fill="url(#sc-brass)" />
    <ellipse :cx="x" :cy="y" rx="30" ry="4" fill="#fff4d8" fill-opacity=".9" />
  </g>
</template>
