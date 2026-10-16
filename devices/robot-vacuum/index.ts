import { defineDevicePlugin } from '../registry'
import { robotVacuumManifest } from './manifest'
import { robotVacuumState } from './state'

export { robotVacuumManifest } from './manifest'
export * from './state'

export const robotVacuumPlugin = defineDevicePlugin({
  manifest: robotVacuumManifest,
  state: robotVacuumState,
  components: {
    glyph: () => import('./RobotVacuumGlyph.vue'),
    quickControl: () => import('./RobotVacuumQuickControl.vue'),
  },
})
