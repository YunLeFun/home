import { computed, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'
import type { TelevisionState } from '~/types'

export function useSceneTelevision(state: () => TelevisionState, enabled: () => boolean, onPause: () => void) {
  const video = useTemplateRef<HTMLVideoElement>('sceneVideo')
  const frameSource = shallowRef<HTMLVideoElement | null>(null)
  const status = shallowRef<'idle' | 'blocked' | 'error'>('idle')
  const source = computed(() => state().sourceUrl)
  const wantsPlayback = computed(() => enabled() && state().power && state().playing)
  let attempt = 0

  function mediaError() {
    if (!video.value?.error || !video.value.getAttribute('src'))
      return
    frameSource.value = null
    status.value = 'error'
    onPause()
  }

  async function play() {
    const element = video.value
    if (!element || !wantsPlayback.value)
      return
    const request = ++attempt
    status.value = 'idle'
    if (element.getAttribute('src') !== source.value)
      element.src = source.value
    try {
      await element.play()
    }
    catch (error) {
      if (request !== attempt || !wantsPlayback.value)
        return
      if (error instanceof DOMException && error.name === 'NotAllowedError')
        status.value = 'blocked'
      else if (element.error)
        mediaError()
    }
  }

  function loadedFrame() {
    const element = video.value
    if (state().power && element?.videoWidth && element.getAttribute('src') === source.value)
      frameSource.value = element
  }

  watch([video, source, () => state().power, wantsPlayback], ([element, url, power, playing], previous) => {
    if (!element)
      return
    const sourceChanged = previous?.[1] !== url
    if (!power || sourceChanged) {
      frameSource.value = null
      status.value = 'idle'
      if (element.hasAttribute('src')) {
        element.removeAttribute('src')
        element.load()
      }
    }
    if (playing) {
      void play()
    }
    else {
      attempt++
      element.pause()
    }
  }, { flush: 'post' })

  watch([video, () => state().volume, () => state().muted], ([element, volume, muted]) => {
    if (element) {
      element.volume = volume / 100
      element.muted = muted
    }
  }, { flush: 'post' })

  onBeforeUnmount(() => {
    attempt++
    if (video.value?.hasAttribute('src')) {
      video.value.pause()
      video.value.removeAttribute('src')
      video.value.load()
    }
  })

  return { frameSource, status, play, loadedFrame, mediaError }
}
