<script setup lang="ts">
import type { FunctionalComponent } from 'vue'
import type { DevicePluginIcon, PluginIconShape } from '~/devices/icon'
import type { DeviceTone } from '~/devices/types'
import { computed, h, nextTick, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'

const props = withDefaults(defineProps<{
  icon: DevicePluginIcon
  /** Edge length in CSS pixels */
  size?: number
  active?: boolean
  tone?: DeviceTone
  /** Motion speed multiplier, e.g. a fan's speed level */
  speed?: number
  /** Accessible name; the icon is decorative when omitted */
  label?: string
}>(), {
  size: 48,
  active: false,
  tone: 'idle',
  speed: 1,
  label: '',
})

const PAINTS: Record<string, string> = {
  'tone': 'var(--pi-tone)',
  'tone-soft': 'var(--pi-tone-soft)',
  'surface': 'var(--pi-surface)',
  'ink': 'var(--pi-ink)',
}

function paint(value: string | undefined) {
  return value === undefined ? undefined : PAINTS[value] ?? value
}

function attributes(shape: PluginIconShape) {
  return {
    'd': shape.d,
    'cx': shape.cx,
    'cy': shape.cy,
    'r': shape.r,
    'rx': shape.rx,
    'ry': shape.ry,
    'x': shape.x,
    'y': shape.y,
    'width': shape.width,
    'height': shape.height,
    'x1': shape.x1,
    'y1': shape.y1,
    'x2': shape.x2,
    'y2': shape.y2,
    'points': shape.points,
    'fill': paint(shape.fill),
    'stroke': paint(shape.stroke),
    'stroke-width': shape.strokeWidth,
    'opacity': shape.opacity,
    'stroke-linecap': shape.linecap,
    'stroke-linejoin': shape.linejoin,
    'transform': shape.transform,
  }
}

// Shapes render through a fixed set of elements and attributes only.
const IconShape: FunctionalComponent<{ shape: PluginIconShape }> = ({ shape }) => {
  const tag = shape.type === 'group' ? 'g' : shape.type
  const children = shape.children?.map(child => h(IconShape, { shape: child }))
  let node = h(tag, attributes(shape), children)
  if (shape.motion) {
    // Wrap so the motion transform never replaces the shape's own transform.
    const [x, y] = shape.origin ?? [32, 32]
    node = h('g', {
      'class': `pi-motion pi-motion--${shape.motion}`,
      'style': { transformOrigin: `${x}px ${y}px`, animationDelay: shape.delay ? `${shape.delay}s` : undefined },
    }, [node])
  }
  if (shape.when)
    node = h('g', { class: `pi-when pi-when--${shape.when}` }, [node])
  return node
}
IconShape.props = ['shape']

const style = computed(() => ({
  '--pi-size': `${props.size}px`,
  '--pi-bg-1': props.icon.background[0],
  '--pi-bg-2': props.icon.background[1],
  '--pi-bg-dark-1': props.icon.backgroundDark?.[0] ?? `color-mix(in oklab, ${props.icon.background[0]} 62%, #14233a)`,
  '--pi-bg-dark-2': props.icon.backgroundDark?.[1] ?? `color-mix(in oklab, ${props.icon.background[1]} 58%, #0e1828)`,
}))

// Spin runs on the Web Animations API rather than CSS so that a speed change
// eases the playback rate without restarting or jumping the rotation.
const SPIN_PERIOD = 1100
const SPIN_RAMP = 500
const root = shallowRef<HTMLElement | null>(null)
let spins: Animation[] = []
let rate = 1
let rampFrame = 0

function stopSpins() {
  cancelAnimationFrame(rampFrame)
  for (const spin of spins)
    spin.cancel()
  spins = []
}

function targetRate() {
  return Math.max(0.25, props.speed)
}

function rampTo(target: number) {
  cancelAnimationFrame(rampFrame)
  const from = rate
  const startedAt = performance.now()
  const step = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / SPIN_RAMP)
    rate = from + (target - from) * (1 - (1 - progress) ** 2)
    for (const spin of spins)
      spin.updatePlaybackRate(rate)
    if (progress < 1)
      rampFrame = requestAnimationFrame(step)
  }
  rampFrame = requestAnimationFrame(step)
}

function syncSpins() {
  const element = root.value
  if (!element || typeof element.animate !== 'function')
    return
  if (!props.active || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    stopSpins()
    return
  }
  if (spins.length === 0) {
    rate = targetRate()
    spins = [...element.querySelectorAll<SVGGElement>('.pi-motion--spin')].map(target => target.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      { duration: SPIN_PERIOD, iterations: Infinity, delay: (Number.parseFloat(target.style.animationDelay) || 0) * 1000, fill: 'backwards' },
    ))
    for (const spin of spins)
      spin.updatePlaybackRate(rate)
    return
  }
  rampTo(targetRate())
}

onMounted(syncSpins)
watch(() => [props.active, props.speed], syncSpins)
watch(() => props.icon, () => {
  stopSpins()
  nextTick(syncSpins)
})
onBeforeUnmount(stopSpins)
</script>

<template>
  <span
    ref="root"
    class="plugin-icon"
    :data-active="active"
    :data-tone="tone"
    :style="style"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
  >
    <svg viewBox="0 0 64 64" focusable="false">
      <IconShape v-for="(shape, index) in icon.shapes" :key="index" :shape="shape" />
    </svg>
  </span>
</template>

<style>
.plugin-icon {
  --pi-tone: var(--tone-idle, #9aa6b8);
  --pi-tone-soft: color-mix(in oklab, var(--pi-tone) 30%, transparent);
  --pi-surface: #ffffff;
  --pi-ink: #3b4658;
  position: relative;
  display: inline-grid;
  flex: none;
  place-items: center;
  width: var(--pi-size);
  height: var(--pi-size);
  overflow: hidden;
  border-radius: 27%;
  background:
    radial-gradient(120% 90% at 25% 0%, rgba(255, 255, 255, 0.55), transparent 55%),
    linear-gradient(145deg, var(--pi-bg-1), var(--pi-bg-2));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.7),
    inset 0 -1px 0 rgba(15, 30, 60, 0.08),
    0 1px 2px rgba(15, 30, 60, 0.08),
    0 6px 14px -6px rgba(15, 30, 60, 0.22);
  isolation: isolate;
  transition: box-shadow var(--dur-3, 280ms) ease;
}

.plugin-icon > svg { width: 100%; height: 100%; overflow: visible; }

.plugin-icon[data-tone="cool"] { --pi-tone: var(--tone-cool, #4fb6ef); }
.plugin-icon[data-tone="heat"] { --pi-tone: var(--tone-heat, #ff8a6b); }
.plugin-icon[data-tone="warm"] { --pi-tone: var(--tone-warm, #ffb15c); }
.plugin-icon[data-tone="active"] { --pi-tone: var(--tone-active, #4fbf7a); }

.plugin-icon[data-active="true"] {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.7),
    inset 0 0 0 1.5px color-mix(in oklab, var(--pi-tone) 55%, transparent),
    0 1px 2px rgba(15, 30, 60, 0.08),
    0 8px 18px -6px color-mix(in oklab, var(--pi-tone) 60%, transparent);
}

.dark .plugin-icon {
  --pi-surface: #e9eef5;
  --pi-ink: #1f2836;
  background:
    radial-gradient(120% 90% at 25% 0%, rgba(255, 255, 255, 0.14), transparent 55%),
    linear-gradient(145deg, var(--pi-bg-dark-1), var(--pi-bg-dark-2));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    0 6px 14px -6px rgba(0, 0, 0, 0.5);
}

.plugin-icon .pi-when { transition: opacity 360ms ease; }
.plugin-icon[data-active="false"] .pi-when--active,
.plugin-icon[data-active="true"] .pi-when--idle { opacity: 0; }

/* Each motion uses fill-mode backwards: a delayed shape holds its first frame, so staggered shapes fade in rather than flash. */
.plugin-icon .pi-motion { transform-box: view-box; }
.plugin-icon[data-active="true"] .pi-motion--sway { animation: pi-sway 3.2s ease-in-out infinite backwards; }
.plugin-icon[data-active="true"] .pi-motion--pulse { animation: pi-pulse 2.2s ease-in-out infinite backwards; }
.plugin-icon[data-active="true"] .pi-motion--float { animation: pi-float 2.6s ease-in-out infinite backwards; }
.plugin-icon[data-active="true"] .pi-motion--blink { animation: pi-blink 2.8s ease-in-out infinite backwards; }
.plugin-icon[data-active="true"] .pi-motion--flow { animation: pi-flow 1.8s ease-in infinite backwards; }

@keyframes pi-sway { 0%, 100% { transform: rotate(-14deg); } 50% { transform: rotate(14deg); } }
@keyframes pi-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
@keyframes pi-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2.5px); } }
@keyframes pi-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
@keyframes pi-flow {
  0% { opacity: 0; transform: translateY(-3px); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translateY(6px); }
}

@media (prefers-reduced-motion: reduce) {
  .plugin-icon .pi-motion { animation: none !important; }
}
</style>
