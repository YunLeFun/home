<script setup lang="ts">
/** Wall clock showing local time; the second hand sweeps with CSS. */
import { computed } from 'vue'

const props = withDefaults(defineProps<{ cx: number, cy: number, r?: number }>(), { r: 30 })
const { minutes } = useSceneTime()
const hourAngle = computed(() => ((minutes.value / 60) % 12) * 30)
const minuteAngle = computed(() => (minutes.value % 60) * 6)
const secondDelay = computed(() => `-${Math.round((minutes.value % 1) * 60)}s`)
// Round so server and browser floating point produce identical attributes.
const round = (value: number) => Math.round(value * 100) / 100
const ticks = computed(() => Array.from({ length: 12 }, (_, index) => {
  const angle = (index * Math.PI) / 6
  const outer = props.r * 0.84
  const inner = props.r * (index % 3 === 0 ? 0.66 : 0.74)
  return {
    x1: round(props.cx + Math.sin(angle) * inner),
    y1: round(props.cy - Math.cos(angle) * inner),
    x2: round(props.cx + Math.sin(angle) * outer),
    y2: round(props.cy - Math.cos(angle) * outer),
  }
}))
</script>

<template>
  <g class="sc-clock" role="img" aria-label="当前时间">
    <circle :cx="cx" :cy="cy + 4" :r="r" fill="#2b2418" fill-opacity=".08" />
    <circle :cx="cx" :cy="cy" :r="r" fill="url(#sc-brass)" />
    <circle :cx="cx" :cy="cy" :r="r - 4" style="fill: var(--sc-linen-1)" />
    <line v-for="(tick, index) in ticks" :key="index" v-bind="tick" style="stroke: var(--sc-ink)" stroke-width="1.6" stroke-linecap="round" />
    <line
:x1="cx" :y1="cy" :x2="cx" :y2="cy - r * 0.42" style="stroke: var(--sc-ink)" stroke-width="3" stroke-linecap="round"
          :transform="`rotate(${hourAngle} ${cx} ${cy})`" />
    <line
:x1="cx" :y1="cy" :x2="cx" :y2="cy - r * 0.64" style="stroke: var(--sc-ink)" stroke-width="2" stroke-linecap="round"
          :transform="`rotate(${minuteAngle} ${cx} ${cy})`" />
    <line
class="sc-second-hand" :x1="cx" :y1="cy + r * 0.14" :x2="cx" :y2="cy - r * 0.72" style="stroke: var(--sc-accent)" stroke-width="1.2"
          :style="{ transformOrigin: `${cx}px ${cy}px`, animationDelay: secondDelay }" />
    <circle :cx="cx" :cy="cy" r="2.6" style="fill: var(--sc-accent)" />
  </g>
</template>
