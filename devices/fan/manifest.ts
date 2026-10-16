import type { DevicePluginManifest } from '../types'

export const fanManifest: DevicePluginManifest<'fan'> = {
  kind: 'fan',
  version: '1.0.0',
  name: '云端风扇',
  description: '柔风与摇头',
  icon: 'i-carbon-windy',
  route: '/items/fan',
  size: { width: 92, height: 182 },
  surfaces: ['floor'],
  accent: { cool: '#687b67', heat: '#687b67' },
  integrations: [],
}
