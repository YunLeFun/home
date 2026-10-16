<script setup lang="ts">
import type { AirConditionerState } from '~/types'
import { computed } from 'vue'
import AcTemperatureDial from './AcTemperatureDial.vue'
import { airConditionerTone } from './state'

const props = withDefaults(defineProps<{
  deviceId?: string
}>(), {
  deviceId: 'air-conditioner',
})

const device = useDeviceState('air-conditioner', props.deviceId)
const state = computed(() => device.state.value)
const limits = device.capabilities
const tone = computed(() => airConditionerTone(state.value))
const controllable = computed(() => device.linkReady.value)
const modeIndex = computed(() => device.acMode.value === 'cool' ? 0 : device.acMode.value === 'heat' ? 1 : -1)
const caption = computed(() => {
  if (device.binding.value && !controllable.value)
    return '显示上次状态 · 暂不可控'
  return state.value.status ? `${device.acModeLabel.value}运行中` : '待机'
})

function changeTemperature(delta: -1 | 1) {
  device.dispatch({ type: delta > 0 ? 'increment' : 'decrement' })
}

function setMode(mode: AirConditionerState['mode']) {
  device.dispatch({ type: 'mode', mode })
}
</script>

<template>
  <div class="ac-quick" :data-tone="tone">
    <AcTemperatureDial
      :value="device.targetTemperature.value"
      :min="limits.minTemperature"
      :max="limits.maxTemperature"
      :step="limits.temperatureStep"
      :tone="tone"
      :caption="caption"
      :disabled="!controllable || !device.temperatureAvailable.value"
      :can-decrease="state.temperature > limits.minTemperature"
      :can-increase="state.temperature < limits.maxTemperature"
      @change="changeTemperature"
    />

    <div class="ac-quick__row">
      <button
        class="ui-orb"
        :class="{ 'is-on': state.status }"
        :data-tone="tone"
        type="button"
        :disabled="!controllable"
        :aria-label="state.status ? '关闭空调' : '开启空调'"
        :aria-pressed="state.status"
        @click="device.dispatch({ type: 'toggleStatus' })"
      >
        <span class="i-carbon-power" />
      </button>
      <div class="ui-segments" :style="{ '--index': Math.max(0, modeIndex) }" :data-empty="modeIndex < 0" role="group" aria-label="运行模式">
        <button type="button" :disabled="!controllable || !limits.hvacModes.includes('cool')" :aria-pressed="modeIndex === 0" style="--segment-tone: var(--tone-cool)" @click="setMode('cold')">
          <span class="i-carbon-snowflake" />制冷
        </button>
        <button type="button" :disabled="!controllable || !limits.hvacModes.includes('heat')" :aria-pressed="modeIndex === 1" style="--segment-tone: var(--tone-heat)" @click="setMode('hot')">
          <span class="i-carbon-sun" />制热
        </button>
      </div>
    </div>

    <p v-if="device.linkError.value" class="ac-quick__note" role="alert">
      <span class="i-carbon-warning-alt" />{{ device.linkError.value }}
    </p>
  </div>
</template>

<style scoped>
.ac-quick { display: grid; gap: 14px; }
.ac-quick__row { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 14px; }
.ac-quick__row .ui-orb { width: 56px; height: 56px; font-size: 19px; }
.ac-quick__note { display: flex; align-items: center; gap: 6px; margin: 0; color: var(--tone-danger); font-size: 10px; }
</style>
