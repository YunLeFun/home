<script setup lang="ts">
const props = withDefaults(defineProps<{ deviceId?: string }>(), { deviceId: 'night-light' })
const device = useDeviceState('night-light', props.deviceId)
const state = device.state
</script>

<template>
  <div class="ui-hero">
    <button class="ui-orb" data-tone="warm" :class="{ 'is-on': state.power }" type="button" :aria-pressed="state.power" :aria-label="state.power ? '关闭小夜灯' : '开启小夜灯'" @click="device.dispatch({ type: 'set-power', power: !state.power })">
      <span class="i-carbon-power" />
    </button>
    <div><strong>{{ state.power ? '亮灯' : '熄灯' }}</strong></div>
  </div>
</template>
