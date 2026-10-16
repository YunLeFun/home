<script setup lang="ts">
import type { DeviceKind, FanState, HandWarmerState, RobotVacuumState, TelevisionState } from '~/types'
import { computed } from 'vue'
import HomeDeviceGlyph from './HomeDeviceGlyph.vue'
import RollingNumber from '~/components/ui/RollingNumber.vue'
import { HOME_DEVICES } from '~/constants/home'
import { resolveDevicePluginComponent } from '~/devices/registry'
import { getDeviceTone, isDeviceRunning } from '~/utils/device'

const props = withDefaults(defineProps<{
  deviceId: DeviceKind
  standalone?: boolean
}>(), { standalone: false })

const emit = defineEmits<{ close: [] }>()
const devices = {
  'air-conditioner': useDeviceState('air-conditioner'),
  'fan': useDeviceState('fan'),
  'robot-vacuum': useDeviceState('robot-vacuum'),
  'hand-warmer': useDeviceState('hand-warmer'),
  'television': useDeviceState('television'),
}
const fan = devices.fan
const robot = devices['robot-vacuum']
const warmer = devices['hand-warmer']
const television = devices.television
const current = computed(() => devices[props.deviceId])
const definition = computed(() => HOME_DEVICES[props.deviceId])
const pluginControl = computed(() => resolveDevicePluginComponent(props.deviceId, 'quickControl'))
const running = computed(() => isDeviceRunning(props.deviceId, current.value.state.value))
const tone = computed(() => getDeviceTone(props.deviceId, current.value.state.value))
const fanState = computed(() => fan.state.value as FanState)
const robotState = computed(() => robot.state.value as RobotVacuumState)
const warmerState = computed(() => warmer.state.value as HandWarmerState)
const televisionState = computed(() => television.state.value as TelevisionState)
const robotVisualProgress = computed(() => robot.visualProgress.value)

const syncStatus = computed(() => current.value.binding.value ? current.value.linkStatus.value : current.value.syncStatus.value)
const syncLabel = computed(() => {
  if (current.value.binding.value)
    return current.value.linkLabel.value
  const status = current.value.syncStatus.value
  if (status === 'syncing')
    return '同步中'
  if (status === 'synced')
    return '云端同步'
  if (status === 'unauthorized')
    return '游客本地'
  if (status === 'error')
    return '等待重连'
  return '本地设备'
})

const ROBOT_MODES = ['quiet', 'standard', 'turbo'] as const
const WARMER_LEVELS = ['low', 'medium', 'high'] as const

function setTelevisionVolume(event: Event) {
  television.dispatch({ type: 'set-volume', volume: Number((event.target as HTMLInputElement).value) })
}
</script>

<template>
  <aside class="quick-control ui-card" :class="{ 'is-standalone': standalone }" :data-tone="tone" :aria-label="`${definition.name}快捷控制`">
    <span class="quick-control__glow" aria-hidden="true" />
    <header class="quick-control__header">
      <div class="quick-control__device">
        <span class="quick-control__thumb" :class="{ 'is-running': running }">
          <HomeDeviceGlyph :device-id="deviceId" :active="running" :tone="tone" :title="definition.name" />
        </span>
        <span><small>{{ standalone ? '设备控制' : '快捷控制' }}</small><strong>{{ definition.name }}</strong></span>
      </div>
      <button v-if="!standalone" class="quick-control__close" type="button" aria-label="关闭快捷控制" @click="emit('close')">
        <span class="i-carbon-close" />
      </button>
    </header>

    <span class="ui-chip" :data-status="syncStatus" role="status" aria-live="polite" aria-atomic="true"><i />{{ syncLabel }}</span>

    <Transition name="body-swap" mode="out-in">
      <section :key="deviceId" class="quick-control__body">
        <component :is="pluginControl" v-if="pluginControl" />

        <template v-else-if="deviceId === 'fan'">
          <div class="quick-control__hero">
            <button class="ui-orb" :class="{ 'is-on': fanState.power }" type="button" :aria-label="fanState.power ? '关闭风扇' : '开启风扇'" :aria-pressed="fanState.power" @click="fan.dispatch({ type: 'toggle' })">
              <span class="i-carbon-power" />
            </button>
            <div><strong><RollingNumber :value="fanState.speed" /><sup>档</sup></strong><small>{{ fanState.power ? (fanState.oscillating ? '柔风摇头中' : '定向送风中') : '待机' }}</small></div>
          </div>
          <div class="ui-segments" :style="{ '--count': 3, '--index': fanState.speed - 1 }">
            <button v-for="speed in ([1, 2, 3] as const)" :key="speed" type="button" :aria-pressed="fanState.speed === speed" @click="fan.dispatch({ type: 'set-speed', speed })">
              {{ speed }} 档
            </button>
          </div>
          <button class="ui-wide" type="button" :aria-pressed="fanState.oscillating" @click="fan.dispatch({ type: 'toggle-oscillation' })">
            <span class="i-carbon-renew" :class="{ 'is-spinning': fanState.power && fanState.oscillating }" />{{ fanState.oscillating ? '摇头已开启' : '开启摇头' }}
          </button>
        </template>

        <template v-else-if="deviceId === 'robot-vacuum'">
          <div class="quick-control__hero">
            <button class="ui-orb" :class="{ 'is-on': robotState.status === 'cleaning' }" type="button" :aria-label="robotState.status === 'cleaning' ? '暂停清扫' : '开始清扫'" :aria-pressed="robotState.status === 'cleaning'" @click="robot.dispatch({ type: robotState.status === 'cleaning' ? 'pause' : 'start' })">
              <span :class="robotState.status === 'cleaning' ? 'i-carbon-pause' : 'i-carbon-play'" />
            </button>
            <div><strong><RollingNumber :value="Math.round(robotVisualProgress * 100)" /><sup>%</sup></strong><small>{{ robotState.status === 'cleaning' ? '正在规划路线清扫' : robotState.status === 'paused' ? '清扫已暂停' : robotState.status === 'returning' ? '正在返回基站' : '基站待命' }}</small></div>
          </div>
          <div class="quick-control__progress" role="progressbar" aria-label="清扫进度" :aria-valuenow="Math.round(robotVisualProgress * 100)" aria-valuemin="0" aria-valuemax="100">
            <span :style="{ transform: `scaleX(${robotVisualProgress})` }" />
          </div>
          <div class="robot-stats">
            <span><small>电量</small><strong class="numeric">{{ robotState.battery }}%</strong></span><span><small>已清扫</small><strong class="numeric">{{ Math.round(robotVisualProgress * 32) }} m²</strong></span>
          </div>
          <div class="ui-segments" :style="{ '--count': 3, '--index': ROBOT_MODES.indexOf(robotState.mode) }">
            <button v-for="mode in ROBOT_MODES" :key="mode" type="button" :aria-pressed="robotState.mode === mode" @click="robot.dispatch({ type: 'set-mode', mode })">
              {{ { quiet: '安静', standard: '标准', turbo: '强力' }[mode] }}
            </button>
          </div>
          <button class="ui-wide" type="button" @click="robot.dispatch({ type: 'return' })">
            <span class="i-carbon-home" />返回充电基站
          </button>
        </template>

        <template v-else-if="deviceId === 'hand-warmer'">
          <div class="quick-control__hero">
            <button class="ui-orb" data-tone="warm" :class="{ 'is-on': warmerState.power }" type="button" :aria-label="warmerState.power ? '关闭暖手宝' : '开启暖手宝'" :aria-pressed="warmerState.power" @click="warmer.dispatch({ type: 'toggle' })">
              <span class="i-carbon-power" />
            </button>
            <div><strong><RollingNumber :value="warmerState.temperature" /><sup>°C</sup></strong><small>{{ warmerState.power ? '暖意正在缓缓升温' : '轻触开启温暖' }}</small></div>
          </div>
          <div class="ui-segments" :style="{ '--count': 3, '--index': WARMER_LEVELS.indexOf(warmerState.level) }">
            <button v-for="level in WARMER_LEVELS" :key="level" type="button" :aria-pressed="warmerState.level === level" style="--segment-tone: var(--tone-warm)" @click="warmer.dispatch({ type: 'set-level', level })">
              {{ { low: '低温', medium: '舒适', high: '高温' }[level] }}
            </button>
          </div>
          <div class="quick-control__note">
            <span class="i-carbon-time" />连续使用 2 小时后自动关闭
          </div>
        </template>

        <template v-else>
          <div class="quick-control__hero">
            <button class="ui-orb" :class="{ 'is-on': televisionState.power }" type="button" :aria-label="televisionState.power ? '关闭电视' : '开启电视'" :aria-pressed="televisionState.power" @click="television.dispatch({ type: 'toggle-power' })">
              <span class="i-carbon-power" />
            </button>
            <div><strong><RollingNumber :value="televisionState.volume" /><sup>%</sup></strong><small>{{ televisionState.power ? (televisionState.playing ? '在线视频播放中' : '电视已开启') : '待机' }}</small></div>
          </div>
          <div class="television-remote">
            <button class="ui-wide" type="button" :disabled="!televisionState.power" :aria-label="televisionState.playing ? '暂停视频' : '播放视频'" @click="television.dispatch({ type: televisionState.playing ? 'pause' : 'play' })">
              <span :class="televisionState.playing ? 'i-carbon-pause-filled' : 'i-carbon-play-filled-alt'" />{{ televisionState.playing ? '暂停' : '播放' }}
            </button>
            <button class="ui-wide" type="button" :disabled="!televisionState.power" :aria-label="televisionState.muted ? '取消静音' : '静音'" :aria-pressed="televisionState.muted" @click="television.dispatch({ type: 'toggle-muted' })">
              <span :class="televisionState.muted ? 'i-carbon-volume-mute' : 'i-carbon-volume-up'" />{{ televisionState.muted ? '取消静音' : '静音' }}
            </button>
          </div>
          <label class="volume-control">
            <span class="i-carbon-volume-down" /><span class="sr-only">电视音量</span>
            <input :value="televisionState.volume" type="range" min="0" max="100" step="1" :disabled="!televisionState.power" :style="{ '--fill': `${televisionState.volume}%` }" @input="setTelevisionVolume">
            <span class="i-carbon-volume-up" />
          </label>
          <div class="quick-control__note">
            <span class="i-carbon-play-outline" />支持 HTTPS MP4 / WebM 在线片源
          </div>
        </template>
      </section>
    </Transition>

    <NuxtLink v-if="!standalone" class="ui-cta" :to="definition.route">
      完整控制 <span class="i-carbon-arrow-right" />
    </NuxtLink>
  </aside>
</template>

<style scoped>
.quick-control {
  --qc-tone: var(--brand-secondary);
  position: relative;
  display: grid;
  gap: 14px;
  width: 316px;
  overflow: hidden;
  padding: 18px;
}

.quick-control[data-tone="cool"] { --qc-tone: var(--tone-cool); }
.quick-control[data-tone="heat"] { --qc-tone: var(--tone-heat); }
.quick-control[data-tone="warm"] { --qc-tone: var(--tone-warm); }
.quick-control.is-standalone { width: min(100%, 420px); }

/* Tinted light that follows the device state */
.quick-control__glow {
  position: absolute;
  z-index: -1;
  top: -40%;
  left: -20%;
  width: 140%;
  height: 80%;
  background: radial-gradient(closest-side, color-mix(in oklab, var(--qc-tone) 22%, transparent), transparent);
  opacity: 0.5;
  pointer-events: none;
  transition: background var(--dur-4) ease, opacity var(--dur-4) ease;
}

.quick-control:not([data-tone="idle"]) .quick-control__glow { opacity: 1; }
.quick-control__header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.quick-control__close { display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 11px; background: var(--brand-glass-sunken); color: var(--brand-muted); cursor: pointer; transition: transform var(--dur-2) var(--ease-spring), background var(--dur-1) ease; }
.quick-control__close:hover { transform: rotate(90deg); }
.quick-control__device { display: flex; align-items: center; gap: 11px; min-width: 0; }
.quick-control__device > span:last-child { display: grid; gap: 2px; }
.quick-control__device small { color: var(--brand-faint); font-size: 9px; font-weight: 650; letter-spacing: 0.1em; }
.quick-control__device strong { font-size: 15px; letter-spacing: -0.01em; }
.quick-control__thumb { display: grid; place-items: center; width: 50px; height: 50px; border-radius: 16px; background: linear-gradient(145deg, var(--brand-glass-strong), var(--brand-glass-sunken)); box-shadow: inset 0 1px 0 var(--brand-highlight); }
.quick-control:not(.is-standalone) .quick-control__thumb { view-transition-name: device-hero; }
.quick-control__thumb.is-running { animation: float-y 3.2s ease-in-out infinite; }
.quick-control__thumb :deep(.device-glyph) { width: 84%; height: 84%; }
.quick-control__body { display: grid; gap: 14px; }
.quick-control__hero { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 16px; padding: 12px; border-radius: 20px; background: var(--brand-glass-sunken); }
.quick-control__hero > div:last-child { display: grid; gap: 3px; }
.quick-control__hero strong { display: inline-flex; align-items: flex-start; color: var(--brand-ink); font-size: 34px; font-weight: 620; letter-spacing: -0.05em; line-height: 1; }
.quick-control__hero sup { margin: 4px 0 0 3px; color: var(--brand-muted); font-size: 12px; letter-spacing: 0; }
.quick-control__hero small { color: var(--brand-muted); font-size: 10px; }
.quick-control__progress { height: 6px; overflow: hidden; border-radius: 999px; background: var(--brand-glass-sunken); }
.quick-control__progress span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--brand-secondary), var(--tone-cool)); transform-origin: left; transition: transform var(--dur-3) var(--ease-out); }
.quick-control__note { display: flex; align-items: center; gap: 7px; color: var(--brand-faint); font-size: 10px; }
.robot-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.robot-stats span { display: grid; gap: 2px; padding: 10px 12px; border-radius: 14px; background: var(--brand-glass-sunken); }
.robot-stats small { color: var(--brand-faint); font-size: 9px; }
.robot-stats strong { font-size: 13px; }
.television-remote { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.volume-control { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 9px; color: var(--brand-muted); font-size: 14px; }
.volume-control input { --fill: 0%; width: 100%; height: 6px; border-radius: 999px; appearance: none; background: linear-gradient(90deg, var(--brand-secondary) var(--fill), var(--brand-glass-sunken) var(--fill)); cursor: pointer; }
.volume-control input::-webkit-slider-thumb { width: 18px; height: 18px; border: 3px solid var(--brand-glass-strong); border-radius: 50%; appearance: none; background: var(--brand-secondary); box-shadow: var(--shadow-sm); transition: transform var(--dur-2) var(--ease-spring); }
.volume-control input:active::-webkit-slider-thumb { transform: scale(1.2); }
.volume-control input:disabled { cursor: not-allowed; opacity: 0.45; }
.is-spinning { animation: spin 2.4s linear infinite; }
.body-swap-enter-active, .body-swap-leave-active { transition: opacity var(--dur-2) var(--ease-out), transform var(--dur-2) var(--ease-out); }
.body-swap-enter-from { opacity: 0; transform: translateY(8px); }
.body-swap-leave-to { opacity: 0; transform: translateY(-6px); }

@media (max-width: 720px) {
  .quick-control { width: 100%; padding: 16px 16px calc(16px + env(safe-area-inset-bottom)); border-radius: 26px 26px 0 0; }
  .quick-control:not(.is-standalone)::before { justify-self: center; width: 38px; height: 4px; margin: -6px 0 2px; border-radius: 999px; background: var(--brand-line-strong); content: ''; }
}
</style>
