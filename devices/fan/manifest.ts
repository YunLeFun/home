import type { DevicePluginManifest } from '../types'
import { fanIcon } from './icon'

export const fanManifest: DevicePluginManifest<'fan'> = {
  id: 'cn.elpsy.electric-fan',
  kind: 'fan',
  version: '1.0.0',
  name: '云端风扇',
  description: '柔风与摇头',
  author: { name: 'ElpsyCN', url: 'https://github.com/ElpsyCN' },
  category: 'climate',
  homepage: 'https://github.com/ElpsyCN/electric-fan',
  appIcon: fanIcon,
  icon: 'i-carbon-windy',
  route: '/items/fan',
  size: { width: 92, height: 182 },
  surfaces: ['floor'],
  accent: { cool: '#4fb6ef', heat: '#4fb6ef' },
  integrations: [],
}
