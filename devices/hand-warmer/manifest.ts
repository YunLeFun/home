import type { DevicePluginManifest } from '../types'
import { handWarmerIcon } from './icon'

export const handWarmerManifest: DevicePluginManifest<'hand-warmer'> = {
  id: 'fun.yunle.hand-warmer',
  kind: 'hand-warmer',
  version: '1.0.0',
  name: '暖手宝',
  description: '随手温暖三档',
  author: { name: '云乐坊', url: 'https://github.com/YunLeFun' },
  category: 'comfort',
  homepage: 'https://github.com/YunLeFun/home',
  appIcon: handWarmerIcon,
  icon: 'i-carbon-temperature-hot',
  route: '/items/hand-warmer',
  size: { width: 66, height: 74 },
  surfaces: ['tabletop'],
  accent: { cool: '#f2a93b', heat: '#f2a93b' },
  integrations: [],
}
