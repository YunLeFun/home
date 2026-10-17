<script setup lang="ts">
/**
 * A garden window whose sky follows the time of day, with drifting clouds,
 * sun or moon and stars, optional linen curtains and a sill.
 */
import { computed, useId } from 'vue'

const props = withDefaults(defineProps<{
  x: number
  y: number
  w: number
  h: number
  curtains?: boolean
  /** Arched top, like a moon gate */
  arch?: boolean
}>(), { curtains: true, arch: false })

const clipId = `sc-window-${useId()}`
const inset = 12
const glass = computed(() => ({ x: props.x + inset, y: props.y + inset, w: props.w - inset * 2, h: props.h - inset * 2 }))
const radius = computed(() => props.arch ? props.w / 2 : 6)
const framePath = computed(() => rounded(props.x, props.y, props.w, props.h, radius.value))
const glassPath = computed(() => rounded(glass.value.x, glass.value.y, glass.value.w, glass.value.h, props.arch ? glass.value.w / 2 : 3))

function rounded(x: number, y: number, w: number, h: number, r: number) {
  const top = Math.min(r, w / 2)
  return `M${x} ${y + h}V${y + top}A${top} ${top} 0 0 1 ${x + top} ${y}H${x + w - top}A${top} ${top} 0 0 1 ${x + w} ${y + top}V${y + h}Z`
}

const clouds = computed(() => {
  const { x, y, w, h } = glass.value
  return [
    { x: x - 140, y: y + h * 0.22, s: 1, drift: 64, delay: -8 },
    { x: x - 140, y: y + h * 0.42, s: 0.7, drift: 88, delay: -40 },
    { x: x - 140, y: y + h * 0.12, s: 0.55, drift: 110, delay: -75 },
  ].map(cloud => ({ ...cloud, span: w + 180 }))
})
const stars = computed(() => {
  const { x, y, w, h } = glass.value
  return [[0.18, 0.16], [0.42, 0.3], [0.7, 0.12], [0.82, 0.38], [0.3, 0.52], [0.58, 0.22]]
    .map(([u, v], index) => ({ x: x + w * u!, y: y + h * v!, delay: -index * 0.7, twinkle: 2.6 + (index % 3) }))
})
const hills = computed(() => {
  const { x, y, w, h } = glass.value
  const base = y + h
  return {
    far: `M${x} ${base - h * 0.26}C${x + w * 0.22} ${base - h * 0.4} ${x + w * 0.42} ${base - h * 0.2} ${x + w * 0.62} ${base - h * 0.32}S${x + w * 0.9} ${base - h * 0.3} ${x + w} ${base - h * 0.36}V${base}H${x}Z`,
    near: `M${x} ${base - h * 0.12}C${x + w * 0.3} ${base - h * 0.22} ${x + w * 0.55} ${base - h * 0.06} ${x + w} ${base - h * 0.18}V${base}H${x}Z`,
  }
})
</script>

<template>
  <g class="sc-window">
    <clipPath :id="clipId">
      <path :d="glassPath" />
    </clipPath>

    <path :d="framePath" transform="translate(0 6)" fill="#2b2418" fill-opacity=".08" />
    <path :d="framePath" style="fill: var(--sc-frame)" />
    <g :clip-path="`url(#${clipId})`">
      <rect :x="glass.x" :y="glass.y" :width="glass.w" :height="glass.h" fill="url(#sc-sky)" />
      <g class="sc-stars">
        <circle
v-for="(star, index) in stars" :key="index" class="sc-twinkle" :cx="star.x" :cy="star.y" r="1.6" fill="#fff8e6"
                :style="{ '--sc-delay': `${star.delay}s`, '--sc-twinkle': `${star.twinkle}s` }" />
      </g>
      <circle class="sc-sun" :cx="glass.x + glass.w * 0.74" :cy="glass.y + glass.h * 0.24" :r="Math.min(glass.w, glass.h) * 0.09" />
      <g class="sc-moon">
        <circle :cx="glass.x + glass.w * 0.72" :cy="glass.y + glass.h * 0.22" :r="Math.min(glass.w, glass.h) * 0.08" fill="#f5efd9" />
        <circle :cx="glass.x + glass.w * 0.72 + 7" :cy="glass.y + glass.h * 0.22 - 4" :r="Math.min(glass.w, glass.h) * 0.075" style="fill: var(--sc-sky-1)" />
      </g>
      <g
v-for="(cloud, index) in clouds" :key="index" class="sc-cloud-drift"
         :style="{ '--sc-drift': `${cloud.drift}s`, '--sc-delay': `${cloud.delay}s`, '--sc-span': `${cloud.span}px` }">
        <path
:transform="`translate(${cloud.x} ${cloud.y}) scale(${cloud.s})`"
              d="M8 30c-10 0-10-15 2-16 2-11 18-15 26-6 6-10 26-9 28 5 12-1 15 17 2 17Z" style="fill: var(--sc-cloud)" fill-opacity=".85" />
      </g>
      <path :d="hills.far" style="fill: var(--sc-hill-1)" class="sc-stop" />
      <path :d="hills.near" style="fill: var(--sc-hill-2)" class="sc-stop" />
      <rect :x="glass.x" :y="glass.y" :width="glass.w" :height="glass.h" fill="url(#sc-glass)" />
    </g>
    <g style="stroke: var(--sc-frame)" stroke-width="7" fill="none">
      <path :d="`M${x + w / 2} ${glass.y + (arch ? glass.w / 2 : 0)}V${glass.y + glass.h}`" />
      <path :d="`M${glass.x} ${glass.y + glass.h * 0.58}H${glass.x + glass.w}`" />
    </g>
    <path :d="glassPath" fill="none" style="stroke: var(--sc-frame-shade)" stroke-width="1.5" />
    <rect :x="x - 10" :y="y + h - 2" :width="w + 20" height="11" rx="3" style="fill: var(--sc-frame)" />
    <rect :x="x - 10" :y="y + h + 7" :width="w + 20" height="3" fill="#2b2418" fill-opacity=".08" />

    <g v-if="curtains">
      <g class="sc-curtain" style="--sc-sway: 9s">
        <path :d="`M${x - 34} ${y - 14}h40c-4 ${h * 0.4} 8 ${h * 0.8} -2 ${h + 40}h-42c6 -${h * 0.4} -6 -${h * 0.7} 4 -${h + 40}Z`" fill="url(#sc-oat)" />
        <path :d="`M${x - 22} ${y - 10}c-3 ${h * 0.5} 4 ${h * 0.8} -2 ${h + 34}M${x - 8} ${y - 10}c-2 ${h * 0.5} 5 ${h * 0.8} 0 ${h + 34}`" fill="none" style="stroke: var(--sc-line)" stroke-width="2" />
      </g>
      <g class="sc-curtain" style="--sc-sway: 11s; --sc-delay: -4s">
        <path :d="`M${x + w - 6} ${y - 14}h40c-6 ${h * 0.4} 6 ${h * 0.7} 4 ${h + 40}h-42c-8 -${h * 0.4} 4 -${h * 0.8} -2 -${h + 40}Z`" fill="url(#sc-oat)" />
        <path :d="`M${x + w + 8} ${y - 10}c3 ${h * 0.5} -4 ${h * 0.8} 2 ${h + 34}M${x + w + 22} ${y - 10}c2 ${h * 0.5} -5 ${h * 0.8} 0 ${h + 34}`" fill="none" style="stroke: var(--sc-line)" stroke-width="2" />
      </g>
      <rect :x="x - 44" :y="y - 22" :width="w + 88" height="6" rx="3" fill="url(#sc-brass)" />
    </g>
  </g>
</template>
