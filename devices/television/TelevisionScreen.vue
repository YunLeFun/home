<script setup lang="ts">
import { computed, onMounted, shallowRef, useTemplateRef, watch } from 'vue'

const props = defineProps<{
  power: boolean
  playing: boolean
  volume: number
  muted: boolean
  sourceUrl: string
}>()

const emit = defineEmits<{
  requestPower: []
  playbackChange: [playing: boolean]
  volumeChange: [volume: number]
  mutedChange: [muted: boolean]
}>()

const videoRef = useTemplateRef<HTMLVideoElement>('video')
const playbackBlocked = shallowRef(false)
const mediaError = shallowRef(false)
const statusLabel = computed(() => {
  if (!props.power)
    return '电视待机'
  if (mediaError.value)
    return '片源暂时无法播放'
  if (playbackBlocked.value)
    return '浏览器需要你确认播放'
  return props.playing ? '在线视频播放中' : '电视已开启'
})

function syncVolume() {
  const video = videoRef.value
  if (!video)
    return
  video.volume = Math.min(1, Math.max(0, props.volume / 100))
  video.muted = props.muted
}

async function syncPlayback() {
  const video = videoRef.value
  if (!video)
    return
  if (!props.power || !props.playing) {
    video.pause()
    playbackBlocked.value = false
    return
  }
  try {
    await video.play()
    playbackBlocked.value = false
    mediaError.value = false
  }
  catch {
    playbackBlocked.value = true
  }
}

function handleVolumeChange() {
  const video = videoRef.value
  if (!video)
    return
  emit('volumeChange', Math.round(video.volume * 100))
  emit('mutedChange', video.muted)
}

function handleMediaError() {
  mediaError.value = true
  playbackBlocked.value = false
  emit('playbackChange', false)
}

watch(
  () => [props.power, props.playing, props.sourceUrl] as const,
  () => {
    mediaError.value = false
    void syncPlayback()
  },
  { flush: 'post' },
)

watch(
  () => [props.volume, props.muted] as const,
  syncVolume,
  { flush: 'post' },
)

onMounted(() => {
  syncVolume()
  void syncPlayback()
})
</script>

<template>
  <div class="television" :class="{ 'is-on': power }">
    <div class="television__bezel">
      <div class="television__screen">
        <video
          v-show="power"
          ref="video"
          :src="power ? sourceUrl : undefined"
          preload="metadata"
          controls
          playsinline
          @canplay="syncPlayback"
          @play="emit('playbackChange', true)"
          @pause="emit('playbackChange', false)"
          @ended="emit('playbackChange', false)"
          @volumechange="handleVolumeChange"
          @error="handleMediaError"
        />

        <div v-if="!power" class="television__standby">
          <span class="television__cloud-mark"><span class="i-carbon-cloud" /></span>
          <strong>云之彼端</strong>
          <small>设备待机</small>
          <button type="button" @click="emit('requestPower')">
            <span class="i-carbon-power" />开启电视
          </button>
        </div>

        <div v-else-if="mediaError" class="television__message">
          <span class="i-carbon-warning-alt" />
          <strong>无法播放这个片源</strong>
          <small>请检查地址是否为可公开访问的 HTTPS 视频直链</small>
        </div>

        <button v-else-if="!playing || playbackBlocked" class="television__play" type="button" @click="playbackBlocked ? syncPlayback() : emit('playbackChange', true)">
          <span class="i-carbon-play-filled-alt" />
          {{ playbackBlocked ? '确认播放' : '播放在线视频' }}
        </button>
      </div>
      <div class="television__hardware">
        <span class="television__speaker" />
        <span class="television__brand">YUN VIEW</span>
        <span class="television__led" :class="{ 'is-on': power }" />
      </div>
    </div>
    <div class="television__neck" />
    <div class="television__base" />
    <span class="sr-only" role="status">{{ statusLabel }}</span>
  </div>
</template>

<style scoped>
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
.television { --tv-metal: #262d39; width: 100%; color: white; }
.television__bezel { position: relative; padding: 10px 10px 7px; border: 1px solid #5d6677; border-radius: 16px; background: linear-gradient(145deg, #444c5b, var(--tv-metal) 42%, #171d27); box-shadow: 0 24px 52px rgba(20, 27, 40, .36), inset 0 1px rgba(255, 255, 255, .14); }
.television__screen { position: relative; display: grid; overflow: hidden; aspect-ratio: 16 / 9; border: 1px solid #0b1018; border-radius: 9px; background: radial-gradient(circle at 52% 45%, #263550, #080d16 72%); box-shadow: inset 0 0 28px rgba(0, 0, 0, .72); }
.television__screen::after { position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(118deg, rgba(255,255,255,.12), transparent 26%, transparent 72%, rgba(133,159,210,.06)); content: ''; pointer-events: none; }
.television__screen video { width: 100%; height: 100%; object-fit: cover; background: #080d16; }
.television__standby, .television__message { position: absolute; z-index: 2; inset: 0; display: grid; place-content: center; justify-items: center; gap: 6px; padding: 20px; text-align: center; }
.television__cloud-mark { display: grid; place-items: center; width: 54px; height: 54px; margin-bottom: 5px; border: 1px solid rgba(167, 190, 238, .25); border-radius: 18px; background: rgba(89, 111, 158, .16); color: #8fa5d1; font-size: 26px; }
.television__standby strong { font-size: 18px; letter-spacing: .08em; }
.television__standby small, .television__message small { max-width: 290px; color: #8794ac; font-size: 11px; line-height: 1.55; }
.television__standby button, .television__play { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 38px; margin-top: 8px; padding: 0 14px; border: 1px solid rgba(139, 166, 228, .52); border-radius: 12px; background: rgba(83, 109, 170, .32); color: #dce7ff; font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; }
.television__message { color: #e7ebf5; }
.television__message > span { margin-bottom: 3px; color: #e9b58f; font-size: 28px; }
.television__play { position: absolute; z-index: 3; place-self: center; min-height: 44px; border-color: rgba(255,255,255,.48); background: rgba(28, 38, 59, .72); box-shadow: 0 10px 28px rgba(0,0,0,.28); backdrop-filter: blur(10px); }
.television__hardware { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; min-height: 20px; padding: 3px 7px 0; }
.television__speaker { width: 44px; height: 3px; border-radius: 999px; background: repeating-linear-gradient(90deg, #687180 0 2px, transparent 2px 4px); opacity: .55; }
.television__brand { color: #828b9b; font-size: 7px; font-weight: 800; letter-spacing: .18em; }
.television__led { justify-self: end; width: 5px; height: 5px; border-radius: 50%; background: #788191; }
.television__led.is-on { background: #66cba9; box-shadow: 0 0 7px rgba(102, 203, 169, .9); }
.television__neck { width: 14%; height: 14px; margin: 0 auto; background: linear-gradient(90deg, #202631, #586170, #222934); clip-path: polygon(26% 0, 74% 0, 100% 100%, 0 100%); }
.television__base { width: 34%; height: 7px; margin: 0 auto; border-radius: 50% 50% 3px 3px; background: linear-gradient(180deg, #596271, #202630); box-shadow: 0 7px 12px rgba(22, 29, 41, .26); }
@media (max-width: 520px) { .television__bezel { padding: 7px 7px 5px; border-radius: 12px; } .television__screen { border-radius: 6px; } .television__hardware { min-height: 16px; } }
</style>
