import { defineDevicePlugin } from '../registry'
import { fanManifest } from './manifest'
import { fanState } from './state'

export { fanManifest } from './manifest'
export * from './state'

export const fanPlugin = defineDevicePlugin({
  manifest: fanManifest,
  state: fanState,
  components: {
    glyph: () => import('./FanGlyph.vue'),
    quickControl: () => import('./FanQuickControl.vue'),
  },
})
