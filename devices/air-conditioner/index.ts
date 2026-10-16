import { defineDevicePlugin } from '../registry'
import { airConditionerManifest } from './manifest'
import { airConditionerState } from './state'

export { airConditionerManifest } from './manifest'
export * from './state'

export const airConditionerPlugin = defineDevicePlugin({
  manifest: airConditionerManifest,
  state: airConditionerState,
  components: {
    glyph: () => import('./AcGlyph.vue'),
    quickControl: () => import('./AcQuickControl.vue'),
    panel: () => import('./AcDevicePanel.vue'),
  },
})
