<script setup lang="ts">
/**
 * Writing desk with a display, task lamp and chair; canonical 320 wide,
 * desk top face y 0–20 (the tabletop surface), floor at y 260.
 */
withDefaults(defineProps<{ x: number, y: number, s?: number }>(), { s: 1 })
</script>

<template>
  <g class="sc-desk" :transform="`translate(${x} ${y}) scale(${s})`">
    <ellipse cx="160" cy="258" rx="170" ry="9" fill="url(#sc-contact)" />
    <rect x="60" y="-104" width="150" height="92" rx="8" style="fill: var(--sc-ink)" />
    <rect x="66" y="-98" width="138" height="78" rx="4" fill="url(#sc-sky)" />
    <path d="M66 -40c30-20 70 6 138-18v38H66Z" style="fill: var(--sc-hill-1)" fill-opacity=".8" />
    <path d="M135 -12v12M112 0h46" style="stroke: var(--sc-ink)" stroke-width="5" stroke-linecap="round" />
    <path d="M286 0v-60l-26-30" fill="none" stroke="url(#sc-brass)" stroke-width="4" stroke-linecap="round" />
    <path d="M244 -98l32 10-10 20-28-14Z" fill="url(#sc-brass)" />
    <rect x="0" y="0" width="320" height="20" rx="4" fill="url(#sc-wood-light)" />
    <rect x="8" y="20" width="304" height="8" style="fill: var(--sc-wood-2)" fill-opacity=".5" />
    <path d="M20 28 10 256M300 28l10 228" style="stroke: var(--sc-wood-2)" stroke-width="9" stroke-linecap="round" />
    <path d="M110 92h100c10 0 14 8 12 16l-6 46H104l-6-46c-2-8 2-16 12-16Z" fill="url(#sc-oat)" />
    <rect x="102" y="150" width="116" height="22" rx="10" fill="url(#sc-fabric)" />
    <path d="M116 172l-8 84M204 172l8 84M160 172v84" style="stroke: var(--sc-wood-2)" stroke-width="6" stroke-linecap="round" />
  </g>
</template>
