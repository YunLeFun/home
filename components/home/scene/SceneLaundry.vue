<script setup lang="ts">
/**
 * Utility counter with a front-loading washer and storage doors;
 * canonical 335 × 212, counter top face y 0–40, floor at y 212.
 */
withDefaults(defineProps<{ x: number, y: number, s?: number }>(), { s: 1 })
</script>

<template>
  <g class="sc-laundry" :transform="`translate(${x} ${y}) scale(${s})`">
    <ellipse cx="168" cy="210" rx="172" ry="8" fill="url(#sc-contact)" />
    <rect x="0" y="0" width="335" height="40" rx="4" fill="url(#sc-wood-light)" />
    <rect x="0" y="36" width="335" height="6" style="fill: var(--sc-wood-2)" fill-opacity=".5" />
    <rect x="6" y="42" width="323" height="160" rx="3" fill="url(#sc-linen)" />
    <circle cx="80" cy="122" r="50" style="fill: var(--sc-trim-shade)" />
    <circle cx="80" cy="122" r="40" fill="url(#sc-sky)" fill-opacity=".55" />
    <circle cx="80" cy="122" r="40" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3" />
    <path d="M58 104a30 30 0 0 1 22-10" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-linecap="round" />
    <rect x="22" y="52" width="40" height="8" rx="4" style="fill: var(--sc-trim-shade)" />
    <circle cx="124" cy="56" r="5" style="fill: var(--sc-trim-shade)" />
    <path d="M160 46v152M244 46v152" style="stroke: var(--sc-line)" stroke-width="2" />
    <rect x="196" y="110" width="4" height="26" rx="2" fill="url(#sc-brass)" />
    <rect x="280" y="110" width="4" height="26" rx="2" fill="url(#sc-brass)" />
    <rect x="6" y="202" width="323" height="10" style="fill: var(--sc-wood-2)" fill-opacity=".45" />
  </g>
</template>
