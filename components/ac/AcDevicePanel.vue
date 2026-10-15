<script setup lang="ts">
import { AirConditioner } from '@yunlefun-home/air-conditioner'
import '@yunlefun-home/air-conditioner/style.css'
import yunLogoUrl from '@yunlefun-home/air-conditioner/yun-logo.svg'
import { computed } from 'vue'
import type { AirConditionerState } from '~/types'

const ORIGINAL_AC_URL = 'https://ac.yunyoujun.cn/'

const props = withDefaults(defineProps<{
  deviceId?: string
}>(), {
  deviceId: 'air-conditioner',
})

const device = useDeviceState('air-conditioner', props.deviceId)
const state = computed(() => device.state.value)

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

const modeLabel = device.acModeLabel
const limits = device.capabilities

function changeTemperature(delta: -1 | 1) {
  device.dispatch({ type: delta > 0 ? 'increment' : 'decrement' })
}

function setMode(mode: AirConditionerState['mode']) {
  device.dispatch({ type: 'mode', mode })
}
</script>

<template>
  <section class="ac-panel" aria-labelledby="ac-panel-title">
    <header class="ac-panel__header">
      <div>
        <p>客厅 · 壁挂空调</p>
        <h1 id="ac-panel-title">
          空调控制
        </h1>
      </div>
      <div class="ac-panel__actions">
        <span class="ac-panel__sync" :data-status="device.binding.value ? device.linkStatus.value : device.syncStatus.value" aria-live="polite">
          <i />{{ syncLabel }}
        </span>
        <a :href="ORIGINAL_AC_URL" target="_blank" rel="noopener noreferrer">
          打开原版空调<span class="i-carbon-launch" />
        </a>
      </div>
    </header>

    <div class="ac-console" :class="{ 'is-heating': state.mode === 'hot' }">
      <div class="ac-console__unit" data-ac-renderer="@yunlefun-home/air-conditioner">
        <AirConditioner
          :overrides="state"
          :logo-url="yunLogoUrl"
          :logo-href="ORIGINAL_AC_URL"
          :show-energy-label="true"
        />
      </div>

      <div class="ac-console__readout" aria-live="polite">
        <span>{{ state.status ? modeLabel : '待机' }}</span>
        <strong>{{ device.targetTemperature.value ?? '—' }}<small>°C</small></strong>
        <p>{{ device.binding.value && !device.linkReady.value ? '显示上次状态 · 当前不可控制' : state.status ? `${modeLabel}运行中` : '设备已关闭' }}</p>
      </div>

      <button
        class="ac-console__power"
        :class="{ 'is-on': state.status }"
        type="button"
        :disabled="!device.linkReady.value"
        :aria-pressed="state.status"
        :aria-label="state.status ? '关闭空调' : '开启空调'"
        @click="device.dispatch({ type: 'toggleStatus' })"
      >
        <span class="i-carbon-power" />
        {{ state.status ? '关闭' : '开启' }}
      </button>

      <div class="ac-console__temperature" aria-label="设置目标温度">
        <button type="button" :disabled="!device.linkReady.value || !device.temperatureAvailable.value || state.temperature <= limits.minTemperature" aria-label="降低温度" @click="changeTemperature(-1)">
          <span class="i-carbon-subtract" />
        </button>
        <span><small>目标温度</small><strong>{{ device.targetTemperature.value ?? '—' }}°</strong></span>
        <button type="button" :disabled="!device.linkReady.value || !device.temperatureAvailable.value || state.temperature >= limits.maxTemperature" aria-label="升高温度" @click="changeTemperature(1)">
          <span class="i-carbon-add" />
        </button>
      </div>

      <div class="ac-console__modes" aria-label="运行模式">
        <button type="button" :disabled="!device.linkReady.value || !limits.hvacModes.includes('cool')" :aria-pressed="device.acMode.value === 'cool'" @click="setMode('cold')">
          <span class="i-carbon-snowflake" />
          <span><strong>制冷</strong><small>清凉送风</small></span>
        </button>
        <button type="button" :disabled="!device.linkReady.value || !limits.hvacModes.includes('heat')" :aria-pressed="device.acMode.value === 'heat'" @click="setMode('hot')">
          <span class="i-carbon-heat" />
          <span><strong>制热</strong><small>温暖送风</small></span>
        </button>
      </div>
    </div>

    <footer class="ac-panel__footer">
      <span><i class="i-carbon-information" />温度范围 {{ limits.minTemperature }}–{{ limits.maxTemperature }}°C · 步长 {{ limits.temperatureStep }}°</span>
      <span v-if="device.linkError.value || device.syncError.value" class="ac-panel__error" role="alert">{{ device.linkError.value || device.syncError.value }}</span>
      <span v-else-if="device.lastSyncedAt.value">状态已安全保存</span>
      <span v-else>更改会自动保存在当前设备</span>
    </footer>
    <AcDeviceBinding :device-id="props.deviceId" />
  </section>
</template>

<style scoped>
.ac-panel {
  display: grid;
  gap: 22px;
  width: min(100%, 720px);
  margin: 0 auto;
  padding: 32px 20px 48px;
  color: #34405a;
}

.ac-panel__header,
.ac-panel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.ac-panel__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 9px;
}

.ac-panel__actions > a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid #d9e0ee;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: #6678a6;
  font-size: 11px;
  font-weight: 700;
  text-decoration: none;
}

.ac-panel__header p,
.ac-panel__header h1 {
  margin: 0;
}

.ac-panel__header p {
  color: #8b95aa;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.04em;
}

.ac-panel__header h1 {
  margin-top: 4px;
  color: #303b54;
  font-size: clamp(24px, 4vw, 34px);
  letter-spacing: -0.04em;
}

.ac-panel__sync {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid #d9e0ee;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: #69758e;
  font-size: 11px;
  font-weight: 650;
}

.ac-panel__sync i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #65c5a5;
  box-shadow: 0 0 0 4px rgba(101, 197, 165, 0.12);
}

.ac-panel__sync[data-status="syncing"] i,
.ac-panel__sync[data-status="connecting"] i {
  background: #6f91dc;
}

.ac-panel__sync[data-status="error"] i,
.ac-panel__sync[data-status="offline"] i,
.ac-panel__sync[data-status="needs-token"] i,
.ac-panel__sync[data-status="unauthorized"] i {
  background: #d99882;
}

.ac-console {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 24px;
  padding: clamp(22px, 5vw, 38px);
  border: 1px solid rgba(174, 188, 218, 0.7);
  border-radius: 32px;
  background:
    radial-gradient(circle at 72% 18%, rgba(124, 154, 226, 0.16), transparent 34%),
    linear-gradient(145deg, rgba(251, 252, 255, 0.98), rgba(231, 237, 249, 0.94));
  box-shadow: 0 28px 70px rgba(64, 78, 116, 0.16), inset 0 1px 0 #fff;
}

.ac-console.is-heating {
  background:
    radial-gradient(circle at 72% 18%, rgba(229, 156, 126, 0.18), transparent 34%),
    linear-gradient(145deg, rgba(255, 252, 249, 0.98), rgba(241, 233, 228, 0.94));
}

.ac-console__unit {
  grid-column: 1 / -1;
  display: grid;
  place-items: center;
  min-height: 238px;
  padding: 30px 28px 10px;
  border: 1px solid rgba(174, 184, 208, 0.62);
  border-radius: 26px;
  background:
    radial-gradient(circle at 50% 28%, rgba(255, 255, 255, 0.98), rgba(237, 242, 250, 0.74) 72%),
    #eef2f8;
  box-shadow: 0 14px 30px rgba(62, 78, 113, 0.13), inset 0 1px 2px #fff;
}

.ac-console__unit :deep(.acw-unit) {
  width: min(100%, 430px);
}

.ac-console__readout {
  display: grid;
  align-content: center;
  gap: 4px;
}

.ac-console__readout > span,
.ac-console__readout p {
  margin: 0;
  color: #8792a8;
  font-size: 11px;
  font-weight: 650;
}

.ac-console__readout strong {
  color: #34405b;
  font-size: clamp(52px, 10vw, 76px);
  font-weight: 620;
  line-height: 0.96;
  letter-spacing: -0.08em;
}

.ac-console__readout strong small {
  margin-left: 6px;
  color: #7888b2;
  font-size: 20px;
  letter-spacing: 0;
}

.ac-console__power {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 6px;
  width: 92px;
  height: 92px;
  border: 1px solid rgba(145, 161, 197, 0.52);
  border-radius: 50%;
  background: linear-gradient(145deg, #fff, #dfe6f3);
  box-shadow: 8px 10px 20px rgba(64, 81, 119, 0.15), inset 0 1px 2px #fff;
  color: #73809b;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.ac-console__power span {
  font-size: 24px;
}

.ac-console__power.is-on {
  border-color: #718ad1;
  background: linear-gradient(145deg, #8ca5e9, #667dc1);
  box-shadow: 0 0 0 9px rgba(110, 137, 211, 0.12), 0 14px 28px rgba(67, 88, 151, 0.27);
  color: #fff;
}

.ac-console__temperature {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: 56px 1fr 56px;
  align-items: center;
  min-height: 64px;
  overflow: hidden;
  border: 1px solid rgba(169, 183, 214, 0.56);
  border-radius: 18px;
  background: rgba(249, 251, 255, 0.78);
}

.ac-console__temperature button {
  align-self: stretch;
  border: 0;
  background: transparent;
  color: #6679ad;
  font-size: 20px;
  cursor: pointer;
}

.ac-console__temperature button:disabled {
  color: #bdc4d2;
  cursor: not-allowed;
}

.ac-console__temperature > span {
  display: grid;
  justify-items: center;
  gap: 2px;
}

.ac-console__temperature small {
  color: #939caf;
  font-size: 10px;
}

.ac-console__temperature strong {
  font-size: 18px;
}

.ac-console__modes {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.ac-console__modes button {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 62px;
  padding: 10px 16px;
  border: 1px solid rgba(169, 183, 214, 0.52);
  border-radius: 17px;
  background: rgba(247, 249, 253, 0.76);
  color: #7b879f;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.ac-console__modes button[aria-pressed="true"] {
  border-color: rgba(105, 132, 203, 0.74);
  background: #fff;
  box-shadow: 0 8px 18px rgba(75, 94, 139, 0.12);
  color: #5f74ad;
}

.ac-console__modes button > span:first-child {
  font-size: 22px;
}

.ac-console__modes button > span:last-child {
  display: grid;
  gap: 2px;
}

.ac-console__modes strong {
  font-size: 12px;
}

.ac-console__modes small {
  font-size: 9px;
  opacity: 0.72;
}

.ac-panel__footer {
  color: #8a95aa;
  font-size: 11px;
}

.ac-panel__footer span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.ac-panel__error {
  color: #b85f53;
}

button:focus-visible {
  outline: 3px solid rgba(83, 112, 197, 0.38);
  outline-offset: 3px;
}

button:disabled { opacity: .5; cursor: not-allowed; }

@media (max-width: 560px) {
  .ac-panel {
    padding: 22px 14px 36px;
  }

  .ac-panel__header,
  .ac-panel__footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .ac-panel__actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .ac-console {
    gap: 18px;
    border-radius: 26px;
  }

  .ac-console__unit {
    min-height: 200px;
    padding: 24px 14px 4px;
  }

  .ac-console__power {
    width: 78px;
    height: 78px;
  }

  .ac-console__modes {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ac-console__power,
  .ac-console__indicator {
    transition: none;
  }
}
</style>
