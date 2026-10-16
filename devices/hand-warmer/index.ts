import { defineDevicePlugin } from '../registry'
import { handWarmerManifest } from './manifest'
import { handWarmerState } from './state'

export { handWarmerManifest } from './manifest'
export * from './state'

export const handWarmerPlugin = defineDevicePlugin({
  manifest: handWarmerManifest,
  state: handWarmerState,
  components: {
    glyph: () => import('./HandWarmerGlyph.vue'),
    quickControl: () => import('./HandWarmerQuickControl.vue'),
  },
})
