import type { HomeSurface, HomeTemplate } from '~/types'
import type { Vec3 } from './projection'

export const APARTMENT_WALL_SIDES = ['back', 'left', 'right', 'front'] as const
export type ApartmentWallSide = typeof APARTMENT_WALL_SIDES[number]
export type WallMode = 'auto' | 'manual'
export type WallVisibility = Readonly<Partial<Record<string, boolean>>>

export interface WallPanel {
  axis: 'x' | 'z'
  position: number
  start: number
  end: number
  height: number
}

export function apartmentWallKeys(template: HomeTemplate, roomId: string | null): Record<ApartmentWallSide, string> | null {
  if (template.id !== 'cloud-apartment')
    return null
  const index = template.rooms.findIndex(room => room.id === roomId)
  if (index < 0)
    return null
  return {
    back: `back-${roomId}`,
    left: `side-${index}`,
    right: `side-${index + 1}`,
    front: `front-${roomId}`,
  }
}

export function wallIsVisible(key: string, visibility: WallVisibility) {
  return visibility[key] ?? !key.startsWith('front-')
}

export function surfaceIsVisible(template: HomeTemplate, surface: HomeSurface, visibility: WallVisibility) {
  if (surface.kind !== 'wall')
    return true
  const keys = apartmentWallKeys(template, surface.roomId)
  return !keys || wallIsVisible(keys[surface.wallSide ?? 'back'], visibility)
}

/** Whether the segment from the camera to the room crosses the wall panel. */
export function wallBlocksView(panel: WallPanel, camera: Vec3, room: Vec3, wasHidden: boolean) {
  const axis = panel.axis
  const delta = room[axis] - camera[axis]
  if (Math.abs(delta) < 1e-6)
    return false
  const distance = (panel.position - camera[axis]) / delta
  if (distance <= 0 || distance >= 1)
    return false

  const along = axis === 'x' ? 'z' : 'x'
  const position = camera[along] + (room[along] - camera[along]) * distance
  const height = camera.y + (room.y - camera.y) * distance
  // Use slightly different edges to keep walls steady as the view grazes them.
  const inset = wasHidden ? -0.06 : 0.06
  return position > panel.start + inset && position < panel.end - inset
    && height > 0 && height < panel.height - inset
}
