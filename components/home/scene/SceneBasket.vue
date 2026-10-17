<script setup lang="ts">
/** Woven laundry basket with folded linens; canonical 110 × 96, floor at y 96. */
withDefaults(defineProps<{ x: number, y: number, s?: number }>(), { s: 1 })
</script>

<template>
  <g class="sc-basket" :transform="`translate(${x} ${y}) scale(${s})`">
    <ellipse cx="55" cy="95" rx="56" ry="6" fill="url(#sc-contact)" />
    <rect x="16" y="2" width="78" height="20" rx="6" style="fill: var(--sc-fabric-1)" />
    <rect x="22" y="-10" width="66" height="16" rx="6" fill="url(#sc-linen)" />
    <path d="M6 20h98l-8 74H14Z" fill="url(#sc-wood-light)" />
    <path d="M10 36h90M12 52h86M13 68h84M15 84h80" style="stroke: var(--sc-wood-2)" stroke-opacity=".35" stroke-width="2" />
    <path d="M30 20v74M55 20v74M80 20v74" style="stroke: var(--sc-wood-2)" stroke-opacity=".2" stroke-width="2" />
  </g>
</template>
