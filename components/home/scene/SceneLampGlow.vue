<script setup lang="ts">
/** Warm light pool for a lamp; drawn above the night overlay so it reads at night. */
withDefaults(defineProps<{ x: number, y: number, r?: number }>(), { r: 120 })
</script>

<template>
  <g class="sc-lamp-glow">
    <circle class="sc-lamp-flicker" :cx="x" :cy="y" :r="r" fill="url(#sc-lamp-glow)" />
  </g>
</template>
