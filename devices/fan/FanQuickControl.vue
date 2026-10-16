<script setup lang="ts">
import { computed } from 'vue'
import RollingNumber from '~/components/ui/RollingNumber.vue'

const props = withDefaults(defineProps<{
  deviceId?: string
}>(), {
  deviceId: 'fan',
})

const SPEEDS = [1, 2, 3] as const

const device = useDeviceState('fan', props.deviceId)
const state = computed(() => device.state.value)
const caption = computed(() => {
  if (!state.value.power)
    return '待机'
  return state.value.oscillating ? '柔风摇头中' : '定向送风中'
})
</script>

<template>
  <div class="fan-quick">
    <div class="ui-hero">
      <button class="ui-orb" :class="{ 'is-on': state.power }" type="button" :aria-label="state.power ? '关闭风扇' : '开启风扇'" :aria-pressed="state.power" @click="device.dispatch({ type: 'toggle' })">
        <span class="i-carbon-power" />
      </button>
      <div><strong><RollingNumber :value="state.speed" /><sup>档</sup></strong><small>{{ caption }}</small></div>
    </div>
    <div class="ui-segments" :style="{ '--count': 3, '--index': state.speed - 1 }" role="group" aria-label="风速">
      <button v-for="speed in SPEEDS" :key="speed" type="button" :aria-pressed="state.speed === speed" @click="device.dispatch({ type: 'set-speed', speed })">
        {{ speed }} 档
      </button>
    </div>
    <button class="ui-wide" type="button" :aria-pressed="state.oscillating" @click="device.dispatch({ type: 'toggle-oscillation' })">
      <span class="i-carbon-renew" :class="{ 'is-spinning': state.power && state.oscillating }" />{{ state.oscillating ? '摇头已开启' : '开启摇头' }}
    </button>
  </div>
</template>

<style scoped>
.fan-quick { display: grid; gap: 14px; }
.is-spinning { animation: spin 2.4s linear infinite; }
</style>
