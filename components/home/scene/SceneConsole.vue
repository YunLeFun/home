<script setup lang="ts">
/** Low fluted media console; canonical 240 × 64, floor at y 64. */
withDefaults(defineProps<{ x: number, y: number, s?: number }>(), { s: 1 })
</script>

<template>
  <g class="sc-console" :transform="`translate(${x} ${y}) scale(${s})`">
    <ellipse cx="120" cy="62" rx="118" ry="6" fill="url(#sc-contact)" />
    <rect x="0" y="0" width="240" height="10" rx="3" fill="url(#sc-wood-light)" />
    <rect x="6" y="10" width="228" height="40" rx="2" fill="url(#sc-wood)" />
    <path
d="M14 14v32M22 14v32M30 14v32M38 14v32M46 14v32M54 14v32M62 14v32M70 14v32M168 14v32M176 14v32M184 14v32M192 14v32M200 14v32M208 14v32M216 14v32M224 14v32"
          style="stroke: var(--sc-wood-2)" stroke-opacity=".55" stroke-width="2" />
    <rect x="82" y="14" width="76" height="32" rx="2" style="fill: var(--sc-wood-2)" fill-opacity=".35" />
    <path d="M18 50l-2 14M222 50l2 14" stroke="url(#sc-brass)" stroke-width="4" stroke-linecap="round" />
    <rect x="16" y="-14" width="34" height="14" rx="2" style="fill: var(--sc-ceramic-2)" />
    <rect x="20" y="-24" width="28" height="10" rx="2" style="fill: var(--sc-fabric-2)" />
    <path d="M206 0c-8-2-10-18-2-24h10c8 6 6 22-2 24Z" fill="url(#sc-ceramic)" />
  </g>
</template>
