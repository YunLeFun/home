import type { DevicePluginState } from '../types'
import { defineDevicePlugin } from '../registry'
import { isRecord, normalizeDate } from '../state-utils'
import { nightLightManifest } from './manifest'

const state: DevicePluginState<'night-light'> = {
  create: changedAt => ({ power: false, stateChangedAt: changedAt }),
  normalize(value) {
    const record = isRecord(value) ? value : {}
    return { power: record.power === true, stateChangedAt: normalizeDate(record.stateChangedAt) }
  },
  reduce: (_state, action, changedAt) => ({ power: action.power, stateChangedAt: changedAt }),
  isAction: (value): value is { type: 'set-power', power: boolean } => isRecord(value) && value.type === 'set-power' && typeof value.power === 'boolean',
  isActive: state => state.power,
  statusText: state => state.power ? '暖光已开启' : '已关闭',
  tone: state => state.power ? 'warm' : 'idle',
}

export const nightLightPlugin = defineDevicePlugin({
  manifest: nightLightManifest,
  state,
  components: {
    glyph: () => import('./NightLightGlyph.vue'),
    quickControl: () => import('./NightLightQuickControl.vue'),
  },
})
