import type { DevicePluginManifest } from '../types'
import { definePluginIcon } from '../icon'

export const crescentPath = 'M40 10C28 8 15 15 14 28C12 41 22 48 33 47C41 47 48 42 51 34C44 39 34 37 30 30C26 22 30 14 40 10Z'

export const nightLightManifest: DevicePluginManifest<'night-light'> = {
  id: 'fun.yunle.night-light',
  kind: 'night-light',
  version: '1.0.0',
  name: '床头小夜灯',
  description: '月牙灯罩，暖光照亮床边',
  author: { name: '云乐坊', url: 'https://github.com/YunLeFun' },
  category: 'comfort',
  homepage: 'https://github.com/YunLeFun/home',
  appIcon: definePluginIcon({
    background: ['#e4e9fc', '#b2bedc'],
    shapes: [
      { type: 'ellipse', cx: 32, cy: 53, rx: 15, ry: 2, fill: '#35405b', opacity: 0.14 },
      { type: 'rect', x: 28, y: 42, width: 6, height: 8, rx: 2, fill: '#a17e59' },
      { type: 'rect', x: 18, y: 48, width: 27, height: 5, rx: 2, fill: '#c99a68' },
      { type: 'path', d: crescentPath, fill: '#f8f2e6', when: 'idle' },
      { type: 'path', d: crescentPath, fill: '#ffdc88', when: 'active' },
    ],
  }),
  icon: 'i-carbon-moon',
  route: '/items/night-light',
  size: { width: 44, height: 48 },
  surfaces: ['tabletop'],
  accent: { cool: '#e6b773', heat: '#ffbf69' },
  integrations: [],
}
