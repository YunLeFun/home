<script setup lang="ts">
/** Woven rug in perspective on the floor. */
import { computed } from 'vue'

const props = defineProps<{ x: number, y: number, w: number, h: number }>()
const inset = computed(() => Math.min(props.h * 0.35, 30))
const outer = computed(() => `M${props.x + inset.value} ${props.y}H${props.x + props.w - inset.value}L${props.x + props.w} ${props.y + props.h}H${props.x}Z`)
const inner = computed(() => {
  const pad = 12
  return `M${props.x + inset.value + pad} ${props.y + pad * 0.6}H${props.x + props.w - inset.value - pad}L${props.x + props.w - pad * 1.2} ${props.y + props.h - pad * 0.6}H${props.x + pad * 1.2}Z`
})
</script>

<template>
  <g class="sc-rug">
    <path :d="outer" fill="url(#sc-oat)" fill-opacity=".9" />
    <path :d="inner" fill="none" style="stroke: var(--sc-accent)" stroke-opacity=".4" stroke-width="2" />
    <path :d="inner" fill="none" style="stroke: var(--sc-fabric-2)" stroke-opacity=".35" stroke-width="1" stroke-dasharray="2 6" transform="translate(0 6)" />
  </g>
</template>
