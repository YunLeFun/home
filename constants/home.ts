import type { DevicePluginManifest } from '~/devices/types'
import type { DeviceKind, HomeTemplate, HomeTemplateId, VirtualHomeState } from '~/types'
import { airConditionerManifest } from '~/devices/air-conditioner/manifest'

export interface HomeDeviceDefinition {
  id: DeviceKind
  name: string
  description: string
  icon: string
  route: string
  width: number
  height: number
}

function fromManifest<K extends DeviceKind>(manifest: DevicePluginManifest<K>): HomeDeviceDefinition {
  return {
    id: manifest.kind,
    name: manifest.name,
    description: manifest.description,
    icon: manifest.icon,
    route: manifest.route,
    ...manifest.size,
  }
}

export const HOME_VIEWBOX = {
  width: 1600,
  height: 800,
} as const

export const HOME_DEVICE_ORDER: DeviceKind[] = [
  'television',
  'air-conditioner',
  'fan',
  'robot-vacuum',
  'hand-warmer',
]

export const HOME_DEVICES: Record<DeviceKind, HomeDeviceDefinition> = {
  'television': {
    id: 'television',
    name: '云端电视',
    description: '独立影音与在线片源播放',
    icon: 'i-carbon-screen',
    route: '/items/television',
    width: 230,
    height: 126,
  },
  'air-conditioner': fromManifest(airConditionerManifest),
  'fan': {
    id: 'fan',
    name: '云端风扇',
    description: '柔风与摇头',
    icon: 'i-carbon-windy',
    route: '/items/fan',
    width: 92,
    height: 182,
  },
  'robot-vacuum': {
    id: 'robot-vacuum',
    name: '扫地机器人',
    description: '全屋路线清扫',
    icon: 'i-carbon-clean',
    route: '/items/robot-vacuum',
    width: 104,
    height: 76,
  },
  'hand-warmer': {
    id: 'hand-warmer',
    name: '暖手宝',
    description: '随手温暖三档',
    icon: 'i-carbon-temperature-hot',
    route: '/items/hand-warmer',
    width: 66,
    height: 74,
  },
}

export const HOME_TEMPLATES: Record<HomeTemplateId, HomeTemplate> = {
  'cloud-apartment': {
    id: 'cloud-apartment',
    name: '云端公寓',
    description: '客厅、卧室与家政区相连的完整家园',
    ...HOME_VIEWBOX,
    rooms: [
      { id: 'living-room', name: '客厅', shortName: '客厅', x: 0, y: 0, width: 620, height: 800 },
      { id: 'bedroom', name: '卧室', shortName: '卧室', x: 620, y: 0, width: 585, height: 800 },
      { id: 'utility-room', name: '家政区', shortName: '家政', x: 1205, y: 0, width: 395, height: 800 },
    ],
    surfaces: [
      { id: 'living-wall', roomId: 'living-room', name: '客厅墙面', kind: 'wall', polygon: [{ x: 55, y: 125 }, { x: 570, y: 125 }, { x: 570, y: 430 }, { x: 55, y: 430 }], accepts: ['air-conditioner', 'television'] },
      { id: 'living-floor', roomId: 'living-room', name: '客厅地面', kind: 'floor', polygon: [{ x: 35, y: 585 }, { x: 600, y: 585 }, { x: 620, y: 790 }, { x: 15, y: 790 }], accepts: ['fan', 'robot-vacuum'] },
      { id: 'living-table', roomId: 'living-room', name: '客厅桌面', kind: 'tabletop', polygon: [{ x: 220, y: 535 }, { x: 430, y: 535 }, { x: 445, y: 590 }, { x: 210, y: 590 }], accepts: ['hand-warmer'] },
      { id: 'bedroom-wall', roomId: 'bedroom', name: '卧室墙面', kind: 'wall', polygon: [{ x: 655, y: 130 }, { x: 1160, y: 130 }, { x: 1160, y: 430 }, { x: 655, y: 430 }], accepts: ['air-conditioner', 'television'] },
      { id: 'bedroom-floor', roomId: 'bedroom', name: '卧室地面', kind: 'floor', polygon: [{ x: 635, y: 590 }, { x: 1185, y: 590 }, { x: 1205, y: 790 }, { x: 620, y: 790 }], accepts: ['fan', 'robot-vacuum'] },
      { id: 'bedroom-table', roomId: 'bedroom', name: '卧室床头柜', kind: 'tabletop', polygon: [{ x: 1065, y: 500 }, { x: 1155, y: 500 }, { x: 1160, y: 565 }, { x: 1060, y: 565 }], accepts: ['hand-warmer'] },
      { id: 'utility-wall', roomId: 'utility-room', name: '家政区墙面', kind: 'wall', polygon: [{ x: 1230, y: 130 }, { x: 1565, y: 130 }, { x: 1565, y: 390 }, { x: 1230, y: 390 }], accepts: ['air-conditioner', 'television'] },
      { id: 'utility-floor', roomId: 'utility-room', name: '家政区地面', kind: 'floor', polygon: [{ x: 1215, y: 555 }, { x: 1585, y: 555 }, { x: 1600, y: 790 }, { x: 1205, y: 790 }], accepts: ['fan', 'robot-vacuum'] },
      { id: 'utility-table', roomId: 'utility-room', name: '家政操作台', kind: 'tabletop', polygon: [{ x: 1260, y: 425 }, { x: 1515, y: 425 }, { x: 1525, y: 505 }, { x: 1250, y: 505 }], accepts: ['hand-warmer'] },
    ],
    obstacles: [
      { id: 'living-sofa', roomId: 'living-room', polygon: [{ x: 105, y: 430 }, { x: 400, y: 430 }, { x: 420, y: 590 }, { x: 85, y: 590 }] },
      { id: 'living-table-base', roomId: 'living-room', polygon: [{ x: 190, y: 535 }, { x: 455, y: 535 }, { x: 475, y: 665 }, { x: 170, y: 665 }] },
      { id: 'bed', roomId: 'bedroom', polygon: [{ x: 720, y: 430 }, { x: 1055, y: 430 }, { x: 1105, y: 710 }, { x: 680, y: 710 }] },
      { id: 'utility-cabinet', roomId: 'utility-room', polygon: [{ x: 1230, y: 390 }, { x: 1565, y: 390 }, { x: 1565, y: 600 }, { x: 1230, y: 600 }] },
    ],
    robotRoutes: [
      { roomId: 'living-room', points: [{ x: 70, y: 720 }, { x: 535, y: 720 }, { x: 535, y: 650 }, { x: 85, y: 650 }, { x: 85, y: 610 }, { x: 550, y: 610 }] },
      { roomId: 'bedroom', points: [{ x: 650, y: 748 }, { x: 1160, y: 748 }, { x: 1160, y: 690 }, { x: 650, y: 690 }, { x: 650, y: 625 }, { x: 1160, y: 625 }] },
      { roomId: 'utility-room', points: [{ x: 1230, y: 740 }, { x: 1570, y: 740 }, { x: 1570, y: 660 }, { x: 1230, y: 660 }, { x: 1230, y: 600 }, { x: 1570, y: 600 }] },
    ],
  },
  'studio': {
    id: 'studio',
    name: '云朵单间',
    description: '适合小空间的一体化工作与休息场景',
    ...HOME_VIEWBOX,
    rooms: [
      { id: 'studio-room', name: '单间', shortName: '单间', x: 0, y: 0, width: 1600, height: 800 },
    ],
    surfaces: [
      { id: 'studio-wall', roomId: 'studio-room', name: '单间墙面', kind: 'wall', polygon: [{ x: 90, y: 110 }, { x: 1500, y: 110 }, { x: 1500, y: 420 }, { x: 90, y: 420 }], accepts: ['air-conditioner', 'television'] },
      { id: 'studio-floor', roomId: 'studio-room', name: '单间地面', kind: 'floor', polygon: [{ x: 45, y: 585 }, { x: 1550, y: 585 }, { x: 1600, y: 790 }, { x: 0, y: 790 }], accepts: ['fan', 'robot-vacuum'] },
      { id: 'studio-table', roomId: 'studio-room', name: '书桌桌面', kind: 'tabletop', polygon: [{ x: 1040, y: 440 }, { x: 1345, y: 440 }, { x: 1360, y: 520 }, { x: 1025, y: 520 }], accepts: ['hand-warmer'] },
    ],
    obstacles: [
      { id: 'studio-sofa', roomId: 'studio-room', polygon: [{ x: 180, y: 420 }, { x: 625, y: 420 }, { x: 650, y: 620 }, { x: 150, y: 620 }] },
      { id: 'studio-bed', roomId: 'studio-room', polygon: [{ x: 690, y: 445 }, { x: 1010, y: 445 }, { x: 1060, y: 715 }, { x: 650, y: 715 }] },
    ],
    robotRoutes: [
      { roomId: 'studio-room', points: [{ x: 70, y: 745 }, { x: 1515, y: 745 }, { x: 1515, y: 680 }, { x: 80, y: 680 }, { x: 80, y: 625 }, { x: 1515, y: 625 }] },
    ],
  },
  'comfort-suite': {
    id: 'comfort-suite',
    name: '舒适套房',
    description: '更宽敞的客厅与卧室双空间',
    ...HOME_VIEWBOX,
    rooms: [
      { id: 'suite-living', name: '套房客厅', shortName: '客厅', x: 0, y: 0, width: 805, height: 800 },
      { id: 'suite-bedroom', name: '套房卧室', shortName: '卧室', x: 805, y: 0, width: 795, height: 800 },
    ],
    surfaces: [
      { id: 'suite-living-wall', roomId: 'suite-living', name: '客厅墙面', kind: 'wall', polygon: [{ x: 70, y: 120 }, { x: 760, y: 120 }, { x: 760, y: 420 }, { x: 70, y: 420 }], accepts: ['air-conditioner', 'television'] },
      { id: 'suite-living-floor', roomId: 'suite-living', name: '客厅地面', kind: 'floor', polygon: [{ x: 30, y: 585 }, { x: 785, y: 585 }, { x: 805, y: 790 }, { x: 0, y: 790 }], accepts: ['fan', 'robot-vacuum'] },
      { id: 'suite-living-table', roomId: 'suite-living', name: '客厅桌面', kind: 'tabletop', polygon: [{ x: 270, y: 535 }, { x: 520, y: 535 }, { x: 535, y: 600 }, { x: 255, y: 600 }], accepts: ['hand-warmer'] },
      { id: 'suite-bedroom-wall', roomId: 'suite-bedroom', name: '卧室墙面', kind: 'wall', polygon: [{ x: 850, y: 120 }, { x: 1545, y: 120 }, { x: 1545, y: 420 }, { x: 850, y: 420 }], accepts: ['air-conditioner', 'television'] },
      { id: 'suite-bedroom-floor', roomId: 'suite-bedroom', name: '卧室地面', kind: 'floor', polygon: [{ x: 825, y: 585 }, { x: 1580, y: 585 }, { x: 1600, y: 790 }, { x: 805, y: 790 }], accepts: ['fan', 'robot-vacuum'] },
      { id: 'suite-bedroom-table', roomId: 'suite-bedroom', name: '卧室床头柜', kind: 'tabletop', polygon: [{ x: 850, y: 505 }, { x: 960, y: 505 }, { x: 965, y: 570 }, { x: 845, y: 570 }], accepts: ['hand-warmer'] },
    ],
    obstacles: [
      { id: 'suite-sofa', roomId: 'suite-living', polygon: [{ x: 260, y: 430 }, { x: 690, y: 430 }, { x: 710, y: 620 }, { x: 235, y: 620 }] },
      { id: 'suite-table-base', roomId: 'suite-living', polygon: [{ x: 235, y: 525 }, { x: 555, y: 525 }, { x: 575, y: 660 }, { x: 215, y: 660 }] },
      { id: 'suite-bed', roomId: 'suite-bedroom', polygon: [{ x: 940, y: 430 }, { x: 1360, y: 430 }, { x: 1410, y: 720 }, { x: 900, y: 720 }] },
    ],
    robotRoutes: [
      { roomId: 'suite-living', points: [{ x: 55, y: 745 }, { x: 760, y: 745 }, { x: 760, y: 675 }, { x: 70, y: 675 }, { x: 70, y: 625 }, { x: 760, y: 625 }] },
      { roomId: 'suite-bedroom', points: [{ x: 835, y: 748 }, { x: 1565, y: 748 }, { x: 1565, y: 680 }, { x: 835, y: 680 }, { x: 835, y: 620 }, { x: 1565, y: 620 }] },
    ],
  },
}

const defaultPlacements: Record<HomeTemplateId, VirtualHomeState['placements']> = {
  'cloud-apartment': [
    { deviceId: 'television', roomId: 'living-room', surfaceId: 'living-wall', u: 0.74, v: 0.56, rotation: 0 },
    { deviceId: 'air-conditioner', roomId: 'living-room', surfaceId: 'living-wall', u: 0.34, v: 0.28, rotation: 0 },
    { deviceId: 'fan', roomId: 'bedroom', surfaceId: 'bedroom-floor', u: 0.82, v: 0.52, rotation: 0 },
    { deviceId: 'robot-vacuum', roomId: 'utility-room', surfaceId: 'utility-floor', u: 0.76, v: 0.78, rotation: 0 },
    { deviceId: 'hand-warmer', roomId: 'living-room', surfaceId: 'living-table', u: 0.58, v: 0.45, rotation: 0 },
  ],
  'studio': [
    { deviceId: 'television', roomId: 'studio-room', surfaceId: 'studio-wall', u: 0.37, v: 0.58, rotation: 0 },
    { deviceId: 'air-conditioner', roomId: 'studio-room', surfaceId: 'studio-wall', u: 0.30, v: 0.22, rotation: 0 },
    { deviceId: 'fan', roomId: 'studio-room', surfaceId: 'studio-floor', u: 0.88, v: 0.55, rotation: 0 },
    { deviceId: 'robot-vacuum', roomId: 'studio-room', surfaceId: 'studio-floor', u: 0.58, v: 0.82, rotation: 0 },
    { deviceId: 'hand-warmer', roomId: 'studio-room', surfaceId: 'studio-table', u: 0.54, v: 0.45, rotation: 0 },
  ],
  'comfort-suite': [
    { deviceId: 'television', roomId: 'suite-living', surfaceId: 'suite-living-wall', u: 0.79, v: 0.42, rotation: 0 },
    { deviceId: 'air-conditioner', roomId: 'suite-living', surfaceId: 'suite-living-wall', u: 0.30, v: 0.25, rotation: 0 },
    { deviceId: 'fan', roomId: 'suite-bedroom', surfaceId: 'suite-bedroom-floor', u: 0.88, v: 0.52, rotation: 0 },
    { deviceId: 'robot-vacuum', roomId: 'suite-living', surfaceId: 'suite-living-floor', u: 0.12, v: 0.82, rotation: 0 },
    { deviceId: 'hand-warmer', roomId: 'suite-bedroom', surfaceId: 'suite-bedroom-table', u: 0.52, v: 0.42, rotation: 0 },
  ],
}

export function createDefaultHomeState(templateId: HomeTemplateId = 'cloud-apartment', changedAt = '1970-01-01T00:00:00.000Z'): VirtualHomeState {
  return {
    version: 1,
    templateId,
    placements: defaultPlacements[templateId].map(placement => ({ ...placement })),
    revision: 0,
    changedAt,
  }
}
