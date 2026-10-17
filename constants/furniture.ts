import type { FurnitureKind } from '~/types'

/** How a kind of furniture behaves when the user arranges the home. */
export interface FurnitureKindInfo {
  name: string
  /**
   * Floor pieces stand on the floor and have a footprint. Wall pieces hang on
   * a wall, lamps stand on or hang over another piece; neither has one.
   */
  mount: 'floor' | 'wall' | 'over'
  /** The user can move, turn and remove it, and add more. */
  movable: boolean
  /** Solid on the floor: floor devices cannot go there. Rugs lie flat, so devices stand on them. */
  blocks: boolean
  /** Footprint when a piece gives no width and depth, and the size of added pieces, in metres. */
  size: { w: number, d: number, h?: number }
  /** Added pieces of this kind carry a tabletop for tabletop devices. */
  top?: boolean
  /** Added pieces of this kind glow at night. */
  light?: boolean
}

export const FURNITURE_KINDS: Record<FurnitureKind, FurnitureKindInfo> = {
  'sofa': { name: '沙发', mount: 'floor', movable: true, blocks: true, size: { w: 2, d: 0.9 } },
  'coffee-table': { name: '茶几', mount: 'floor', movable: true, blocks: true, size: { w: 1.1, d: 0.6, h: 0.42 }, top: true },
  'console': { name: '矮柜', mount: 'floor', movable: true, blocks: true, size: { w: 1.6, d: 0.45, h: 0.5 }, top: true },
  'table-lamp': { name: '台灯', mount: 'over', movable: false, blocks: false, size: { w: 0.32, d: 0.32 } },
  'floor-lamp': { name: '落地灯', mount: 'floor', movable: true, blocks: true, size: { w: 0.4, d: 0.4 }, light: true },
  'pendant': { name: '吊灯', mount: 'over', movable: false, blocks: false, size: { w: 0.4, d: 0.4 } },
  'plant': { name: '绿植', mount: 'floor', movable: true, blocks: true, size: { w: 0.36, d: 0.36 } },
  'rug': { name: '地毯', mount: 'floor', movable: true, blocks: false, size: { w: 2, d: 1.4 } },
  'bed': { name: '床', mount: 'floor', movable: true, blocks: true, size: { w: 1.5, d: 2 } },
  'nightstand': { name: '床头柜', mount: 'floor', movable: true, blocks: true, size: { w: 0.5, d: 0.45, h: 0.56 }, top: true },
  'shelf': { name: '置物架', mount: 'wall', movable: false, blocks: false, size: { w: 2.4, d: 0.3 } },
  'laundry': { name: '洗衣柜', mount: 'floor', movable: true, blocks: true, size: { w: 1.5, d: 0.6, h: 0.9 }, top: true },
  'basket': { name: '收纳篮', mount: 'floor', movable: true, blocks: true, size: { w: 0.52, d: 0.52 } },
  'desk': { name: '书桌', mount: 'floor', movable: true, blocks: true, size: { w: 1.4, d: 0.7, h: 0.76 }, top: true },
  'clock': { name: '挂钟', mount: 'wall', movable: false, blocks: false, size: { w: 0.6, d: 0.1 } },
  'window': { name: '窗', mount: 'wall', movable: false, blocks: false, size: { w: 2, d: 0.2 } },
  'moon-gate': { name: '圆窗', mount: 'wall', movable: false, blocks: false, size: { w: 1.2, d: 0.1 } },
  'counter': { name: '橱柜', mount: 'floor', movable: false, blocks: true, size: { w: 1.4, d: 0.62, h: 0.9 } },
  'fridge': { name: '冰箱', mount: 'floor', movable: false, blocks: true, size: { w: 0.6, d: 0.64, h: 1.8 } },
  'dining-table': { name: '餐桌', mount: 'floor', movable: true, blocks: true, size: { w: 1, d: 0.9, h: 0.75 }, top: true },
  'vanity': { name: '洗手台', mount: 'floor', movable: false, blocks: true, size: { w: 0.7, d: 0.48, h: 0.82 } },
  'toilet': { name: '马桶', mount: 'floor', movable: false, blocks: true, size: { w: 0.44, d: 0.62 } },
  'bay-seat': { name: '飘窗', mount: 'floor', movable: false, blocks: true, size: { w: 1.8, d: 0.5 } },
}

/** Kinds the user can add, in the order the catalogue lists them. */
export const FURNITURE_CATALOGUE: FurnitureKind[] = [
  'sofa',
  'coffee-table',
  'dining-table',
  'desk',
  'bed',
  'nightstand',
  'console',
  'laundry',
  'rug',
  'plant',
  'floor-lamp',
  'basket',
]

export function isFurnitureKind(value: unknown): value is FurnitureKind {
  return typeof value === 'string' && Object.hasOwn(FURNITURE_KINDS, value)
}
