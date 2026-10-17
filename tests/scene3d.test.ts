import { describe, expect, it } from 'vitest'
import { createDefaultHomeState, HOME_TEMPLATES } from '~/constants/home'
import { SCENE3D_TEMPLATES } from '~/constants/scene3d'
import type { HomeTemplateId } from '~/types'
import { floorDepth, projectPlacement, roomAtWorldX, roomExtent, SCENE3D, wallHeight, worldX } from '~/utils/scene3d/projection'

const templateIds = Object.keys(HOME_TEMPLATES) as HomeTemplateId[]

describe('3D scene projection', () => {
  it('centres the scene and keeps walls and floor within the diorama', () => {
    expect(worldX(800)).toBe(0)
    expect(worldX(0)).toBe(-8)
    expect(wallHeight(SCENE3D.floorLine)).toBe(0)
    expect(wallHeight(0)).toBe(SCENE3D.height)
    expect(floorDepth(SCENE3D.floorLine)).toBe(0)
    expect(floorDepth(SCENE3D.floorFront)).toBeCloseTo(SCENE3D.depth)
    expect(floorDepth(2000)).toBe(SCENE3D.depth)
  })

  it.each(templateIds)('places every default device of %s inside its room', (templateId) => {
    const template = HOME_TEMPLATES[templateId]
    const { tabletops } = SCENE3D_TEMPLATES[templateId]
    for (const placement of createDefaultHomeState(templateId).placements) {
      const projected = projectPlacement(template, placement, tabletops)
      expect(projected, placement.deviceId).not.toBeNull()
      const { position, surfaceKind } = projected!
      const extent = roomExtent(template, placement.roomId)
      expect(position.x).toBeGreaterThanOrEqual(extent.x0)
      expect(position.x).toBeLessThanOrEqual(extent.x1)
      expect(roomAtWorldX(template, position.x)).toBe(placement.roomId)
      if (surfaceKind === 'wall') {
        expect(position.z).toBe(SCENE3D.wallOffset)
        expect(position.y).toBeGreaterThan(0.5)
      }
      if (surfaceKind === 'floor')
        expect(position.y).toBe(0)
      if (surfaceKind === 'tabletop')
        expect(position.y).toBe(tabletops[placement.surfaceId!]!.height)
    }
  })

  it.each(templateIds)('describes the 3D layout of every room and tabletop in %s', (templateId) => {
    const template = HOME_TEMPLATES[templateId]
    const spec = SCENE3D_TEMPLATES[templateId]
    expect(Object.keys(spec.rooms).sort()).toEqual(template.rooms.map(room => room.id).sort())
    const tabletopIds = template.surfaces.filter(surface => surface.kind === 'tabletop').map(surface => surface.id)
    expect(Object.keys(spec.tabletops).sort()).toEqual(tabletopIds.sort())
    for (const item of spec.furniture) {
      expect(roomAtWorldX(template, item.x), item.id).toBe(item.roomId)
      expect(item.z ?? 0).toBeLessThanOrEqual(SCENE3D.depth)
    }
  })

  it('returns null for unplaced devices', () => {
    const template = HOME_TEMPLATES['cloud-apartment']
    expect(projectPlacement(template, { deviceId: 'fan', roomId: null, surfaceId: null, u: 0.5, v: 0.5, rotation: 0 })).toBeNull()
  })
})
