<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import TelevisionScreen from './TelevisionScreen.vue'
import type { TelevisionState } from '~/types'
import { isTelevisionSourceUrl } from '~/utils/device'

const television = useDeviceState('television')
const state = computed(() => television.state.value as TelevisionState)
const sourceDraft = shallowRef('')
const sourceError = shallowRef<string | null>(null)
const sourceHost = computed(() => {
  try {
    return new URL(state.value.sourceUrl).hostname
  }
  catch {
    return '未知片源'
  }
})
const syncLabel = computed(() => {
  if (television.syncStatus.value === 'syncing')
    return '正在同步遥控状态'
  if (television.syncStatus.value === 'synced')
    return '遥控状态已同步到云端'
  if (television.syncStatus.value === 'error')
    return '状态保存在本地，等待重新连接'
  return '遥控状态保存在本地'
})

watch(
  () => state.value.sourceUrl,
  (sourceUrl) => {
    sourceDraft.value = sourceUrl
  },
  { immediate: true },
)

function togglePower() {
  television.dispatch({ type: 'toggle-power' })
}

function setPlayback(playing: boolean) {
  if (state.value.playing === playing)
    return
  television.dispatch({ type: playing ? 'play' : 'pause' })
}

function setVolume(volume: number) {
  if (state.value.volume === volume)
    return
  television.dispatch({ type: 'set-volume', volume })
}

function setVolumeFromInput(event: Event) {
  setVolume(Number((event.target as HTMLInputElement).value))
}

function setMuted(muted: boolean) {
  if (state.value.muted !== muted)
    television.dispatch({ type: 'toggle-muted' })
}

function applySource() {
  const sourceUrl = sourceDraft.value.trim()
  if (!isTelevisionSourceUrl(sourceUrl)) {
    sourceError.value = '请输入可公开访问的 HTTPS 视频直链'
    return
  }
  sourceError.value = null
  television.dispatch({ type: 'set-source', sourceUrl })
}
</script>

<template>
  <aside class="television-panel" aria-label="云端电视控制">
    <header class="television-panel__header">
      <span><small>客厅显示节点</small><strong>云端电视</strong></span>
      <span class="television-panel__sync" role="status"><i />{{ syncLabel }}</span>
    </header>

    <TelevisionScreen
      :power="state.power"
      :playing="state.playing"
      :volume="state.volume"
      :muted="state.muted"
      :source-url="state.sourceUrl"
      @request-power="togglePower"
      @playback-change="setPlayback"
      @volume-change="setVolume"
      @muted-change="setMuted"
    />

    <section class="television-panel__remote" aria-label="电视遥控器">
      <button class="remote-power" :class="{ 'is-on': state.power }" type="button" :aria-label="state.power ? '关闭电视' : '开启电视'" :aria-pressed="state.power" @click="togglePower">
        <span class="i-carbon-power" />
      </button>
      <button type="button" :disabled="!state.power" :aria-label="state.playing ? '暂停视频' : '播放视频'" @click="setPlayback(!state.playing)">
        <span :class="state.playing ? 'i-carbon-pause-filled' : 'i-carbon-play-filled-alt'" />{{ state.playing ? '暂停' : '播放' }}
      </button>
      <button type="button" :disabled="!state.power" :aria-label="state.muted ? '取消静音' : '静音'" :aria-pressed="state.muted" @click="setMuted(!state.muted)">
        <span :class="state.muted ? 'i-carbon-volume-mute' : 'i-carbon-volume-up'" />{{ state.muted ? '取消静音' : '静音' }}
      </button>
      <label class="remote-volume">
        <span>音量</span>
        <input :value="state.volume" type="range" min="0" max="100" step="1" :disabled="!state.power" @input="setVolumeFromInput">
        <strong>{{ state.volume }}%</strong>
      </label>
    </section>

    <form class="television-panel__source" @submit.prevent="applySource">
      <label for="television-source">在线视频地址</label>
      <div>
        <input id="television-source" v-model="sourceDraft" type="url" inputmode="url" spellcheck="false" :aria-invalid="Boolean(sourceError)" aria-describedby="television-source-help">
        <button type="submit">载入片源</button>
      </div>
      <p id="television-source-help" :class="{ 'is-error': sourceError }">
        <span :class="sourceError ? 'i-carbon-warning-alt' : 'i-carbon-link'" />
        {{ sourceError || `当前来源：${sourceHost}。支持 HTTPS MP4 / WebM 直链` }}
      </p>
    </form>
  </aside>
</template>

<style scoped>
.television-panel { display: grid; gap: 17px; width: min(100%, 560px); padding: 20px; border: 1px solid rgba(153, 169, 204, .66); border-radius: 26px; background: rgba(244, 247, 253, .94); box-shadow: 0 28px 78px rgba(42, 55, 87, .22); color: #35405a; backdrop-filter: blur(24px); }
.television-panel__header { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.television-panel__header > span:first-child { display: grid; gap: 2px; }
.television-panel__header small { color: #8994aa; font-size: 9px; font-weight: 700; letter-spacing: .08em; }
.television-panel__header strong { font-size: 16px; }
.television-panel__sync { display: inline-flex; align-items: center; gap: 7px; color: #8792a7; font-size: 9px; }
.television-panel__sync i { width: 6px; height: 6px; border-radius: 50%; background: #63c7a6; box-shadow: 0 0 0 4px rgba(99, 199, 166, .12); }
.television-panel__remote { display: grid; grid-template-columns: 46px 1fr 1fr minmax(150px, 1.5fr); gap: 8px; }
.television-panel__remote > button { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 42px; border: 1px solid rgba(154, 171, 210, .52); border-radius: 13px; background: #f9faff; color: #65749a; font: inherit; font-size: 10px; font-weight: 700; cursor: pointer; }
.television-panel__remote > button:disabled { cursor: not-allowed; opacity: .42; }
.television-panel__remote .remote-power { padding: 0; border-color: rgba(113, 125, 151, .5); background: #343c4b; color: #aeb9cf; font-size: 16px; }
.television-panel__remote .remote-power.is-on { border-color: #708bd2; background: #627bc0; color: white; box-shadow: 0 7px 16px rgba(77, 99, 167, .27); }
.remote-volume { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 7px; min-height: 42px; padding: 0 10px; border-radius: 13px; background: #e9eef8; color: #7c879e; font-size: 9px; }
.remote-volume input { min-width: 0; width: 100%; accent-color: #6f87cf; }
.remote-volume strong { color: #5c6d98; font-size: 9px; }
.television-panel__source { display: grid; gap: 7px; }
.television-panel__source > label { color: #697691; font-size: 10px; font-weight: 750; }
.television-panel__source > div { display: grid; grid-template-columns: minmax(0, 1fr) auto; overflow: hidden; border: 1px solid rgba(151, 169, 207, .62); border-radius: 13px; background: white; }
.television-panel__source input { min-width: 0; min-height: 42px; padding: 0 12px; border: 0; outline: 0; background: transparent; color: #3d4964; font: inherit; font-size: 10px; }
.television-panel__source input:focus-visible { box-shadow: inset 0 0 0 2px #7890d4; }
.television-panel__source button { border: 0; padding: 0 14px; background: #7185c9; color: white; font: inherit; font-size: 10px; font-weight: 750; cursor: pointer; }
.television-panel__source p { display: flex; align-items: center; gap: 6px; margin: 0; color: #8a95aa; font-size: 9px; }
.television-panel__source p.is-error { color: #c8757f; }
@media (max-width: 560px) { .television-panel { padding: 14px; border-radius: 21px; } .television-panel__header { align-items: flex-start; } .television-panel__sync { max-width: 130px; text-align: right; } .television-panel__remote { grid-template-columns: 44px 1fr 1fr; } .remote-volume { grid-column: 1 / -1; } .television-panel__source > div { grid-template-columns: 1fr; } .television-panel__source button { min-height: 38px; } }
</style>
