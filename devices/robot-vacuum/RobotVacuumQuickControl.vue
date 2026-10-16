<script setup lang="ts">
import type { RobotVacuumMode, RobotVacuumStatus } from '~/types'
import { computed } from 'vue'
import { ROBOT_VACUUM_MODES } from './state'
import RollingNumber from '~/components/ui/RollingNumber.vue'

const props = withDefaults(defineProps<{
  deviceId?: string
}>(), {
  deviceId: 'robot-vacuum',
})

const MODE_LABELS: Record<RobotVacuumMode, string> = { quiet: '安静', standard: '标准', turbo: '强力' }
const STATUS_CAPTIONS: Partial<Record<RobotVacuumStatus, string>> = {
  cleaning: '正在规划路线清扫',
  paused: '清扫已暂停',
  returning: '正在返回基站',
}

const device = useDeviceState('robot-vacuum', props.deviceId)
const state = computed(() => device.state.value)
const cleaning = computed(() => state.value.status === 'cleaning')
const progress = computed(() => device.visualProgress.value)
const percent = computed(() => Math.round(progress.value * 100))
</script>

<template>
  <div class="robot-quick">
    <div class="ui-hero">
      <button class="ui-orb" :class="{ 'is-on': cleaning }" type="button" :aria-label="cleaning ? '暂停清扫' : '开始清扫'" :aria-pressed="cleaning" @click="device.dispatch({ type: cleaning ? 'pause' : 'start' })">
        <span :class="cleaning ? 'i-carbon-pause' : 'i-carbon-play'" />
      </button>
      <div><strong><RollingNumber :value="percent" /><sup>%</sup></strong><small>{{ STATUS_CAPTIONS[state.status] ?? '基站待命' }}</small></div>
    </div>
    <div class="robot-quick__progress" role="progressbar" aria-label="清扫进度" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100">
      <span :style="{ transform: `scaleX(${progress})` }" />
    </div>
    <div class="robot-quick__stats">
      <span><small>电量</small><strong class="numeric">{{ state.battery }}%</strong></span><span><small>已清扫</small><strong class="numeric">{{ Math.round(progress * 32) }} m²</strong></span>
    </div>
    <div class="ui-segments" :style="{ '--count': 3, '--index': ROBOT_VACUUM_MODES.indexOf(state.mode) }" role="group" aria-label="清扫模式">
      <button v-for="mode in ROBOT_VACUUM_MODES" :key="mode" type="button" :aria-pressed="state.mode === mode" @click="device.dispatch({ type: 'set-mode', mode })">
        {{ MODE_LABELS[mode] }}
      </button>
    </div>
    <button class="ui-wide" type="button" @click="device.dispatch({ type: 'return' })">
      <span class="i-carbon-home" />返回充电基站
    </button>
  </div>
</template>

<style scoped>
.robot-quick { display: grid; gap: 14px; }
.robot-quick__progress { height: 6px; overflow: hidden; border-radius: 999px; background: var(--brand-glass-sunken); }
.robot-quick__progress span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--brand-secondary), var(--tone-cool)); transform-origin: left; transition: transform var(--dur-3) var(--ease-out); }
.robot-quick__stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.robot-quick__stats span { display: grid; gap: 2px; padding: 10px 12px; border-radius: 14px; background: var(--brand-glass-sunken); }
.robot-quick__stats small { color: var(--brand-faint); font-size: 9px; }
.robot-quick__stats strong { font-size: 13px; }
</style>
