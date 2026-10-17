import { computed, onMounted, onUnmounted } from 'vue'

/** Lighting phase of the home scene. */
export type ScenePhase = 'dawn' | 'day' | 'dusk' | 'night'

/**
 * Map a local hour to a lighting phase.
 *
 * @param hours - Hours since midnight, fractional
 * @returns The phase for that time of day
 */
export function phaseForHour(hours: number): ScenePhase {
  if (hours >= 5 && hours < 7.5)
    return 'dawn'
  if (hours >= 7.5 && hours < 17)
    return 'day'
  if (hours >= 17 && hours < 19.5)
    return 'dusk'
  return 'night'
}

/**
 * Wall-clock time and lighting phase for the home scene. Server rendering and
 * the first client paint use a fixed daytime so hydration matches; the real
 * time takes over after mount. Dark mode always shows night.
 */
export function useSceneTime() {
  // 10:10 is the conventional resting position of clock hands.
  const minutes = useState('scene-time-minutes', () => 10 * 60 + 10)
  const colorMode = useColorMode()
  let timer: ReturnType<typeof setInterval> | undefined

  function tick() {
    const now = new Date()
    minutes.value = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
  }

  onMounted(() => {
    tick()
    timer = setInterval(tick, 30_000)
  })

  onUnmounted(() => {
    if (timer)
      clearInterval(timer)
  })

  const phase = computed<ScenePhase>(() => colorMode.value === 'dark' ? 'night' : phaseForHour(minutes.value / 60))
  return { minutes, phase }
}
