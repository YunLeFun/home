<script setup lang="ts">
import type { HandWarmerLevel } from '~/types'
import { computed } from 'vue'
import { HAND_WARMER_LEVELS } from './state'
import RollingNumber from '~/components/ui/RollingNumber.vue'

const props = withDefaults(defineProps<{
  deviceId?: string
}>(), {
  deviceId: 'hand-warmer',
})

const LEVEL_LABELS: Record<HandWarmerLevel, string> = { low: '低温', medium: '舒适', high: '高温' }

const device = useDeviceState('hand-warmer', props.deviceId)
const state = computed(() => device.state.value)
</script>

<template>
  <div class="warmer-quick">
    <div class="ui-hero">
      <button class="ui-orb" data-tone="warm" :class="{ 'is-on': state.power }" type="button" :aria-label="state.power ? '关闭暖手宝' : '开启暖手宝'" :aria-pressed="state.power" @click="device.dispatch({ type: 'toggle' })">
        <span class="i-carbon-power" />
      </button>
      <div><strong><RollingNumber :value="state.temperature" /><sup>°C</sup></strong><small>{{ state.power ? '暖意正在缓缓升温' : '轻触开启温暖' }}</small></div>
    </div>
    <div class="ui-segments" :style="{ '--count': 3, '--index': HAND_WARMER_LEVELS.indexOf(state.level) }" role="group" aria-label="温度档位">
      <button v-for="level in HAND_WARMER_LEVELS" :key="level" type="button" :aria-pressed="state.level === level" style="--segment-tone: var(--tone-warm)" @click="device.dispatch({ type: 'set-level', level })">
        {{ LEVEL_LABELS[level] }}
      </button>
    </div>
    <p class="ui-note">
      <span class="i-carbon-time" />连续使用 2 小时后自动关闭
    </p>
  </div>
</template>

<style scoped>
.warmer-quick { display: grid; gap: 14px; }
</style>
