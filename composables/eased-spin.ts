import type { Ref } from 'vue'
import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue'

interface EasedSpinOptions {
  /** Whether the targets should spin */
  active: () => boolean
  /** Speed multiplier; changes ease in without restarting the rotation */
  speed: () => number
  /** Seconds per turn at speed 1 */
  period?: number
  /** Milliseconds a speed change takes */
  ramp?: number
  /** Re-collect the targets when this changes, e.g. a new icon */
  key?: () => unknown
}

/**
 * Spin elements with the Web Animations API. Unlike a CSS animation, whose
 * angle jumps when its duration changes, the playback rate eases to a new
 * speed while the rotation carries on. Targets need their own
 * `transform-origin` and `transform-box`. Reduced motion keeps them still.
 *
 * @param root - Element containing the targets
 * @param selector - Selector of the elements to spin
 * @param options - Spin state
 */
export function useEasedSpin(root: Ref<Element | null>, selector: string, options: EasedSpinOptions) {
  const period = (options.period ?? 1.1) * 1000
  const ramp = options.ramp ?? 500
  let spins: Animation[] = []
  let rate = 1
  let rampFrame = 0

  function stop() {
    cancelAnimationFrame(rampFrame)
    for (const spin of spins)
      spin.cancel()
    spins = []
  }

  function target() {
    return Math.max(0.25, options.speed())
  }

  function rampTo(next: number) {
    cancelAnimationFrame(rampFrame)
    const from = rate
    const startedAt = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / ramp)
      rate = from + (next - from) * (1 - (1 - progress) ** 2)
      for (const spin of spins)
        spin.updatePlaybackRate(rate)
      if (progress < 1)
        rampFrame = requestAnimationFrame(step)
    }
    rampFrame = requestAnimationFrame(step)
  }

  function sync() {
    const element = root.value
    if (!element || typeof element.animate !== 'function')
      return
    if (!options.active() || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      stop()
      return
    }
    if (spins.length > 0) {
      rampTo(target())
      return
    }
    rate = target()
    spins = [...element.querySelectorAll<HTMLElement | SVGElement>(selector)].map(item => item.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      { duration: period, iterations: Infinity, delay: (Number.parseFloat(item.style.animationDelay) || 0) * 1000, fill: 'backwards' },
    ))
    for (const spin of spins)
      spin.updatePlaybackRate(rate)
  }

  onMounted(sync)
  watch(() => [options.active(), options.speed()], sync)
  if (options.key) {
    watch(options.key, () => {
      stop()
      nextTick(sync)
    })
  }
  onBeforeUnmount(stop)
}
