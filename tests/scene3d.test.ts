import { describe, expect, it } from 'vitest'
import { createDefaultHomeState, HOME_TEMPLATES } from '~/constants/home'
import { SCENE3D_TEMPLATES } from '~/constants/scene3d'
import type { HomeTemplateId } from '~/types'
import type { Ray3, Vec3 } from '~/utils/scene3d/projection'
import { createPlacementAtPoint, placementToWorld, worldPointToSurface } from '~/utils/home'
import { findSurfaceAlongRay, floorDepth, projectPlacement, projectSurfacePoint, roomAtWorldX, roomExtent, SCENE3D, unprojectSurfacePoint, wallHeight, worldX } from '~/utils/scene3d/projection'

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

/** A ray from a camera in front of the diorama towards a point. */
function rayTo(target: Vec3): Ray3 {
  const origin = { x: target.x * 0.6, y: 6, z: 14 }
  const direction = { x: target.x - origin.x, y: target.y - origin.y, z: target.z - origin.z }
  const length = Math.hypot(direction.x, direction.y, direction.z)
  return { origin, direction: { x: direction.x / length, y: direction.y / length, z: direction.z / length } }
}

describe('3D placement', () => {
  it.each(templateIds)('maps every surface of %s back to the 2D point it came from', (templateId) => {
    const template = HOME_TEMPLATES[templateId]
    const { tabletops } = SCENE3D_TEMPLATES[templateId]
    for (const surface of template.surfaces) {
      for (const [u, v] of [[0.25, 0.3], [0.5, 0.5], [0.8, 0.7]] as const) {
        const position = projectSurfacePoint(surface, u, v, template.width, tabletops[surface.id])
        const point = unprojectSurfacePoint(surface, position, template.width, tabletops[surface.id])
        const local = worldPointToSurface(surface, point)
        expect(local.u, surface.id).toBeCloseTo(u, 5)
        expect(local.v, surface.id).toBeCloseTo(v, 5)
      }
    }
  })

  it.each(templateIds)('points back at the spot of every default device of %s', (templateId) => {
    const template = HOME_TEMPLATES[templateId]
    const { tabletops } = SCENE3D_TEMPLATES[templateId]
    for (const placement of createDefaultHomeState(templateId).placements) {
      const projected = projectPlacement(template, placement, tabletops)!
      const hit = findSurfaceAlongRay(template, placement.deviceId, rayTo(projected.position), tabletops)
      expect(hit?.surface.id, placement.deviceId).toBe(placement.surfaceId)
      const spot = placementToWorld(template, placement)!
      expect(Math.hypot(hit!.point.x - spot.x, hit!.point.y - spot.y), placement.deviceId).toBeLessThan(0.5)
    }
  })

  it('places a dragged device exactly under the pointer', () => {
    const template = HOME_TEMPLATES.studio
    const surface = template.surfaces.find(item => item.id === 'studio-floor')!
    const target = projectSurfacePoint(surface, 0.9, 0.85, template.width)
    const hit = findSurfaceAlongRay(template, 'fan', rayTo(target))!
    const placement = createPlacementAtPoint(template, 'fan', hit.point, [])!
    expect(placement.u).toBeCloseTo(0.9, 5)
    expect(placement.v).toBeCloseTo(0.85, 5)
  })

  it('only offers surfaces that accept the device', () => {
    const template = HOME_TEMPLATES['cloud-apartment']
    const { tabletops } = SCENE3D_TEMPLATES['cloud-apartment']
    // Aim at the living room floor: a wall device still finds the wall plane, off its surface.
    const floor = rayTo({ x: worldX(300), y: 0, z: 2 })
    expect(findSurfaceAlongRay(template, 'fan', floor, tabletops)?.surface.id).toBe('living-floor')
    const wall = findSurfaceAlongRay(template, 'air-conditioner', floor, tabletops)
    expect(wall?.surface.kind).toBe('wall')
    expect(createPlacementAtPoint(template, 'air-conditioner', wall!.point, [])).toBeNull()
  })

  it('finds the tabletop under the pointer rather than another at a different height', () => {
    const template = HOME_TEMPLATES['cloud-apartment']
    const { tabletops } = SCENE3D_TEMPLATES['cloud-apartment']
    const surface = template.surfaces.find(item => item.id === 'utility-table')!
    const target = projectSurfacePoint(surface, 0.5, 0.5, template.width, tabletops[surface.id])
    expect(findSurfaceAlongRay(template, 'hand-warmer', rayTo(target), tabletops)?.surface.id).toBe('utility-table')
  })

  it('returns null when the ray never meets an accepting plane', () => {
    const template = HOME_TEMPLATES.studio
    const up: Ray3 = { origin: { x: 0, y: 5, z: 10 }, direction: { x: 0, y: 1, z: 0 } }
    expect(findSurfaceAlongRay(template, 'fan', up)).toBeNull()
  })
})
