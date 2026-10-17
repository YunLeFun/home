import type { DevicePluginManifest } from '../types'
import { televisionIcon } from './icon'

export const televisionManifest: DevicePluginManifest<'television'> = {
  id: 'fun.yunle.television',
  kind: 'television',
  version: '1.0.0',
  name: '云端电视',
  description: '独立影音与在线片源播放',
  author: { name: '云乐坊', url: 'https://github.com/YunLeFun' },
  category: 'media',
  homepage: 'https://github.com/YunLeFun/home',
  appIcon: televisionIcon,
  icon: 'i-carbon-screen',
  route: '/items/television',
  size: { width: 230, height: 126 },
  surfaces: ['wall'],
  accent: { cool: '#4fb6ef', heat: '#4fb6ef' },
  integrations: [],
}
