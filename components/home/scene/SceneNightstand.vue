<script setup lang="ts">
/** Two-drawer nightstand; canonical 110 × 126, top surface y 0–14, floor at y 126. */
withDefaults(defineProps<{ x: number, y: number, s?: number, books?: boolean }>(), { s: 1, books: true })
</script>

<template>
  <g class="sc-nightstand" :transform="`translate(${x} ${y}) scale(${s})`">
    <ellipse cx="55" cy="125" rx="58" ry="6" fill="url(#sc-contact)" />
    <rect x="0" y="0" width="110" height="14" rx="4" fill="url(#sc-wood-light)" />
    <rect x="6" y="14" width="98" height="98" rx="4" fill="url(#sc-wood)" />
    <path d="M12 62h86" style="stroke: var(--sc-wood-2)" stroke-width="2" />
    <rect x="44" y="34" width="22" height="5" rx="2.5" fill="url(#sc-brass)" />
    <rect x="44" y="82" width="22" height="5" rx="2.5" fill="url(#sc-brass)" />
    <path d="M14 112l-2 14M96 112l2 14" style="stroke: var(--sc-wood-2)" stroke-width="5" stroke-linecap="round" />
    <g v-if="books">
      <rect x="8" y="-8" width="30" height="8" rx="1.5" style="fill: var(--sc-fabric-2)" />
      <rect x="11" y="-15" width="26" height="7" rx="1.5" style="fill: var(--sc-ceramic-2)" />
    </g>
  </g>
</template>
