<script setup lang="ts">
/** Oval walnut coffee table; canonical 250 wide, top face y 0–72, floor at y 140. */
withDefaults(defineProps<{ x: number, y: number, s?: number, decor?: boolean }>(), { s: 1, decor: true })
</script>

<template>
  <g class="sc-coffee-table" :transform="`translate(${x} ${y}) scale(${s})`">
    <ellipse cx="125" cy="138" rx="118" ry="10" fill="url(#sc-contact)" />
    <path d="M58 60 46 136M192 60l12 76M125 70v66" style="stroke: var(--sc-wood-2)" stroke-width="9" stroke-linecap="round" />
    <ellipse cx="125" cy="44" rx="125" ry="36" fill="url(#sc-wood)" />
    <ellipse cx="125" cy="36" rx="125" ry="36" fill="url(#sc-wood-light)" />
    <ellipse cx="125" cy="36" rx="108" ry="27" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="2" />
    <g v-if="decor">
      <rect x="28" y="24" width="52" height="9" rx="2" style="fill: var(--sc-ceramic-2)" />
      <rect x="32" y="16" width="44" height="9" rx="2" style="fill: var(--sc-accent)" />
      <path d="M86 32c-6-2-8-16 0-20h8c8 4 6 18 0 20Z" fill="url(#sc-ceramic)" />
      <g class="sc-sway" style="--sc-sway: 8s">
        <path d="M90 14c-2-14 4-26 12-32M90 12c6-8 14-12 22-12" fill="none" style="stroke: var(--sc-leaf-2)" stroke-width="2" />
        <circle cx="102" cy="-16" r="3.5" style="fill: var(--sc-accent)" />
        <circle cx="112" cy="0" r="3" style="fill: var(--sc-accent)" />
      </g>
    </g>
  </g>
</template>
