<script setup lang="ts">
import { computed } from 'vue'
import RollingNumber from '~/components/ui/RollingNumber.vue'

const props = withDefaults(defineProps<{
  deviceId?: string
}>(), {
  deviceId: 'television',
})

const device = useDeviceState('television', props.deviceId)
const state = computed(() => device.state.value)
const caption = computed(() => {
  if (!state.value.power)
    return '待机'
  return state.value.playing ? '在线视频播放中' : '电视已开启'
})

function setVolume(event: Event) {
  device.dispatch({ type: 'set-volume', volume: Number((event.target as HTMLInputElement).value) })
}
</script>

<template>
  <div class="tv-quick">
    <div class="ui-hero">
      <button class="ui-orb" :class="{ 'is-on': state.power }" type="button" :aria-label="state.power ? '关闭电视' : '开启电视'" :aria-pressed="state.power" @click="device.dispatch({ type: 'toggle-power' })">
        <span class="i-carbon-power" />
      </button>
      <div><strong><RollingNumber :value="state.volume" /><sup>%</sup></strong><small>{{ caption }}</small></div>
    </div>
    <div class="tv-quick__remote">
      <button class="ui-wide" type="button" :disabled="!state.power" :aria-label="state.playing ? '暂停视频' : '播放视频'" @click="device.dispatch({ type: state.playing ? 'pause' : 'play' })">
        <span :class="state.playing ? 'i-carbon-pause-filled' : 'i-carbon-play-filled-alt'" />{{ state.playing ? '暂停' : '播放' }}
      </button>
      <button class="ui-wide" type="button" :disabled="!state.power" :aria-label="state.muted ? '取消静音' : '静音'" :aria-pressed="state.muted" @click="device.dispatch({ type: 'toggle-muted' })">
        <span :class="state.muted ? 'i-carbon-volume-mute' : 'i-carbon-volume-up'" />{{ state.muted ? '取消静音' : '静音' }}
      </button>
    </div>
    <label class="tv-quick__volume">
      <span class="i-carbon-volume-down" /><span class="sr-only">电视音量</span>
      <input :value="state.volume" type="range" min="0" max="100" step="1" :disabled="!state.power" :style="{ '--fill': `${state.volume}%` }" @input="setVolume">
      <span class="i-carbon-volume-up" />
    </label>
    <p class="ui-note">
      <span class="i-carbon-play-outline" />支持 HTTPS MP4 / WebM 在线片源
    </p>
  </div>
</template>

<style scoped>
.tv-quick { display: grid; gap: 14px; }
.tv-quick__remote { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.tv-quick__volume { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 9px; color: var(--brand-muted); font-size: 14px; }
.tv-quick__volume input { --fill: 0%; width: 100%; height: 6px; border-radius: 999px; appearance: none; background: linear-gradient(90deg, var(--brand-secondary) var(--fill), var(--brand-glass-sunken) var(--fill)); cursor: pointer; }
.tv-quick__volume input::-webkit-slider-thumb { width: 18px; height: 18px; border: 3px solid var(--brand-glass-strong); border-radius: 50%; appearance: none; background: var(--brand-secondary); box-shadow: var(--shadow-sm); transition: transform var(--dur-2) var(--ease-spring); }
.tv-quick__volume input:active::-webkit-slider-thumb { transform: scale(1.2); }
.tv-quick__volume input:disabled { cursor: not-allowed; opacity: 0.45; }
</style>
