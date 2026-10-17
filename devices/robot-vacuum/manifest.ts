import type { DevicePluginManifest } from '../types'
import { robotVacuumIcon } from './icon'

export const robotVacuumManifest: DevicePluginManifest<'robot-vacuum'> = {
  id: 'fun.yunle.robot-vacuum',
  kind: 'robot-vacuum',
  version: '1.0.0',
  name: '扫地机器人',
  description: '全屋路线清扫',
  author: { name: '云乐坊', url: 'https://github.com/YunLeFun' },
  category: 'cleaning',
  homepage: 'https://github.com/YunLeFun/home',
  appIcon: robotVacuumIcon,
  icon: 'i-carbon-clean',
  route: '/items/robot-vacuum',
  size: { width: 104, height: 76 },
  surfaces: ['floor'],
  accent: { cool: '#5f939e', heat: '#687b67' },
  integrations: [],
}
