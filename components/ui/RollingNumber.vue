<script setup lang="ts">
/**
 * Renders a value that rolls up or down when it changes, like an odometer.
 *
 * @example
 * ```vue
 * <RollingNumber :value="26" />
 * ```
 */
import { shallowRef, watch } from 'vue'

const props = defineProps<{
  /** Displayed value; numeric values decide the roll direction */
  value: number | string | null
  /** Text shown when the value is `null` */
  placeholder?: string
}>()

const direction = shallowRef<'roll-up' | 'roll-down'>('roll-up')

watch(() => props.value, (next, previous) => {
  if (typeof next === 'number' && typeof previous === 'number')
    direction.value = next < previous ? 'roll-down' : 'roll-up'
})
</script>

<template>
  <span class="rolling-number numeric">
    <Transition :name="direction">
      <span :key="String(value)">{{ value ?? placeholder ?? '—' }}</span>
    </Transition>
  </span>
</template>

<style scoped>
.rolling-number {
  position: relative;
  display: inline-grid;
  overflow: hidden;
  vertical-align: bottom;
}
</style>
