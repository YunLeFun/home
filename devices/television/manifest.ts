import type { DevicePluginManifest } from '../types'

export const televisionManifest: DevicePluginManifest<'television'> = {
  kind: 'television',
  version: '1.0.0',
  name: '云端电视',
  description: '独立影音与在线片源播放',
  icon: 'i-carbon-screen',
  route: '/items/television',
  size: { width: 230, height: 126 },
  surfaces: ['wall'],
  accent: { cool: '#6f949c', heat: '#6f949c' },
  integrations: [],
}
