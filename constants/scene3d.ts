import type { HomeTemplateId } from '~/types'
import type { TabletopSpec } from '~/utils/scene3d/projection'
import { floorDepth, wallHeight, worldX } from '~/utils/scene3d/projection'

/** Furniture the diorama can build. */
export type FurnitureKind =
  | 'sofa'
  | 'coffee-table'
  | 'console'
  | 'table-lamp'
  | 'floor-lamp'
  | 'pendant'
  | 'plant'
  | 'rug'
  | 'bed'
  | 'nightstand'
  | 'shelf'
  | 'laundry'
  | 'basket'
  | 'desk'
  | 'clock'
  | 'window'
  | 'moon-gate'
  | 'counter'
  | 'fridge'
  | 'dining-table'
  | 'vanity'
  | 'toilet'

/**
 * One piece of furniture in diorama space. x and z are the centre of its
 * footprint, y its base; w, d and h its width, depth and height.
 */
export interface FurnitureSpec {
  id: string
  kind: FurnitureKind
  roomId: string
  x: number
  y?: number
  z?: number
  w?: number
  d?: number
  h?: number
  variant?: 'arch' | 'bush' | 'tall'
  /** Lamps glow in the evening and at night. */
  light?: boolean
}

/** Back wall tint of each room, by room. */
export type RoomAccent = 'warm' | 'sky' | 'clay'

export interface Scene3DTemplate {
  rooms: Record<string, RoomAccent>
  tabletops: Record<string, TabletopSpec>
  furniture: FurnitureSpec[]
}

// Positions follow the template plans, so furniture lines up with the placement surfaces.
export const SCENE3D_TEMPLATES: Record<HomeTemplateId, Scene3DTemplate> = {
  'cloud-apartment': {
    rooms: { 'living-room': 'warm', 'bedroom': 'sky', 'utility-room': 'clay' },
    tabletops: {
      'living-table': { height: 0.44, z0: 1.62, z1: 2.38 },
      'bedroom-table': { height: 0.62, z0: 0.12, z1: 0.6 },
      'utility-table': { height: 0.9, z0: 0.08, z1: 0.6 },
    },
    furniture: [
      { id: 'living-window', kind: 'window', roomId: 'living-room', x: worldX(175), y: wallHeight(365), w: 2.1, h: 1.53 },
      { id: 'living-media-console', kind: 'console', roomId: 'living-room', x: worldX(432), z: 0.26, w: 2, d: 0.48, h: 0.5 },
      { id: 'living-lamp', kind: 'table-lamp', roomId: 'living-room', x: worldX(512), y: 0.5, z: 0.24, light: true },
      { id: 'living-plant', kind: 'plant', roomId: 'living-room', x: worldX(578), z: 0.42 },
      { id: 'living-rug', kind: 'rug', roomId: 'living-room', x: worldX(311), z: floorDepth(694), w: 4.3, d: 2.2 },
      { id: 'living-sofa', kind: 'sofa', roomId: 'living-room', x: worldX(252), z: 0.96, w: 3, d: 0.95 },
      { id: 'living-table', kind: 'coffee-table', roomId: 'living-room', x: worldX(327), z: 2, w: 2.1, d: 0.9, h: 0.44 },
      { id: 'bedroom-clock', kind: 'clock', roomId: 'bedroom', x: worldX(722), y: wallHeight(196), w: 0.62 },
      { id: 'bedroom-window', kind: 'window', roomId: 'bedroom', x: worldX(950), y: wallHeight(315), w: 2.4, h: 1.29 },
      { id: 'bedroom-pendant', kind: 'pendant', roomId: 'bedroom', x: worldX(1110), y: 1.5, z: 0.42, light: true },
      { id: 'bedroom-rug', kind: 'rug', roomId: 'bedroom', x: worldX(915), z: floorDepth(744), w: 5.2, d: 1.2 },
      { id: 'bed', kind: 'bed', roomId: 'bedroom', x: worldX(882), z: 1.32, w: 3.1, d: 2.64 },
      { id: 'bedroom-side-table', kind: 'nightstand', roomId: 'bedroom', x: worldX(1110), z: 0.36, w: 0.9, d: 0.6, h: 0.62 },
      { id: 'utility-shelf', kind: 'shelf', roomId: 'utility-room', x: worldX(1400), y: 1.7, w: 2.6 },
      { id: 'utility-lamp', kind: 'table-lamp', roomId: 'utility-room', x: worldX(1545), y: 0.9, z: 0.22, light: true },
      { id: 'utility-cabinet', kind: 'laundry', roomId: 'utility-room', x: worldX(1398), z: 0.34, w: 3.3, d: 0.68, h: 0.9 },
      { id: 'utility-baskets', kind: 'basket', roomId: 'utility-room', x: worldX(1300), z: 1.25 },
    ],
  },
  'studio': {
    rooms: { 'studio-room': 'warm' },
    tabletops: {
      'studio-table': { height: 0.76, z0: 0.12, z1: 0.72 },
    },
    furniture: [
      { id: 'studio-window', kind: 'window', roomId: 'studio-room', x: worldX(240), y: wallHeight(330), w: 2.7, h: 1.38 },
      { id: 'studio-clock', kind: 'clock', roomId: 'studio-room', x: worldX(1530), y: wallHeight(150), w: 0.58 },
      { id: 'studio-shelf', kind: 'shelf', roomId: 'studio-room', x: worldX(1185), y: 1.72, w: 2.1 },
      { id: 'studio-rug', kind: 'rug', roomId: 'studio-room', x: 0, z: floorDepth(728), w: 13.6, d: 1.7 },
      { id: 'studio-sofa', kind: 'sofa', roomId: 'studio-room', x: worldX(400), z: 0.98, w: 4.2, d: 1 },
      { id: 'studio-floor-lamp', kind: 'floor-lamp', roomId: 'studio-room', x: worldX(150), z: 0.42, light: true },
      { id: 'studio-bed', kind: 'bed', roomId: 'studio-room', x: worldX(855), z: 1.3, w: 2.9, d: 2.56 },
      { id: 'studio-desk', kind: 'desk', roomId: 'studio-room', x: worldX(1192), z: 0.42, w: 3.1, d: 0.8, h: 0.76 },
      { id: 'studio-desk-lamp', kind: 'table-lamp', roomId: 'studio-room', x: worldX(1322), y: 0.76, z: 0.24, light: true },
      { id: 'studio-plant', kind: 'plant', roomId: 'studio-room', x: worldX(1460), z: 0.46, variant: 'tall' },
    ],
  },
  'comfort-suite': {
    rooms: { 'suite-living': 'warm', 'suite-bedroom': 'sky' },
    tabletops: {
      'suite-living-table': { height: 0.44, z0: 1.58, z1: 2.42 },
      'suite-bedroom-table': { height: 0.66, z0: 0.12, z1: 0.64 },
    },
    furniture: [
      { id: 'suite-window', kind: 'window', roomId: 'suite-living', x: worldX(142), y: wallHeight(395), w: 1.65, h: 1.71, variant: 'arch' },
      { id: 'suite-media-unit', kind: 'console', roomId: 'suite-living', x: worldX(610), z: 0.26, w: 2.1, d: 0.48, h: 0.5 },
      { id: 'suite-plant', kind: 'plant', roomId: 'suite-living', x: worldX(96), z: 0.44 },
      { id: 'suite-floor-lamp', kind: 'floor-lamp', roomId: 'suite-living', x: worldX(742), z: 0.44, light: true },
      { id: 'suite-rug', kind: 'rug', roomId: 'suite-living', x: worldX(465), z: floorDepth(700), w: 4.7, d: 2.3 },
      { id: 'suite-sofa', kind: 'sofa', roomId: 'suite-living', x: worldX(472), z: 0.98, w: 4.2, d: 1 },
      { id: 'suite-coffee-table', kind: 'coffee-table', roomId: 'suite-living', x: worldX(395), z: 2, w: 2.5, d: 0.96, h: 0.44 },
      { id: 'suite-moon-gate', kind: 'moon-gate', roomId: 'suite-bedroom', x: worldX(1010), y: wallHeight(210), w: 1.28 },
      { id: 'suite-bedroom-window', kind: 'window', roomId: 'suite-bedroom', x: worldX(1334), y: wallHeight(315), w: 3.08, h: 1.32 },
      { id: 'suite-pendant', kind: 'pendant', roomId: 'suite-bedroom', x: worldX(905), y: 1.55, z: 0.42, light: true },
      { id: 'suite-bedroom-rug', kind: 'rug', roomId: 'suite-bedroom', x: worldX(1180), z: floorDepth(753), w: 6.2, d: 1.04 },
      { id: 'suite-bed', kind: 'bed', roomId: 'suite-bedroom', x: worldX(1155), z: 1.38, w: 3.8, d: 2.72 },
      { id: 'suite-side-table', kind: 'nightstand', roomId: 'suite-bedroom', x: worldX(905), z: 0.38, w: 1, d: 0.64, h: 0.66 },
      { id: 'suite-bedroom-plant', kind: 'plant', roomId: 'suite-bedroom', x: worldX(1540), z: 0.5, variant: 'bush' },
    ],
  },
  'my-home': {
    rooms: { 'home-bathroom': 'sky', 'home-kitchen': 'clay', 'home-balcony': 'warm', 'home-living': 'warm', 'home-bedroom-a': 'sky', 'home-bedroom-b': 'clay' },
    tabletops: {
      'home-kitchen-counter': { height: 0.9, z0: 0.08, z1: 0.56 },
      'home-living-table': { height: 0.42, z0: 1.76, z1: 2.24 },
      'home-bedroom-a-table': { height: 0.56, z0: 0.12, z1: 0.48 },
      'home-bedroom-b-table': { height: 0.5, z0: 0.12, z1: 0.46 },
    },
    furniture: [
      { id: 'home-bath-mirror', kind: 'moon-gate', roomId: 'home-bathroom', x: worldX(60), y: wallHeight(270), w: 0.56 },
      { id: 'home-bath-vanity', kind: 'vanity', roomId: 'home-bathroom', x: worldX(60), z: 0.28, w: 0.7, d: 0.48, h: 0.82 },
      { id: 'home-bath-toilet', kind: 'toilet', roomId: 'home-bathroom', x: worldX(120), z: 0.36 },
      { id: 'home-kitchen-window', kind: 'window', roomId: 'home-kitchen', x: worldX(193), y: 1.3, w: 0.72, h: 0.9 },
      { id: 'home-kitchen-counter', kind: 'counter', roomId: 'home-kitchen', x: worldX(223), z: 0.31, w: 1.3, d: 0.62, h: 0.9 },
      { id: 'home-kitchen-fridge', kind: 'fridge', roomId: 'home-kitchen', x: worldX(320), z: 0.34, w: 0.6, d: 0.64, h: 1.8 },
      { id: 'home-kitchen-pendant', kind: 'pendant', roomId: 'home-kitchen', x: worldX(250), y: 1.95, z: 1.3, light: true },
      { id: 'home-balcony-window', kind: 'window', roomId: 'home-balcony', x: worldX(465), y: 1.02, w: 1.9, h: 1.5 },
      { id: 'home-balcony-laundry', kind: 'laundry', roomId: 'home-balcony', x: worldX(433), z: 0.34, w: 1.5, d: 0.68, h: 0.9 },
      { id: 'home-balcony-plant', kind: 'plant', roomId: 'home-balcony', x: worldX(545), z: 0.5, variant: 'tall' },
      { id: 'home-balcony-basket', kind: 'basket', roomId: 'home-balcony', x: worldX(400), z: 1.44 },
      { id: 'home-living-window', kind: 'window', roomId: 'home-living', x: worldX(680), y: 0.95, w: 1.3, h: 1.35 },
      { id: 'home-living-rug', kind: 'rug', roomId: 'home-living', x: worldX(700), z: 1.75, w: 2.8, d: 2 },
      { id: 'home-living-sofa', kind: 'sofa', roomId: 'home-living', x: worldX(700), z: 0.95, w: 2.2, d: 0.9 },
      { id: 'home-living-table', kind: 'coffee-table', roomId: 'home-living', x: worldX(700), z: 2, w: 1.2, d: 0.6, h: 0.42 },
      { id: 'home-living-console', kind: 'console', roomId: 'home-living', x: worldX(925), z: 0.25, w: 1.6, d: 0.45, h: 0.5 },
      { id: 'home-living-lamp', kind: 'table-lamp', roomId: 'home-living', x: worldX(990), y: 0.5, z: 0.22, light: true },
      { id: 'home-living-plant', kind: 'plant', roomId: 'home-living', x: worldX(1038), z: 0.42 },
      { id: 'home-dining-table', kind: 'dining-table', roomId: 'home-living', x: worldX(925), z: 2.6, w: 1.2, d: 0.8, h: 0.75 },
      { id: 'home-dining-pendant', kind: 'pendant', roomId: 'home-living', x: worldX(925), y: 1.75, z: 2.6, light: true },
      { id: 'home-bedroom-a-clock', kind: 'clock', roomId: 'home-bedroom-a', x: worldX(1110), y: 2.3, w: 0.42 },
      { id: 'home-bedroom-a-window', kind: 'window', roomId: 'home-bedroom-a', x: worldX(1190), y: 1.3, w: 1.3, h: 1.2 },
      { id: 'home-bedroom-a-rug', kind: 'rug', roomId: 'home-bedroom-a', x: worldX(1185), z: 2.9, w: 2.2, d: 1.1 },
      { id: 'home-bedroom-a-bed', kind: 'bed', roomId: 'home-bedroom-a', x: worldX(1185), z: 1.25, w: 1.9, d: 2.3 },
      { id: 'home-bedroom-a-side-table', kind: 'nightstand', roomId: 'home-bedroom-a', x: worldX(1312), z: 0.3, w: 0.5, d: 0.45, h: 0.56 },
      { id: 'home-bedroom-b-window', kind: 'window', roomId: 'home-bedroom-b', x: worldX(1442), y: 1.3, w: 1.1, h: 1.15 },
      { id: 'home-bedroom-b-rug', kind: 'rug', roomId: 'home-bedroom-b', x: worldX(1442), z: 2.7, w: 1.9, d: 1 },
      { id: 'home-bedroom-b-bed', kind: 'bed', roomId: 'home-bedroom-b', x: worldX(1442), z: 1.15, w: 1.5, d: 2.1 },
      { id: 'home-bedroom-b-side-table', kind: 'nightstand', roomId: 'home-bedroom-b', x: worldX(1550), z: 0.3, w: 0.5, d: 0.45, h: 0.5 },
      { id: 'home-bedroom-b-pendant', kind: 'pendant', roomId: 'home-bedroom-b', x: worldX(1550), y: 1.6, z: 0.32, light: true },
    ],
  },
}
