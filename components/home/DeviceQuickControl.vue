<script setup lang="ts">
import { computed } from 'vue'
import HomeDeviceGlyph from './HomeDeviceGlyph.vue'
import { HOME_DEVICES } from '~/constants/home'
import type { DeviceKind, FanState, HandWarmerState, RobotVacuumState, TelevisionState } from '~/types'

const props = withDefaults(defineProps<{
  deviceId: DeviceKind
  standalone?: boolean
}>(), { standalone: false })

const emit = defineEmits<{ close: [] }>()
const airConditioner = useDeviceState('air-conditioner')
const fan = useDeviceState('fan')
const robot = useDeviceState('robot-vacuum')
const warmer = useDeviceState('hand-warmer')
const television = useDeviceState('television')
const definition = computed(() => HOME_DEVICES[props.deviceId])
const acState = computed(() => airConditioner.state.value)
const fanState = computed(() => fan.state.value as FanState)
const robotState = computed(() => robot.state.value as RobotVacuumState)
const warmerState = computed(() => warmer.state.value as HandWarmerState)
const televisionState = computed(() => television.state.value as TelevisionState)
const robotVisualProgress = computed(() => robot.visualProgress.value)
const syncStatus = computed(() => {
  if (props.deviceId === 'air-conditioner')
    return airConditioner.syncStatus.value
  if (props.deviceId === 'fan')
    return fan.syncStatus.value
  if (props.deviceId === 'robot-vacuum')
    return robot.syncStatus.value
  if (props.deviceId === 'hand-warmer')
    return warmer.syncStatus.value
  return television.syncStatus.value
})
const syncLabel = computed(() => {
  if (syncStatus.value === 'syncing')
    return '同步中'
  if (syncStatus.value === 'synced')
    return '云端同步'
  if (syncStatus.value === 'unauthorized')
    return '游客本地'
  if (syncStatus.value === 'error')
    return '等待重连'
  return '本地设备'
})

function toggleAc() {
  airConditioner.dispatch({ type: 'toggleStatus' })
}

function changeAcTemperature(delta: number) {
  airConditioner.dispatch({ type: delta > 0 ? 'increment' : 'decrement' })
}

function setAcMode(mode: 'cold' | 'hot') {
  airConditioner.dispatch({ type: 'mode', mode })
}

function toggleFan() {
  fan.dispatch({ type: 'toggle' })
}

function setFanSpeed(speed: 1 | 2 | 3) {
  fan.dispatch({ type: 'set-speed', speed })
}

function toggleFanOscillation() {
  fan.dispatch({ type: 'toggle-oscillation' })
}

function setRobotMode(mode: RobotVacuumState['mode']) {
  robot.dispatch({ type: 'set-mode', mode })
}

function toggleRobot() {
  robot.dispatch({ type: robotState.value.status === 'cleaning' ? 'pause' : 'start' })
}

function returnRobot() {
  robot.dispatch({ type: 'return' })
}

function toggleWarmer() {
  warmer.dispatch({ type: 'toggle' })
}

function setWarmerLevel(level: HandWarmerState['level']) {
  warmer.dispatch({ type: 'set-level', level })
}

function toggleTelevisionPower() {
  television.dispatch({ type: 'toggle-power' })
}

function toggleTelevisionPlayback() {
  television.dispatch({ type: televisionState.value.playing ? 'pause' : 'play' })
}

function setTelevisionVolume(event: Event) {
  television.dispatch({ type: 'set-volume', volume: Number((event.target as HTMLInputElement).value) })
}

function toggleTelevisionMuted() {
  television.dispatch({ type: 'toggle-muted' })
}
</script>

<template>
  <aside class="quick-control" :class="{ 'is-standalone': standalone }" :aria-label="`${definition.name}快捷控制`">
    <header class="quick-control__header">
      <div class="quick-control__device">
        <span class="quick-control__thumb"><HomeDeviceGlyph :device-id="deviceId" :title="definition.name" /></span>
        <span><small>快捷控制</small><strong>{{ definition.name }}</strong></span>
      </div>
      <button v-if="!standalone" type="button" aria-label="关闭快捷控制" @click="emit('close')">
        <span class="i-carbon-close" />
      </button>
    </header>

    <div class="quick-control__sync" role="status" aria-live="polite" aria-atomic="true">
      <span />{{ syncLabel }}
    </div>

    <section v-if="deviceId === 'air-conditioner'" class="quick-control__body">
      <div class="quick-control__hero">
        <button class="power-orb" :class="{ 'is-on': acState.status }" type="button" :aria-label="acState.status ? '关闭空调' : '开启空调'" :aria-pressed="acState.status" @click="toggleAc">
          <span class="i-carbon-power" />
        </button>
        <div><strong>{{ acState.temperature }}<sup>°C</sup></strong><small>{{ acState.status ? (acState.mode === 'cold' ? '制冷运行中' : '制热运行中') : '待机' }}</small></div>
      </div>
      <div class="control-stepper">
        <button type="button" aria-label="降低温度" :disabled="acState.temperature <= 16" @click="changeAcTemperature(-1)">
          −
        </button><span>目标温度</span><button type="button" aria-label="升高温度" :disabled="acState.temperature >= 31" @click="changeAcTemperature(1)">
          ＋
        </button>
      </div>
      <div class="control-segments">
        <button :class="{ active: acState.mode === 'cold' }" type="button" :aria-pressed="acState.mode === 'cold'" @click="setAcMode('cold')">
          <span class="i-carbon-snowflake" />制冷
        </button>
        <button :class="{ active: acState.mode === 'hot' }" type="button" :aria-pressed="acState.mode === 'hot'" @click="setAcMode('hot')">
          <span class="i-carbon-heat" />制热
        </button>
      </div>
    </section>

    <section v-else-if="deviceId === 'fan'" class="quick-control__body">
      <div class="quick-control__hero">
        <button class="power-orb" :class="{ 'is-on': fanState.power }" type="button" :aria-label="fanState.power ? '关闭风扇' : '开启风扇'" :aria-pressed="fanState.power" @click="toggleFan">
          <span class="i-carbon-power" />
        </button>
        <div><strong>{{ fanState.speed }}<sup>档</sup></strong><small>{{ fanState.power ? (fanState.oscillating ? '柔风摇头中' : '定向送风中') : '待机' }}</small></div>
      </div>
      <div class="control-segments is-three">
        <button v-for="speed in ([1, 2, 3] as const)" :key="speed" :class="{ active: fanState.speed === speed }" type="button" :aria-pressed="fanState.speed === speed" @click="setFanSpeed(speed)">
          {{ speed }} 档
        </button>
      </div>
      <button class="wide-toggle" :class="{ active: fanState.oscillating }" type="button" :aria-pressed="fanState.oscillating" @click="toggleFanOscillation">
        <span class="i-carbon-renew" />{{ fanState.oscillating ? '摇头已开启' : '开启摇头' }}
      </button>
    </section>

    <section v-else-if="deviceId === 'robot-vacuum'" class="quick-control__body">
      <div class="quick-control__hero">
        <button class="power-orb" :class="{ 'is-on': robotState.status === 'cleaning' }" type="button" :aria-label="robotState.status === 'cleaning' ? '暂停清扫' : '开始清扫'" :aria-pressed="robotState.status === 'cleaning'" @click="toggleRobot">
          <span :class="robotState.status === 'cleaning' ? 'i-carbon-pause' : 'i-carbon-play'" />
        </button>
        <div><strong>{{ Math.round(robotVisualProgress * 100) }}<sup>%</sup></strong><small>{{ robotState.status === 'cleaning' ? '正在规划路线清扫' : robotState.status === 'paused' ? '清扫已暂停' : robotState.status === 'returning' ? '正在返回基站' : '基站待命' }}</small></div>
      </div>
      <div class="robot-stats">
        <span><small>电量</small><strong>{{ robotState.battery }}%</strong></span><span><small>已清扫</small><strong>{{ Math.round(robotVisualProgress * 32) }} m²</strong></span>
      </div>
      <div class="control-segments is-three">
        <button v-for="mode in (['quiet', 'standard', 'turbo'] as const)" :key="mode" :class="{ active: robotState.mode === mode }" type="button" :aria-pressed="robotState.mode === mode" @click="setRobotMode(mode)">
          {{ { quiet: '安静', standard: '标准', turbo: '强力' }[mode] }}
        </button>
      </div>
      <button class="wide-toggle" type="button" @click="returnRobot">
        <span class="i-carbon-home" />返回充电基站
      </button>
    </section>

    <section v-else-if="deviceId === 'hand-warmer'" class="quick-control__body">
      <div class="quick-control__hero">
        <button class="power-orb is-warm" :class="{ 'is-on': warmerState.power }" type="button" :aria-label="warmerState.power ? '关闭暖手宝' : '开启暖手宝'" :aria-pressed="warmerState.power" @click="toggleWarmer">
          <span class="i-carbon-power" />
        </button>
        <div><strong>{{ warmerState.temperature }}<sup>°C</sup></strong><small>{{ warmerState.power ? '暖意正在缓缓升温' : '轻触开启温暖' }}</small></div>
      </div>
      <div class="control-segments is-three">
        <button v-for="level in (['low', 'medium', 'high'] as const)" :key="level" :class="{ active: warmerState.level === level }" type="button" :aria-pressed="warmerState.level === level" @click="setWarmerLevel(level)">
          {{ { low: '低温', medium: '舒适', high: '高温' }[level] }}
        </button>
      </div>
      <div class="quick-control__note">
        <span class="i-carbon-time" />连续使用 2 小时后自动关闭
      </div>
    </section>

    <section v-else class="quick-control__body">
      <div class="quick-control__hero">
        <button class="power-orb is-television" :class="{ 'is-on': televisionState.power }" type="button" :aria-label="televisionState.power ? '关闭电视' : '开启电视'" :aria-pressed="televisionState.power" @click="toggleTelevisionPower">
          <span class="i-carbon-power" />
        </button>
        <div><strong>{{ televisionState.volume }}<sup>%</sup></strong><small>{{ televisionState.power ? (televisionState.playing ? '在线视频播放中' : '电视已开启') : '待机' }}</small></div>
      </div>
      <div class="television-remote">
        <button type="button" :disabled="!televisionState.power" :aria-label="televisionState.playing ? '暂停视频' : '播放视频'" @click="toggleTelevisionPlayback">
          <span :class="televisionState.playing ? 'i-carbon-pause-filled' : 'i-carbon-play-filled-alt'" />{{ televisionState.playing ? '暂停' : '播放' }}
        </button>
        <button type="button" :disabled="!televisionState.power" :aria-label="televisionState.muted ? '取消静音' : '静音'" :aria-pressed="televisionState.muted" @click="toggleTelevisionMuted">
          <span :class="televisionState.muted ? 'i-carbon-volume-mute' : 'i-carbon-volume-up'" />{{ televisionState.muted ? '取消静音' : '静音' }}
        </button>
      </div>
      <label class="volume-control">
        <span class="i-carbon-volume-down" /><span class="sr-only">电视音量</span>
        <input :value="televisionState.volume" type="range" min="0" max="100" step="1" :disabled="!televisionState.power" @input="setTelevisionVolume">
        <span class="i-carbon-volume-up" />
      </label>
      <div class="quick-control__note">
        <span class="i-carbon-play-outline" />支持 HTTPS MP4 / WebM 在线片源
      </div>
    </section>

    <NuxtLink v-if="!standalone" class="quick-control__full" :to="definition.route">
      完整控制 <span class="i-carbon-arrow-right" />
    </NuxtLink>
  </aside>
</template>

<style scoped>
.quick-control { display: grid; gap: 15px; width: 310px; padding: 18px; border: 1px solid rgba(173, 186, 218, 0.64); border-radius: 24px; background: rgba(249, 251, 255, 0.92); box-shadow: 0 24px 70px rgba(47, 62, 103, 0.23); color: #35405a; backdrop-filter: blur(22px); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
.quick-control.is-standalone { width: min(100%, 420px); }
.quick-control__header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.quick-control__header > button { display: grid; place-items: center; width: 30px; height: 30px; border: 0; border-radius: 10px; background: rgba(229, 234, 247, 0.8); color: #75809a; cursor: pointer; }
.quick-control__device { display: flex; align-items: center; gap: 11px; min-width: 0; }
.quick-control__device > span:last-child { display: grid; gap: 2px; }
.quick-control__device small { color: #929caf; font-size: 9px; font-weight: 650; letter-spacing: 0.08em; }
.quick-control__device strong { font-size: 14px; }
.quick-control__thumb { display: grid; place-items: center; overflow: hidden; width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(145deg, #fff, #e9effa); }
.quick-control__thumb :deep(.device-glyph) { width: 88%; height: 88%; }
.quick-control__sync { display: inline-flex; align-items: center; gap: 7px; width: fit-content; color: #8b95aa; font-size: 10px; }
.quick-control__sync span { width: 6px; height: 6px; border-radius: 50%; background: #62c6a6; box-shadow: 0 0 0 4px rgba(98, 198, 166, 0.11); }
.quick-control__body { display: grid; gap: 15px; }
.quick-control__hero { display: grid; grid-template-columns: 76px 1fr; align-items: center; gap: 16px; padding: 12px; border-radius: 20px; background: linear-gradient(145deg, rgba(230, 236, 251, 0.95), rgba(250, 251, 255, 0.86)); }
.quick-control__hero > div:last-child { display: grid; gap: 3px; }
.quick-control__hero strong { color: #34405c; font-size: 32px; font-weight: 640; letter-spacing: -0.05em; }
.quick-control__hero sup { margin-left: 2px; color: #7384b7; font-size: 13px; letter-spacing: 0; }
.quick-control__hero small { color: #8792aa; font-size: 10px; }
.power-orb { display: grid; place-items: center; width: 68px; height: 68px; border: 1px solid rgba(143, 161, 210, 0.42); border-radius: 50%; background: linear-gradient(145deg, #fdfdff, #dce5fa); box-shadow: 6px 7px 15px rgba(77, 98, 150, 0.14), inset 0 1px 2px white; color: #7d8daf; font-size: 21px; cursor: pointer; }
.power-orb.is-on { border-color: rgba(115, 145, 232, 0.68); background: linear-gradient(145deg, #8ca5ed, #6c81ce); box-shadow: 0 0 0 7px rgba(111, 139, 223, 0.12), 0 10px 22px rgba(75, 98, 173, 0.3); color: white; }
.power-orb.is-warm.is-on { border-color: rgba(232, 164, 135, 0.7); background: linear-gradient(145deg, #f4ae8e, #df8f77); box-shadow: 0 0 0 7px rgba(236, 164, 134, 0.12), 0 10px 22px rgba(183, 111, 88, 0.24); }
.power-orb.is-television { border-color: rgba(81, 91, 111, 0.5); background: linear-gradient(145deg, #4d5668, #262d3a); color: #abb6cc; }
.power-orb.is-television.is-on { border-color: rgba(126, 159, 235, 0.78); background: linear-gradient(145deg, #728ed0, #435a94); box-shadow: 0 0 0 7px rgba(92, 123, 197, 0.13), 0 10px 22px rgba(51, 68, 112, 0.34); color: white; }
.control-stepper { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; overflow: hidden; height: 42px; border: 1px solid rgba(171, 185, 218, 0.5); border-radius: 14px; background: rgba(245, 248, 254, 0.88); text-align: center; }
.control-stepper button { height: 100%; border: 0; background: transparent; color: #6679ac; font-size: 18px; cursor: pointer; }
.control-stepper button:disabled { color: #b2bacb; cursor: not-allowed; }
.control-stepper span { color: #8792a9; font-size: 10px; }
.control-segments { display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px; padding: 4px; border-radius: 14px; background: #e9eef8; }
.control-segments.is-three { grid-template-columns: repeat(3, 1fr); }
.control-segments button { display: flex; align-items: center; justify-content: center; gap: 5px; min-height: 34px; border: 0; border-radius: 10px; background: transparent; color: #7c879f; font: inherit; font-size: 10px; font-weight: 650; cursor: pointer; }
.control-segments button.active { background: rgba(255, 255, 255, 0.96); box-shadow: 0 4px 11px rgba(73, 91, 132, 0.13); color: #6277b8; }
.wide-toggle { display: flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; border: 1px solid rgba(165, 180, 216, 0.5); border-radius: 13px; background: rgba(246, 248, 253, 0.9); color: #6c7893; font: inherit; font-size: 10px; font-weight: 650; cursor: pointer; }
.wide-toggle.active { border-color: rgba(122, 150, 222, 0.7); color: #5f76b9; }
.robot-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.robot-stats span { display: grid; gap: 2px; padding: 10px 12px; border-radius: 13px; background: #edf1f8; }
.robot-stats small { color: #9099ac; font-size: 9px; }
.robot-stats strong { font-size: 13px; }
.quick-control__note { display: flex; align-items: center; gap: 7px; color: #929caf; font-size: 9px; }
.television-remote { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.television-remote button { display: flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; border: 1px solid rgba(151, 169, 211, 0.5); border-radius: 13px; background: rgba(245, 248, 254, 0.94); color: #65769e; font: inherit; font-size: 10px; font-weight: 700; cursor: pointer; }
.television-remote button:disabled { cursor: not-allowed; opacity: .45; }
.volume-control { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 9px; color: #7a88a6; font-size: 14px; }
.volume-control input { width: 100%; accent-color: #7188cf; cursor: pointer; }
.volume-control input:disabled { cursor: not-allowed; opacity: .45; }
.quick-control__full { display: flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; border-radius: 13px; background: #7589d5; box-shadow: 0 9px 20px rgba(77, 100, 178, 0.24); color: white; font-size: 11px; font-weight: 700; text-decoration: none; }
@media (max-width: 720px) { .quick-control { width: 100%; padding: 15px; border-radius: 22px 22px 0 0; } .quick-control__hero { grid-template-columns: 64px 1fr; } .power-orb { width: 58px; height: 58px; } }
</style>
