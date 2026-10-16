import type { DevicePluginManifest } from '../types'

export const robotVacuumManifest: DevicePluginManifest<'robot-vacuum'> = {
  kind: 'robot-vacuum',
  version: '1.0.0',
  name: '扫地机器人',
  description: '全屋路线清扫',
  icon: 'i-carbon-clean',
  route: '/items/robot-vacuum',
  size: { width: 104, height: 76 },
  surfaces: ['floor'],
  accent: { cool: '#5f939e', heat: '#687b67' },
  integrations: [],
}
