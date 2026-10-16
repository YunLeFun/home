import type { DevicePluginManifest } from '../types'

export const handWarmerManifest: DevicePluginManifest<'hand-warmer'> = {
  kind: 'hand-warmer',
  version: '1.0.0',
  name: '暖手宝',
  description: '随手温暖三档',
  icon: 'i-carbon-temperature-hot',
  route: '/items/hand-warmer',
  size: { width: 66, height: 74 },
  surfaces: ['tabletop'],
  accent: { cool: '#c59a55', heat: '#c59a55' },
  integrations: [],
}
