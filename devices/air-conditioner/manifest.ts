import type { DevicePluginManifest } from '../types'

export const airConditionerManifest: DevicePluginManifest<'air-conditioner'> = {
  kind: 'air-conditioner',
  version: '1.0.0',
  name: '云端空调',
  description: '冷暖静音控制',
  icon: 'i-carbon-snowflake',
  route: '/items/air-conditioner',
  size: { width: 190, height: 88 },
  surfaces: ['wall'],
  accent: { cool: '#6f9ea8', heat: '#d18c5c' },
  integrations: [
    {
      id: 'home-assistant',
      name: 'Home Assistant',
      domain: 'climate',
      icon: 'i-carbon-home',
      description: '绑定 climate 实体，同步真实空调的开关、模式与温度',
    },
  ],
}
