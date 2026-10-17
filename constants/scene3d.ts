import type { HomePoint, HomeTemplateId } from '~/types'
import type { TabletopSpec } from '~/utils/scene3d/projection'
import { floorDepth, planX, planZ, wallHeight, worldX } from '~/utils/scene3d/projection'

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
  | 'bay-seat'

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
  /** Turn about the vertical, in degrees: 0 faces the viewer, 90 east, 180 north, 270 west. */
  rotation?: number
  /** Lamps glow in the evening and at night. */
  light?: boolean
}

/** Back wall tint of each room, by room. */
export type RoomAccent = 'warm' | 'sky' | 'clay'

/** A run of wall on a floor plan, along its centre line in plan centimetres. */
export interface PlanWall {
  points: HomePoint[]
  /**
   * Full walls reach the ceiling; cut walls stop low so the camera sees over
   * them; rails are a balcony's glass railing. Full when unset.
   */
  height?: 'full' | 'cut' | 'rail'
  /** Door gaps along the wall, in centimetres from its first point. */
  openings?: Array<{ at: number, width: number }>
}

/** The rooms of a floor plan template, built from walls. */
export interface PlanShell {
  walls: PlanWall[]
  /** Floor outlines of rooms that are not their rectangle, in plan centimetres. */
  outlines?: Record<string, HomePoint[]>
  /** Rooms with tiled floors rather than planks. */
  tiled?: string[]
}

export interface Scene3DTemplate {
  rooms: Record<string, RoomAccent>
  tabletops: Record<string, TabletopSpec>
  furniture: FurnitureSpec[]
  /** Floor plan templates: the walls and floors to build. */
  plan?: PlanShell
}

// 云端小家 is a floor plan of 1060 × 723 cm.
const myX = (x: number) => planX(x, 1060)
const myZ = (y: number) => planZ(y, 723)
const DEGREE = Math.PI / 180

/**
 * Points along a circular arc on a floor plan, ends included.
 *
 * @param cx - Centre x
 * @param cy - Centre y
 * @param r - Radius
 * @param from - Start angle in degrees, 0 east and 90 south
 * @param to - End angle in degrees
 * @param steps - Number of straight pieces
 * @returns The points
 */
function arc(cx: number, cy: number, r: number, from: number, to: number, steps: number): HomePoint[] {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = DEGREE * (from + (to - from) * index / steps)
    return { x: Math.round((cx + r * Math.cos(angle)) * 10) / 10, y: Math.round((cy + r * Math.sin(angle)) * 10) / 10 }
  })
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
      'home-kitchen-counter': { height: 0.9 },
      'home-living-table': { height: 0.42 },
      'home-bedroom-a-table': { height: 0.56 },
      'home-bedroom-b-table': { height: 0.5 },
    },
    plan: {
      walls: [
        // Outside walls. The north-west corner steps in around the bathroom, the
        // entry door opens in the living room's north wall, and both bay windows jut out.
        { points: [{ x: 0, y: 565 }, { x: 0, y: 142 }, { x: 232, y: 142 }, { x: 232, y: 0 }, { x: 980, y: 0 }], openings: [{ at: 810, width: 75 }] },
        { points: [{ x: 980, y: 0 }, { x: 980, y: 565 }], openings: [{ at: 129, width: 123 }] },
        { points: [{ x: 980, y: 129 }, { x: 1055, y: 129 }, { x: 1055, y: 252 }, { x: 980, y: 252 }] },
        // The south facade is cut away: the kitchen and living room open onto the balcony.
        { points: [{ x: 0, y: 565 }, { x: 980, y: 565 }], height: 'cut', openings: [{ at: 182, width: 46 }, { at: 355, width: 285 }, { at: 787, width: 142 }] },
        { points: [{ x: 787, y: 565 }, { x: 787, y: 637 }, { x: 929, y: 637 }, { x: 929, y: 565 }], height: 'cut' },
        { points: [{ x: 180, y: 565 }, { x: 180, y: 711 }, { x: 576, y: 711 }, ...arc(576, 637, 74, 90, 0, 6).slice(1), { x: 650, y: 565 }], height: 'rail' },
        // Inside walls: the ones running north to south stay up, the rest are cut away.
        { points: [{ x: 162, y: 142 }, { x: 162, y: 325 }], openings: [{ at: 93, width: 70 }] },
        { points: [{ x: 0, y: 325 }, { x: 232, y: 325 }], height: 'cut', openings: [{ at: 175, width: 55 }] },
        { points: [{ x: 232, y: 325 }, { x: 232, y: 565 }] },
        { points: [{ x: 647, y: 0 }, { x: 647, y: 565 }], openings: [{ at: 172, width: 75 }, { at: 282, width: 74 }] },
        { points: [{ x: 647, y: 263 }, { x: 980, y: 263 }], height: 'cut' },
      ],
      outlines: {
        // The living room reaches past the bathroom, to the kitchen door.
        'home-living': [{ x: 232, y: 0 }, { x: 647, y: 0 }, { x: 647, y: 565 }, { x: 232, y: 565 }, { x: 232, y: 325 }, { x: 162, y: 325 }, { x: 162, y: 142 }, { x: 232, y: 142 }],
        'home-balcony': [{ x: 180, y: 565 }, { x: 650, y: 565 }, ...arc(576, 637, 74, 0, 90, 6), { x: 180, y: 711 }],
        'home-bedroom-a': [{ x: 647, y: 263 }, { x: 980, y: 263 }, { x: 980, y: 565 }, { x: 929, y: 565 }, { x: 929, y: 637 }, { x: 787, y: 637 }, { x: 787, y: 565 }, { x: 647, y: 565 }],
        'home-bedroom-b': [{ x: 647, y: 0 }, { x: 980, y: 0 }, { x: 980, y: 129 }, { x: 1055, y: 129 }, { x: 1055, y: 252 }, { x: 980, y: 252 }, { x: 980, y: 263 }, { x: 647, y: 263 }],
      },
      tiled: ['home-bathroom', 'home-kitchen', 'home-balcony'],
    },
    furniture: [
      { id: 'home-bath-mirror', kind: 'moon-gate', roomId: 'home-bathroom', x: myX(45), y: 1.45, z: myZ(149), w: 0.5 },
      { id: 'home-bath-vanity', kind: 'vanity', roomId: 'home-bathroom', x: myX(45), z: myZ(172), w: 0.7, d: 0.48, h: 0.82 },
      { id: 'home-bath-toilet', kind: 'toilet', roomId: 'home-bathroom', x: myX(120), z: myZ(181) },
      { id: 'home-bath-window', kind: 'window', roomId: 'home-bathroom', x: myX(7), y: 1.2, z: myZ(245), w: 0.8, h: 0.9, rotation: 90 },
      { id: 'home-kitchen-fridge', kind: 'fridge', roomId: 'home-kitchen', x: myX(39), z: myZ(358), w: 0.6, d: 0.64, h: 1.8, rotation: 90 },
      { id: 'home-kitchen-counter', kind: 'counter', roomId: 'home-kitchen', x: myX(38), z: myZ(470), w: 1.6, d: 0.62, h: 0.9, rotation: 90 },
      { id: 'home-kitchen-pendant', kind: 'pendant', roomId: 'home-kitchen', x: myX(140), y: 1.95, z: myZ(445), light: true },
      { id: 'home-balcony-laundry', kind: 'laundry', roomId: 'home-balcony', x: myX(420), z: myZ(677), w: 1.5, d: 0.6, h: 0.9, rotation: 180 },
      { id: 'home-balcony-plant', kind: 'plant', roomId: 'home-balcony', x: myX(612), z: myZ(598), variant: 'tall' },
      { id: 'home-balcony-basket', kind: 'basket', roomId: 'home-balcony', x: myX(250), z: myZ(680) },
      { id: 'home-living-window', kind: 'window', roomId: 'home-living', x: myX(492), y: 0.95, z: myZ(7), w: 1.4, h: 1.35 },
      { id: 'home-dining-table', kind: 'dining-table', roomId: 'home-living', x: myX(492), z: myZ(110), w: 1, d: 0.9, h: 0.75 },
      { id: 'home-dining-pendant', kind: 'pendant', roomId: 'home-living', x: myX(492), y: 1.75, z: myZ(110), light: true },
      { id: 'home-living-plant', kind: 'plant', roomId: 'home-living', x: myX(615), z: myZ(32) },
      { id: 'home-living-rug', kind: 'rug', roomId: 'home-living', x: myX(380), z: myZ(440), w: 2.1, d: 2, rotation: 90 },
      { id: 'home-living-sofa', kind: 'sofa', roomId: 'home-living', x: myX(283), z: myZ(440), w: 2, d: 0.9, rotation: 90 },
      { id: 'home-living-floor-lamp', kind: 'floor-lamp', roomId: 'home-living', x: myX(262), z: myZ(312), light: true },
      { id: 'home-living-table', kind: 'coffee-table', roomId: 'home-living', x: myX(410), z: myZ(440), w: 1.1, d: 0.6, h: 0.42, rotation: 90 },
      { id: 'home-living-console', kind: 'console', roomId: 'home-living', x: myX(618), z: myZ(460), w: 1.6, d: 0.45, h: 0.5, rotation: 270 },
      { id: 'home-living-lamp', kind: 'table-lamp', roomId: 'home-living', x: myX(620), y: 0.5, z: myZ(392), light: true },
      { id: 'home-bedroom-a-rug', kind: 'rug', roomId: 'home-bedroom-a', x: myX(720), z: myZ(460), w: 1.6, d: 0.8, rotation: 90 },
      { id: 'home-bedroom-a-bed', kind: 'bed', roomId: 'home-bedroom-a', x: myX(874), z: myZ(460), w: 1.5, d: 2, rotation: 270 },
      { id: 'home-bedroom-a-side-table', kind: 'nightstand', roomId: 'home-bedroom-a', x: myX(953), z: myZ(355), w: 0.5, d: 0.45, h: 0.56, rotation: 270 },
      { id: 'home-bedroom-a-bay', kind: 'bay-seat', roomId: 'home-bedroom-a', x: myX(858), z: myZ(605), w: 1.36, d: 0.6, rotation: 180 },
      { id: 'home-bedroom-b-bed', kind: 'bed', roomId: 'home-bedroom-b', x: myX(753), z: myZ(95), w: 1.4, d: 2, rotation: 90 },
      { id: 'home-bedroom-b-side-table', kind: 'nightstand', roomId: 'home-bedroom-b', x: myX(955), z: myZ(30), w: 0.45, d: 0.4, h: 0.5, rotation: 270 },
      { id: 'home-bedroom-b-rug', kind: 'rug', roomId: 'home-bedroom-b', x: myX(800), z: myZ(205), w: 1.9, d: 0.6 },
      { id: 'home-bedroom-b-window', kind: 'window', roomId: 'home-bedroom-b', x: myX(1048), y: 0.95, z: myZ(190), w: 1.1, h: 1.3, rotation: 270 },
      { id: 'home-bedroom-b-bay', kind: 'bay-seat', roomId: 'home-bedroom-b', x: myX(1018), z: myZ(190), w: 1.2, d: 0.66, rotation: 270 },
      { id: 'home-bedroom-b-pendant', kind: 'pendant', roomId: 'home-bedroom-b', x: myX(790), y: 1.7, z: myZ(100), light: true },
    ],
  },
}
