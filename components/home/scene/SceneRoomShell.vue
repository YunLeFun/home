<script setup lang="ts">
/**
 * Wall, floor and trim for one room column of the scene, in world units.
 */
const props = withDefaults(defineProps<{
  x0: number
  x1: number
  accent?: 'paper' | 'sky' | 'clay'
  /** Draw a partition on the right edge */
  divider?: boolean
}>(), { accent: 'paper', divider: false })

const width = props.x1 - props.x0
</script>

<template>
  <g class="sc-room-shell">
    <rect :x="x0" y="30" :width="width" height="540" :fill="`url(#sc-wall-${accent})`" />
    <rect :x="x0" y="30" :width="width" height="46" fill="url(#sc-ceiling-shade)" />
    <rect :x="x0" y="548" :width="width" height="22" style="fill: var(--sc-trim)" />
    <rect :x="x0" y="566" :width="width" height="4" style="fill: var(--sc-trim-shade)" />
    <rect :x="x0" y="570" :width="width" height="220" fill="url(#sc-floor)" />
    <rect :x="x0" y="570" :width="width" height="220" fill="url(#sc-planks)" />
    <rect :x="x0" y="570" :width="width" height="46" fill="url(#sc-floor-occlusion)" />
    <g v-if="divider">
      <rect :x="x1 - 9" y="30" width="18" height="760" style="fill: var(--sc-partition)" />
      <rect :x="x1 + 5" y="30" width="4" height="760" style="fill: var(--sc-partition-shade)" />
    </g>
  </g>
</template>
