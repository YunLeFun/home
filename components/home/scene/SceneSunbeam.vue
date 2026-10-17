<script setup lang="ts">
/**
 * Window light falling across the floor, with a few drifting dust motes.
 * Opacity comes from the lighting phase.
 */
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  /** Window glass left, right and bottom, in world units */
  x0: number
  x1: number
  y: number
  /** Horizontal drift of the light as it reaches the floor */
  slant?: number
  floor?: number
}>(), { slant: 150, floor: 760 })

const path = computed(() => `M${props.x0} ${props.y}H${props.x1}L${props.x1 + props.slant} ${props.floor}H${props.x0 + props.slant * 0.7}Z`)
const motes = computed(() => Array.from({ length: 6 }, (_, index) => ({
  x: props.x0 + (props.x1 - props.x0) * (0.2 + 0.13 * index) + props.slant * 0.4,
  y: props.y + (props.floor - props.y) * (0.35 + 0.08 * (index % 4)),
  r: 1.4 + (index % 3) * 0.5,
  mote: 7 + index * 1.3,
  delay: -index * 1.7,
})))
</script>

<template>
  <g class="sc-beam">
    <path class="sc-beam-breathe" :d="path" fill="url(#sc-beam)" />
    <circle
v-for="(mote, index) in motes" :key="index" class="sc-mote" :cx="mote.x" :cy="mote.y" :r="mote.r"
            :style="{ '--sc-mote': `${mote.mote}s`, '--sc-delay': `${mote.delay}s` }" />
  </g>
</template>
