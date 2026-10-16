<script setup lang="ts">
import type { AirConditionerState } from '~/types'
import { AirConditioner } from '@yunlefun-home/air-conditioner'
import yunLogoUrl from '@yunlefun-home/air-conditioner/yun-logo.svg'
import { acTone } from '@yunlefun-home/air-conditioner-core'
import { AcTemperatureDial } from '@yunlefun-home/air-conditioner/controls'
import { computed } from 'vue'
import AcDeviceBinding from './AcDeviceBinding.vue'
import { airConditionerManifest } from './manifest'
import { capabilitiesToLimits } from './state'
import '@yunlefun-home/air-conditioner/style.css'

const props = withDefaults(defineProps<{
  deviceId?: string
}>(), {
  deviceId: 'air-conditioner',
})

const ORIGINAL_AC_URL = 'https://ac.yunyoujun.cn/'

const device = useDeviceState('air-conditioner', props.deviceId)
const state = computed(() => device.state.value)
const tone = computed(() => acTone(state.value))
const limits = device.capabilities
const dialLimits = computed(() => capabilitiesToLimits(limits.value))
const controllable = computed(() => device.linkReady.value)
const modeIndex = computed(() => device.acMode.value === 'cool' ? 0 : device.acMode.value === 'heat' ? 1 : -1)

const syncStatus = computed(() => device.binding.value ? device.linkStatus.value : device.syncStatus.value)
const syncLabel = computed(() => {
  if (device.binding.value)
    return device.linkLabel.value
  if (!device.syncEnabled.value)
    return '保存在此设备'
  if (device.syncStatus.value === 'syncing')
    return '正在同步'
  if (device.syncStatus.value === 'synced')
    return '已同步到云端'
  if (device.syncStatus.value === 'unauthorized')
    return '登录后可同步'
  if (device.syncStatus.value === 'error')
    return '等待恢复同步'
  return '本地设备'
})
const caption = computed(() => {
  if (device.binding.value && !controllable.value)
    return '显示上次状态 · 当前不可控制'
  return state.value.status ? `${device.acModeLabel.value}运行中` : '设备已关闭'
})

function changeTemperature(delta: -1 | 1) {
  device.dispatch({ type: delta > 0 ? 'increment' : 'decrement' })
}

function setMode(mode: AirConditionerState['mode']) {
  device.dispatch({ type: 'mode', mode })
}
</script>

<template>
  <section class="ac-panel" :data-tone="tone" aria-labelledby="ac-panel-title">
    <header class="ac-panel__header">
      <div>
        <p>壁挂空调 · 插件 v{{ airConditionerManifest.version }}</p>
        <h2 id="ac-panel-title">
          空调控制
        </h2>
      </div>
      <div class="ac-panel__actions">
        <span class="ui-chip" :data-status="syncStatus" aria-live="polite"><i />{{ syncLabel }}</span>
        <a class="ui-chip" :href="ORIGINAL_AC_URL" target="_blank" rel="noopener noreferrer">
          原版空调<span class="i-carbon-launch" />
        </a>
      </div>
    </header>

    <div class="ac-console">
      <div class="ac-console__stage" data-ac-renderer="@yunlefun-home/air-conditioner">
        <AirConditioner
          :overrides="state"
          :logo-url="yunLogoUrl"
          :logo-href="ORIGINAL_AC_URL"
          :show-energy-label="true"
        />
        <span class="ac-console__airflow" aria-hidden="true" />
      </div>

      <AcTemperatureDial
        size="large"
        :value="device.targetTemperature.value"
        :limits="dialLimits"
        :tone="tone"
        :caption="caption"
        :disabled="!controllable || !device.temperatureAvailable.value"
        @change="changeTemperature"
      />

      <div class="ac-console__controls">
        <button
          class="ui-orb ac-console__power"
          :class="{ 'is-on': state.status }"
          :data-tone="tone"
          type="button"
          :disabled="!controllable"
          :aria-pressed="state.status"
          :aria-label="state.status ? '关闭空调' : '开启空调'"
          @click="device.dispatch({ type: 'toggleStatus' })"
        >
          <span class="i-carbon-power" />
        </button>
        <div class="ui-segments ac-console__modes" :style="{ '--index': Math.max(0, modeIndex) }" :data-empty="modeIndex < 0" role="group" aria-label="运行模式">
          <button type="button" :disabled="!controllable || !limits.hvacModes.includes('cool')" :aria-pressed="modeIndex === 0" style="--segment-tone: var(--tone-cool)" @click="setMode('cold')">
            <span class="i-carbon-snowflake" />
            <span><strong>制冷</strong><small>清凉送风</small></span>
          </button>
          <button type="button" :disabled="!controllable || !limits.hvacModes.includes('heat')" :aria-pressed="modeIndex === 1" style="--segment-tone: var(--tone-heat)" @click="setMode('hot')">
            <span class="i-carbon-sun" />
            <span><strong>制热</strong><small>温暖送风</small></span>
          </button>
        </div>
      </div>
    </div>

    <footer class="ac-panel__footer">
      <span><i class="i-carbon-information" />温度范围 {{ limits.minTemperature }}–{{ limits.maxTemperature }}°C · 步长 {{ limits.temperatureStep }}°</span>
      <span v-if="device.linkError.value || device.syncError.value" class="ac-panel__error" role="alert">{{ device.linkError.value || device.syncError.value }}</span>
      <span v-else-if="device.lastSyncedAt.value">状态已安全保存</span>
      <span v-else>更改会自动保存在当前设备</span>
    </footer>

    <section class="ac-panel__integrations" aria-label="可用集成">
      <article v-for="integration in airConditionerManifest.integrations" :key="integration.id" class="ac-integration" :data-bound="Boolean(device.binding.value)">
        <span class="ac-integration__icon" :class="integration.icon" />
        <span><strong>{{ integration.name }}</strong><small>{{ integration.description }}</small></span>
        <em>{{ device.binding.value ? '已绑定' : integration.domain }}</em>
      </article>
    </section>
    <AcDeviceBinding :device-id="props.deviceId" />
  </section>
</template>

<style scoped>
.ac-panel {
  --panel-tone: var(--brand-secondary);
  display: grid;
  gap: 18px;
  width: min(100%, 560px);
  margin: 0 auto;
  color: var(--brand-ink);
  animation: rise-in var(--dur-3) var(--ease-out) backwards;
}

.ac-panel[data-tone="cool"] { --panel-tone: var(--tone-cool); }
.ac-panel[data-tone="heat"] { --panel-tone: var(--tone-heat); }

.ac-panel__header,
.ac-panel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.ac-panel__header p,
.ac-panel__header h2 { margin: 0; }
.ac-panel__header p { color: var(--brand-muted); font-size: 11px; font-weight: 650; letter-spacing: 0.06em; }
.ac-panel__header h2 { margin-top: 4px; font-size: clamp(22px, 3.4vw, 28px); letter-spacing: -0.04em; }
.ac-panel__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.ac-panel__actions a { color: var(--brand-ink); text-decoration: none; transition: transform var(--dur-2) var(--ease-spring); }
.ac-panel__actions a:hover { transform: translateY(-1px); }

.ac-console {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 8px;
  overflow: hidden;
  padding: clamp(18px, 4vw, 30px);
  border: 1px solid var(--brand-line);
  border-radius: 32px;
  background:
    radial-gradient(120% 70% at 50% 0%, color-mix(in oklab, var(--panel-tone) 16%, transparent), transparent 62%),
    var(--brand-glass-strong);
  box-shadow: var(--shadow-lg), inset 0 1px 0 var(--brand-highlight);
  transition: background var(--dur-4) ease;
}

.ac-console__stage {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 190px;
  padding: 26px 18px 54px;
  border-radius: 24px;
  background: radial-gradient(circle at 50% 30%, var(--brand-highlight), var(--brand-glass-sunken) 75%);
}

.ac-console__stage { overflow: hidden; }
.ac-console__stage :deep(.acw-unit) { position: relative; z-index: 1; width: min(100%, 400px); }

/* Tinted air pooling under the unit while it runs */
.ac-console__airflow {
  position: absolute;
  bottom: -30px;
  left: 50%;
  width: 80%;
  height: 120px;
  border-radius: 50%;
  background: radial-gradient(closest-side, color-mix(in oklab, var(--panel-tone) 40%, transparent), transparent);
  filter: blur(8px);
  opacity: 0;
  transform: translateX(-50%);
  transition: opacity var(--dur-4) ease, background var(--dur-4) ease;
}

.ac-panel:not([data-tone="idle"]) .ac-console__airflow { opacity: 1; animation: ac-panel-pool 3.2s ease-in-out infinite; }

.ac-console__controls {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.ac-console__power { width: 72px; height: 72px; font-size: 24px; }
.ac-console__modes > button { min-height: 58px; justify-content: flex-start; gap: 10px; padding: 0 14px; text-align: left; }
.ac-console__modes > button > span:first-child { font-size: 20px; }
.ac-console__modes > button > span:last-child { display: grid; gap: 2px; }
.ac-console__modes strong { font-size: 12px; }
.ac-console__modes small { font-size: 9px; opacity: 0.72; }

.ac-panel__footer { color: var(--brand-muted); font-size: 11px; }
.ac-panel__footer span { display: inline-flex; align-items: center; gap: 7px; }
.ac-panel__error { color: var(--tone-danger); }

.ac-panel__integrations { display: grid; gap: 8px; }

.ac-integration {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid var(--brand-line);
  border-radius: 18px;
  background: var(--brand-glass);
}

.ac-integration__icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: var(--brand-glass-sunken);
  color: var(--brand-secondary);
  font-size: 18px;
}

.ac-integration > span:nth-child(2) { display: grid; gap: 2px; }
.ac-integration strong { font-size: 12px; }
.ac-integration small { color: var(--brand-muted); font-size: 10px; line-height: 1.5; }
.ac-integration em { padding: 3px 9px; border-radius: 999px; background: var(--brand-glass-sunken); color: var(--brand-muted); font-size: 9px; font-style: normal; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
.ac-integration[data-bound="true"] em { background: var(--tone-active-soft); color: var(--tone-active); }

@keyframes ac-panel-pool {
  50% { opacity: 0.6; transform: translateX(-50%) scale(1.08, 0.9); }
}

@media (max-width: 560px) {
  .ac-panel__header,
  .ac-panel__footer { align-items: flex-start; flex-direction: column; }
  .ac-panel__actions { justify-content: flex-start; }
  .ac-console { border-radius: 26px; }
  .ac-console__stage { min-height: 160px; padding: 20px 10px 48px; }
  .ac-console__controls { grid-template-columns: 1fr; justify-items: center; }
  .ac-console__modes { width: 100%; }
}
</style>
