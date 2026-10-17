<script setup lang="ts">
/** Arc floor lamp; canonical 120 × 300, base on y 300, shade near (16, 54). */
withDefaults(defineProps<{ x: number, y: number, s?: number, flip?: boolean }>(), { s: 1, flip: false })
</script>

<template>
  <g class="sc-floor-lamp" :transform="`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`">
    <ellipse cx="96" cy="298" rx="30" ry="5" fill="url(#sc-contact)" />
    <path d="M96 294V60C96 22 64 8 34 26" fill="none" stroke="url(#sc-brass)" stroke-width="5" stroke-linecap="round" />
    <ellipse cx="96" cy="294" rx="22" ry="6" fill="url(#sc-brass)" />
    <path d="M4 58c0-22 16-34 32-34s32 12 32 34Z" fill="url(#sc-oat)" />
    <ellipse cx="36" cy="58" rx="32" ry="5" fill="#fff4d8" fill-opacity=".9" />
  </g>
</template>
