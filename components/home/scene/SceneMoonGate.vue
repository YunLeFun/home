<script setup lang="ts">
/** Framed print of the brand's moon gate over a cloud garden. */
import { useId } from 'vue'

const props = withDefaults(defineProps<{ cx: number, cy: number, r?: number }>(), { r: 60 })
const clipId = `sc-moon-gate-${useId()}`
const size = props.r * 2 + 24
</script>

<template>
  <g class="sc-moon-gate">
    <rect :x="cx - size / 2" :y="cy - size / 2 + 5" :width="size" :height="size" rx="4" fill="#2b2418" fill-opacity=".08" />
    <rect :x="cx - size / 2" :y="cy - size / 2" :width="size" :height="size" rx="4" fill="url(#sc-wood)" />
    <rect :x="cx - size / 2 + 6" :y="cy - size / 2 + 6" :width="size - 12" :height="size - 12" rx="2" style="fill: var(--sc-linen-1)" />
    <clipPath :id="clipId">
      <circle :cx="cx" :cy="cy" :r="r * 0.78" />
    </clipPath>
    <circle :cx="cx" :cy="cy" :r="r * 0.78" style="fill: var(--sc-sky-wall-2)" />
    <g :clip-path="`url(#${clipId})`">
      <path
:d="`M${cx - r} ${cy + r * 0.3}c${r * 0.4} -${r * 0.3} ${r * 0.8} ${r * 0.1} ${r * 1.2} -${r * 0.1}s${r * 0.6} ${r * 0.2} ${r * 0.8} 0V${cy + r}H${cx - r}Z`"
            style="fill: var(--sc-leaf-2)" fill-opacity=".7" />
      <path :d="`M${cx - r * 0.5} ${cy - r * 0.1}c-${r * 0.18} 0-${r * 0.18} -${r * 0.24} 0-${r * 0.24}c${r * 0.04} -${r * 0.2} ${r * 0.34} -${r * 0.2} ${r * 0.38} 0c${r * 0.2} 0 ${r * 0.2} ${r * 0.24} 0 ${r * 0.24}Z`" fill="#fff" fill-opacity=".9" />
      <circle :cx="cx + r * 0.32" :cy="cy - r * 0.32" :r="r * 0.12" fill="url(#sc-brass)" />
    </g>
    <circle :cx="cx" :cy="cy" :r="r * 0.78" fill="none" style="stroke: var(--sc-ink)" stroke-opacity=".5" stroke-width="2.5" />
  </g>
</template>
