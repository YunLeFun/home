<script setup lang="ts">
/** Ceramic table lamp with a linen shade; canonical 44 × 72, base on y 72. */
withDefaults(defineProps<{ x: number, y: number, s?: number }>(), { s: 1 })
</script>

<template>
  <g class="sc-table-lamp" :transform="`translate(${x} ${y}) scale(${s})`">
    <path d="M14 72c-8-4-8-26 8-30 16 4 16 26 8 30Z" fill="url(#sc-ceramic)" />
    <path d="M22 42V30" style="stroke: var(--sc-ink)" stroke-opacity=".5" stroke-width="2" />
    <path d="M4 30 10 2h24l6 28Z" fill="url(#sc-oat)" />
    <path d="M6 30h32" stroke="#fff4d8" stroke-opacity=".9" stroke-width="2" />
  </g>
</template>
