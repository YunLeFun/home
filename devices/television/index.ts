import { defineDevicePlugin } from '../registry'
import { televisionManifest } from './manifest'
import { televisionState } from './state'

export { televisionManifest } from './manifest'
export * from './state'

export const televisionPlugin = defineDevicePlugin({
  manifest: televisionManifest,
  state: televisionState,
  components: {
    glyph: () => import('./TelevisionGlyph.vue'),
    quickControl: () => import('./TelevisionQuickControl.vue'),
    panel: () => import('./TelevisionDevicePanel.vue'),
  },
})
