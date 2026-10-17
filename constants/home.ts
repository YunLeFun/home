import type { DevicePluginIcon } from '~/devices/icon'
import type { DevicePluginManifest } from '~/devices/types'
import type { DeviceKind, HomeTemplate, HomeTemplateId, VirtualHomeState } from '~/types'
import { airConditionerManifest } from '~/devices/air-conditioner/manifest'
import { fanManifest } from '~/devices/fan/manifest'
import { handWarmerManifest } from '~/devices/hand-warmer/manifest'
import { robotVacuumManifest } from '~/devices/robot-vacuum/manifest'
import { televisionManifest } from '~/devices/television/manifest'

export interface HomeDeviceDefinition {
  id: DeviceKind
  name: string
  description: string
  icon: string
  appIcon: DevicePluginIcon
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
    appIcon: manifest.appIcon,
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
  'television': fromManifest(televisionManifest),
  'air-conditioner': fromManifest(airConditionerManifest),
  'fan': fromManifest(fanManifest),
  'robot-vacuum': fromManifest(robotVacuumManifest),
  'hand-warmer': fromManifest(handWarmerManifest),
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
    robotRoutes: [
      { roomId: 'suite-living', points: [{ x: 55, y: 745 }, { x: 760, y: 745 }, { x: 760, y: 675 }, { x: 70, y: 675 }, { x: 70, y: 625 }, { x: 760, y: 625 }] },
      { roomId: 'suite-bedroom', points: [{ x: 835, y: 748 }, { x: 1565, y: 748 }, { x: 1565, y: 680 }, { x: 835, y: 680 }, { x: 835, y: 620 }, { x: 1565, y: 620 }] },
    ],
  },
  'my-home': {
    id: 'my-home',
    name: '云端小家',
    description: '照着真实户型搭的两室一厅：卫生间、厨房、阳台、客厅和两间卧室',
    // A floor plan in centimetres, north up, from the real home's dimension chains.
    // The north-west corner above the bathroom is outside the home; bedroom B's
    // bay window juts out east and bedroom A's south.
    layout: 'plan',
    width: 1060,
    height: 723,
    defaultRoomId: 'home-living',
    rooms: [
      { id: 'home-bathroom', name: '卫生间', shortName: '卫生间', x: 0, y: 142, width: 162, height: 183 },
      { id: 'home-kitchen', name: '厨房', shortName: '厨房', x: 0, y: 325, width: 232, height: 240 },
      { id: 'home-balcony', name: '阳台', shortName: '阳台', x: 180, y: 565, width: 470, height: 146 },
      { id: 'home-living', name: '客厅', shortName: '客厅', x: 232, y: 0, width: 415, height: 565 },
      { id: 'home-bedroom-a', name: '卧室 A', shortName: '卧室A', x: 647, y: 263, width: 333, height: 374 },
      { id: 'home-bedroom-b', name: '卧室 B', shortName: '卧室B', x: 647, y: 0, width: 408, height: 263 },
    ],
    // Devices hang on walls facing west or south, which face the camera.
    surfaces: [
      { id: 'home-bathroom-wall', roomId: 'home-bathroom', name: '卫生间墙面', kind: 'wall', run: [{ x: 162, y: 142 }, { x: 162, y: 325 }], polygon: [{ x: 8, y: 30 }, { x: 88, y: 30 }, { x: 88, y: 150 }, { x: 8, y: 150 }], accepts: ['air-conditioner', 'television'] },
      { id: 'home-bathroom-floor', roomId: 'home-bathroom', name: '卫生间地面', kind: 'floor', polygon: [{ x: 12, y: 154 }, { x: 150, y: 154 }, { x: 150, y: 313 }, { x: 12, y: 313 }], accepts: ['fan', 'robot-vacuum'] },
      { id: 'home-kitchen-wall', roomId: 'home-kitchen', name: '厨房墙面', kind: 'wall', run: [{ x: 232, y: 325 }, { x: 232, y: 565 }], polygon: [{ x: 20, y: 30 }, { x: 220, y: 30 }, { x: 220, y: 140 }, { x: 20, y: 140 }], accepts: ['air-conditioner', 'television'] },
      { id: 'home-kitchen-floor', roomId: 'home-kitchen', name: '厨房地面', kind: 'floor', polygon: [{ x: 12, y: 337 }, { x: 220, y: 337 }, { x: 220, y: 553 }, { x: 12, y: 553 }], accepts: ['fan', 'robot-vacuum'] },
      { id: 'home-kitchen-counter', roomId: 'home-kitchen', name: '厨房台面', kind: 'tabletop', polygon: [{ x: 16, y: 450 }, { x: 58, y: 450 }, { x: 58, y: 490 }, { x: 16, y: 490 }], accepts: ['hand-warmer'] },
      { id: 'home-balcony-floor', roomId: 'home-balcony', name: '阳台地面', kind: 'floor', polygon: [{ x: 192, y: 577 }, { x: 600, y: 577 }, { x: 600, y: 699 }, { x: 192, y: 699 }], accepts: ['fan', 'robot-vacuum'] },
      { id: 'home-living-wall', roomId: 'home-living', name: '客厅墙面', kind: 'wall', run: [{ x: 647, y: 356 }, { x: 647, y: 565 }], polygon: [{ x: 15, y: 40 }, { x: 195, y: 40 }, { x: 195, y: 190 }, { x: 15, y: 190 }], accepts: ['air-conditioner', 'television'] },
      { id: 'home-living-floor', roomId: 'home-living', name: '客厅地面', kind: 'floor', polygon: [{ x: 244, y: 12 }, { x: 635, y: 12 }, { x: 635, y: 553 }, { x: 244, y: 553 }], accepts: ['fan', 'robot-vacuum'] },
      { id: 'home-living-table', roomId: 'home-living', name: '客厅茶几', kind: 'tabletop', polygon: [{ x: 390, y: 393 }, { x: 430, y: 393 }, { x: 430, y: 425 }, { x: 390, y: 425 }], accepts: ['hand-warmer'] },
      { id: 'home-bedroom-a-wall', roomId: 'home-bedroom-a', name: '卧室 A 墙面', kind: 'wall', run: [{ x: 980, y: 263 }, { x: 980, y: 565 }], polygon: [{ x: 15, y: 30 }, { x: 290, y: 30 }, { x: 290, y: 120 }, { x: 15, y: 120 }], accepts: ['air-conditioner', 'television'] },
      { id: 'home-bedroom-a-floor', roomId: 'home-bedroom-a', name: '卧室 A 地面', kind: 'floor', polygon: [{ x: 659, y: 275 }, { x: 968, y: 275 }, { x: 968, y: 553 }, { x: 659, y: 553 }], accepts: ['fan', 'robot-vacuum'] },
      { id: 'home-bedroom-a-table', roomId: 'home-bedroom-a', name: '卧室 A 床头柜', kind: 'tabletop', polygon: [{ x: 937, y: 340 }, { x: 968, y: 340 }, { x: 968, y: 370 }, { x: 937, y: 370 }], accepts: ['hand-warmer'] },
      { id: 'home-bedroom-b-wall', roomId: 'home-bedroom-b', name: '卧室 B 墙面', kind: 'wall', run: [{ x: 647, y: 0 }, { x: 980, y: 0 }], polygon: [{ x: 15, y: 30 }, { x: 318, y: 30 }, { x: 318, y: 120 }, { x: 15, y: 120 }], accepts: ['air-conditioner', 'television'] },
      { id: 'home-bedroom-b-floor', roomId: 'home-bedroom-b', name: '卧室 B 地面', kind: 'floor', polygon: [{ x: 659, y: 12 }, { x: 968, y: 12 }, { x: 968, y: 251 }, { x: 659, y: 251 }], accepts: ['fan', 'robot-vacuum'] },
      { id: 'home-bedroom-b-table', roomId: 'home-bedroom-b', name: '卧室 B 床头柜', kind: 'tabletop', polygon: [{ x: 940, y: 15 }, { x: 970, y: 15 }, { x: 970, y: 45 }, { x: 940, y: 45 }], accepts: ['hand-warmer'] },
    ],
    robotRoutes: [
      { roomId: 'home-bathroom', points: [{ x: 25, y: 215 }, { x: 145, y: 215 }, { x: 145, y: 305 }, { x: 25, y: 305 }, { x: 25, y: 260 }, { x: 145, y: 260 }] },
      { roomId: 'home-kitchen', points: [{ x: 90, y: 345 }, { x: 215, y: 345 }, { x: 215, y: 550 }, { x: 90, y: 550 }, { x: 90, y: 450 }, { x: 215, y: 450 }] },
      { roomId: 'home-balcony', points: [{ x: 200, y: 600 }, { x: 590, y: 600 }, { x: 590, y: 690 }, { x: 510, y: 690 }, { x: 510, y: 640 }, { x: 200, y: 640 }] },
      { roomId: 'home-living', points: [{ x: 345, y: 220 }, { x: 585, y: 220 }, { x: 585, y: 300 }, { x: 345, y: 300 }, { x: 345, y: 550 }, { x: 460, y: 550 }, { x: 460, y: 380 }, { x: 580, y: 380 }, { x: 580, y: 550 }] },
      { roomId: 'home-bedroom-a', points: [{ x: 670, y: 290 }, { x: 915, y: 290 }, { x: 915, y: 318 }, { x: 670, y: 318 }, { x: 670, y: 545 }, { x: 760, y: 545 }, { x: 760, y: 345 }, { x: 700, y: 345 }] },
      { roomId: 'home-bedroom-b', points: [{ x: 665, y: 185 }, { x: 960, y: 185 }, { x: 960, y: 245 }, { x: 665, y: 245 }, { x: 665, y: 215 }, { x: 960, y: 215 }, { x: 900, y: 70 }, { x: 900, y: 175 }] },
    ],
  },
}

const defaultPlacements: Record<HomeTemplateId, VirtualHomeState['placements']> = {
  'cloud-apartment': [
    { deviceId: 'television', roomId: 'living-room', surfaceId: 'living-wall', u: 0.74, v: 0.56, rotation: 0 },
    { deviceId: 'air-conditioner', roomId: 'living-room', surfaceId: 'living-wall', u: 0.8, v: 0.12, rotation: 0 },
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
    { deviceId: 'air-conditioner', roomId: 'suite-living', surfaceId: 'suite-living-wall', u: 0.45, v: 0.12, rotation: 0 },
    { deviceId: 'fan', roomId: 'suite-bedroom', surfaceId: 'suite-bedroom-floor', u: 0.88, v: 0.52, rotation: 0 },
    { deviceId: 'robot-vacuum', roomId: 'suite-living', surfaceId: 'suite-living-floor', u: 0.12, v: 0.82, rotation: 0 },
    { deviceId: 'hand-warmer', roomId: 'suite-bedroom', surfaceId: 'suite-bedroom-table', u: 0.52, v: 0.42, rotation: 0 },
  ],
  'my-home': [
    { deviceId: 'television', roomId: 'home-living', surfaceId: 'home-living-wall', u: 0.5, v: 0.62, rotation: 0 },
    { deviceId: 'air-conditioner', roomId: 'home-living', surfaceId: 'home-living-wall', u: 0.5, v: 0.02, rotation: 0 },
    { deviceId: 'fan', roomId: 'home-bedroom-a', surfaceId: 'home-bedroom-a-floor', u: 0.12, v: 0.6, rotation: 0 },
    { deviceId: 'robot-vacuum', roomId: 'home-living', surfaceId: 'home-living-floor', u: 0.5, v: 0.55, rotation: 0 },
    { deviceId: 'hand-warmer', roomId: 'home-living', surfaceId: 'home-living-table', u: 0.5, v: 0.5, rotation: 0 },
  ],
}

export function createDefaultHomeState(templateId: HomeTemplateId = 'cloud-apartment', changedAt = '1970-01-01T00:00:00.000Z'): VirtualHomeState {
  return {
    version: 2,
    templateId,
    placements: defaultPlacements[templateId].map(placement => ({ ...placement })),
    furniture: [],
    layouts: [],
    revision: 0,
    changedAt,
  }
}
