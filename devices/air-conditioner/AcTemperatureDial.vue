<script setup lang="ts">
/**
 * Arc gauge for a target temperature. The arc runs from cool on the left to
 * warm on the right, and its knob springs to each new value.
 */
import type { DeviceTone } from '../types'
import { computed, useId } from 'vue'
import RollingNumber from '~/components/ui/RollingNumber.vue'

const props = withDefaults(defineProps<{
  /** Target temperature, or `null` when the entity does not report one */
  value: number | null
  min: number
  max: number
  step: number
  tone: DeviceTone
  /** Primary caption under the reading */
  caption: string
  disabled?: boolean
  canDecrease?: boolean
  canIncrease?: boolean
  size?: 'compact' | 'large'
}>(), {
  disabled: false,
  canDecrease: true,
  canIncrease: true,
  size: 'compact',
})

const emit = defineEmits<{
  /** Request a one-step temperature change */
  change: [delta: -1 | 1]
}>()

// Arc spans 260°, starting bottom-left (140°) and ending bottom-right (40°).
const START_ANGLE = 140
const SWEEP = 260
const ARC_PATH = 'M38.72 151.42 A80 80 0 1 1 161.28 151.42'

const id = useId()
const gradientId = `ac-dial-gradient-${id}`
const ratio = computed(() => {
  if (props.value === null || props.max <= props.min)
    return 0
  return Math.min(1, Math.max(0, (props.value - props.min) / (props.max - props.min)))
})
const knobAngle = computed(() => START_ANGLE + SWEEP * ratio.value)
const ticks = computed(() => {
  const count = Math.max(2, Math.min(32, Math.round((props.max - props.min) / props.step) + 1))
  return Array.from({ length: count }, (_, index) => {
    const angle = ((START_ANGLE + (SWEEP * index) / (count - 1)) * Math.PI) / 180
    return {
      x1: 100 + 92 * Math.cos(angle),
      y1: 100 + 92 * Math.sin(angle),
      x2: 100 + (index % 5 === 0 ? 86 : 89) * Math.cos(angle),
      y2: 100 + (index % 5 === 0 ? 86 : 89) * Math.sin(angle),
      lit: index / (count - 1) <= ratio.value + 1e-6,
    }
  })
})

function onKeydown(event: KeyboardEvent) {
  if (props.disabled)
    return
  if ((event.key === 'ArrowUp' || event.key === 'ArrowRight') && props.canIncrease)
    emit('change', 1)
  else if ((event.key === 'ArrowDown' || event.key === 'ArrowLeft') && props.canDecrease)
    emit('change', -1)
  else
    return
  event.preventDefault()
}
</script>

<template>
  <div class="ac-dial" :class="[`is-${size}`, { 'is-disabled': disabled }]" :data-tone="tone">
    <div
      class="ac-dial__gauge"
      role="slider"
      :tabindex="disabled ? -1 : 0"
      aria-label="目标温度"
      :aria-valuemin="min"
      :aria-valuemax="max"
      :aria-valuenow="value ?? undefined"
      :aria-valuetext="value === null ? '未知' : `${value} 摄氏度`"
      :aria-disabled="disabled"
      @keydown="onKeydown"
    >
      <span class="ac-dial__aura" aria-hidden="true" />
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <linearGradient :id="gradientId" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style="stop-color: var(--tone-cool)" />
            <stop offset="0.55" style="stop-color: var(--brand-secondary)" />
            <stop offset="1" style="stop-color: var(--tone-heat)" />
          </linearGradient>
        </defs>
        <g class="ac-dial__ticks">
          <line v-for="(tick, index) in ticks" :key="index" :x1="tick.x1" :y1="tick.y1" :x2="tick.x2" :y2="tick.y2" :data-lit="tick.lit" />
        </g>
        <path class="ac-dial__track" :d="ARC_PATH" pathLength="100" />
        <path
          class="ac-dial__progress"
          :d="ARC_PATH"
          pathLength="100"
          :stroke="`url(#${gradientId})`"
          :style="{ strokeDasharray: `${ratio * 100} 100` }"
        />
        <g class="ac-dial__knob" :style="{ transform: `rotate(${knobAngle}deg)` }">
          <circle class="ac-dial__knob-glow" cx="180" cy="100" r="11" />
          <circle class="ac-dial__knob-dot" cx="180" cy="100" r="6.5" />
        </g>
      </svg>
      <div class="ac-dial__readout">
        <strong><RollingNumber :value="value" /><sup>°C</sup></strong>
        <small>{{ caption }}</small>
      </div>
    </div>
    <div class="ac-dial__steps">
      <button class="ui-step" type="button" aria-label="降低温度" :disabled="disabled || !canDecrease" @click="emit('change', -1)">
        <span class="i-carbon-subtract" />
      </button>
      <span class="ac-dial__range numeric">{{ min }}° – {{ max }}°</span>
      <button class="ui-step" type="button" aria-label="升高温度" :disabled="disabled || !canIncrease" @click="emit('change', 1)">
        <span class="i-carbon-add" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.ac-dial {
  --dial-tone: var(--brand-faint);
  --dial-size: 196px;
  display: grid;
  justify-items: center;
  gap: 2px;
}

.ac-dial.is-large { --dial-size: min(300px, 72vw); }
.ac-dial[data-tone="cool"] { --dial-tone: var(--tone-cool); }
.ac-dial[data-tone="heat"] { --dial-tone: var(--tone-heat); }

.ac-dial__gauge {
  position: relative;
  width: var(--dial-size);
  aspect-ratio: 1;
  border-radius: 50%;
  outline: none;
}

.ac-dial__gauge:focus-visible { box-shadow: 0 0 0 3px rgba(var(--brand-focus-rgb), 0.3); }

.ac-dial__aura {
  position: absolute;
  inset: 18%;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in oklab, var(--dial-tone) 30%, transparent), transparent 70%);
  filter: blur(10px);
  opacity: 0;
  transition: opacity var(--dur-4) ease, background var(--dur-4) ease;
}

.ac-dial:not([data-tone="idle"]) .ac-dial__aura { opacity: 1; animation: breathe 3.6s ease-in-out infinite; }

.ac-dial svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.ac-dial__ticks line {
  stroke: var(--brand-line-strong);
  stroke-linecap: round;
  stroke-width: 1.4;
  transition: stroke var(--dur-3) ease;
}

.ac-dial__ticks line[data-lit="true"] { stroke: color-mix(in oklab, var(--dial-tone) 70%, var(--brand-muted)); }

.ac-dial__track,
.ac-dial__progress {
  fill: none;
  stroke-linecap: round;
  stroke-width: 11;
}

.ac-dial__track { stroke: var(--brand-glass-sunken); }

.ac-dial__progress {
  filter: drop-shadow(0 4px 8px color-mix(in oklab, var(--dial-tone) 40%, transparent));
  transition: stroke-dasharray var(--dur-3) var(--ease-out), opacity var(--dur-3) ease;
}

.ac-dial[data-tone="idle"] .ac-dial__progress { opacity: 0.38; filter: grayscale(0.6); }

.ac-dial__knob {
  transform-box: view-box;
  transform-origin: 100px 100px;
  transition: transform var(--dur-3) var(--ease-spring);
}

.ac-dial__knob-glow { fill: color-mix(in oklab, var(--dial-tone) 26%, transparent); }
.ac-dial__knob-dot { fill: var(--brand-glass-strong); stroke: var(--dial-tone); stroke-width: 3; }

.ac-dial__readout {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 4px;
  pointer-events: none;
}

.ac-dial__readout strong {
  display: inline-flex;
  align-items: flex-start;
  color: var(--brand-ink);
  font-size: calc(var(--dial-size) * 0.24);
  font-weight: 600;
  letter-spacing: -0.05em;
  line-height: 1;
}

.ac-dial__readout sup {
  margin: 0.2em 0 0 0.12em;
  color: var(--brand-muted);
  font-size: 0.3em;
  font-weight: 650;
  letter-spacing: 0;
}

.ac-dial__readout small {
  white-space: nowrap;
  color: var(--brand-muted);
  font-size: 10px;
  font-weight: 650;
  text-align: center;
}

.ac-dial__steps {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  width: calc(var(--dial-size) * 0.92);
  margin-top: calc(var(--dial-size) * -0.2);
}

.ac-dial__range {
  color: var(--brand-faint);
  font-size: 10px;
  text-align: center;
}

.ac-dial.is-disabled .ac-dial__readout strong { opacity: 0.55; }
</style>
