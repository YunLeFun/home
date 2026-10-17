import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createDefaultHomeState, HOME_TEMPLATES } from '~/constants/home'
import { SCENE3D_TEMPLATES } from '~/constants/scene3d'
import type { HomeTemplateId } from '~/types'
import type { Ray3, Vec3 } from '~/utils/scene3d/projection'
import { createPlacementAtPoint, hasPlacementCollision, placementToWorld, worldPointToSurface } from '~/utils/home'
import { findSurfaceAlongRay, floorDepth, isPlan, PLAN3D, planX, planZ, projectFloorPoint, projectPlacement, projectSurfacePoint, roomAt, roomBounds, SCENE3D, surfaceFrame, unprojectSurfacePoint, wallHeight, worldX } from '~/utils/scene3d/projection'

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
      const bounds = roomBounds(template, placement.roomId)
      expect(position.x).toBeGreaterThanOrEqual(bounds.x0)
      expect(position.x).toBeLessThanOrEqual(bounds.x1)
      expect(position.z).toBeGreaterThanOrEqual(bounds.z0)
      expect(position.z).toBeLessThanOrEqual(bounds.z1)
      expect(roomAt(template, position)).toBe(placement.roomId)
      if (surfaceKind === 'wall') {
        if (!isPlan(template))
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
      const position = { x: item.x, y: item.y ?? 0, z: item.z ?? 0 }
      expect(roomAt(template, position), item.id).toBe(item.roomId)
      if (!isPlan(template))
        expect(position.z).toBeLessThanOrEqual(SCENE3D.depth)
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
  it.each(templateIds)('maps every surface of %s back to the plan point it came from', (templateId) => {
    const template = HOME_TEMPLATES[templateId]
    const { tabletops } = SCENE3D_TEMPLATES[templateId]
    for (const surface of template.surfaces) {
      for (const [u, v] of [[0.25, 0.3], [0.5, 0.5], [0.8, 0.7]] as const) {
        const position = projectSurfacePoint(template, surface, u, v, tabletops[surface.id])
        const point = unprojectSurfacePoint(template, surface, position, tabletops[surface.id])
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
    const target = projectSurfacePoint(template, surface, 0.9, 0.85)
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
    const target = projectSurfacePoint(template, surface, 0.5, 0.5, tabletops[surface.id])
    expect(findSurfaceAlongRay(template, 'hand-warmer', rayTo(target), tabletops)?.surface.id).toBe('utility-table')
  })

  it('returns null when the ray never meets an accepting plane', () => {
    const template = HOME_TEMPLATES.studio
    const up: Ray3 = { origin: { x: 0, y: 5, z: 10 }, direction: { x: 0, y: 1, z: 0 } }
    expect(findSurfaceAlongRay(template, 'fan', up)).toBeNull()
  })
})

describe('3D floor plan', () => {
  const template = HOME_TEMPLATES['my-home']
  const { tabletops } = SCENE3D_TEMPLATES['my-home']

  it('lays the plan out at true scale around the centre', () => {
    expect(isPlan(template)).toBe(true)
    expect(planX(template.width / 2, template.width)).toBe(0)
    const home = roomBounds(template, null)
    // The living room is about 4.15 m wide, north of the balcony; the kitchen 2.4 m deep.
    const living = roomBounds(template, 'home-living')
    expect(living.x1 - living.x0).toBeCloseTo(4.15)
    expect(living.z1).toBeCloseTo(roomBounds(template, 'home-balcony').z0)
    const kitchen = roomBounds(template, 'home-kitchen')
    expect(kitchen.z1 - kitchen.z0).toBeCloseTo(2.4)
    expect(projectFloorPoint(template, { x: 0, y: 0 })).toEqual({ x: home.x0, y: 0, z: home.z0 })
  })

  it('stands every wall surface where its run is, facing its room', () => {
    for (const surface of template.surfaces.filter(item => item.kind === 'wall')) {
      const room = template.rooms.find(item => item.id === surface.roomId)!
      const { normal } = surfaceFrame(template, surface)
      const centre = { x: planX(room.x + room.width / 2, template.width), z: planZ(room.y + room.height / 2, template.height) }
      const point = projectSurfacePoint(template, surface, 0.5, 0.5)
      expect((centre.x - point.x) * normal.x + (centre.z - point.z) * normal.z, surface.id).toBeGreaterThan(0)
      const [from, to] = surface.run!
      // Just off the wall's centre line, at a height below the top.
      const distance = Math.abs((point.x - planX(from.x, template.width)) * (to.y - from.y) - (point.z - planZ(from.y, template.height)) * (to.x - from.x)) / Math.hypot(to.x - from.x, to.y - from.y)
      expect(distance, surface.id).toBeCloseTo(PLAN3D.wall / 2 + SCENE3D.wallOffset, 5)
      expect(point.y).toBeLessThan(PLAN3D.height)
    }
  })

  it('ignores walls a ray meets from behind', () => {
    const surface = template.surfaces.find(item => item.id === 'home-living-wall')!
    const target = projectSurfacePoint(template, surface, 0.5, 0.5)
    // From the bedroom side, east of the wall.
    const origin = { x: target.x + 4, y: target.y + 1, z: target.z }
    const direction = { x: -4, y: -1, z: 0 }
    const length = Math.hypot(direction.x, direction.y)
    const hit = findSurfaceAlongRay(template, 'television', { origin, direction: { x: direction.x / length, y: direction.y / length, z: 0 } }, tabletops)
    expect(hit?.surface.id).not.toBe('home-living-wall')
  })

  it('snaps a wall drop only along the wall it was dropped on', () => {
    const living = template.surfaces.find(item => item.id === 'home-living-wall')!
    const bedroom = template.surfaces.find(item => item.id === 'home-bedroom-b-wall')!
    // The same sheet point lies on both walls.
    const point = { x: 100, y: 100 }
    expect(createPlacementAtPoint(template, 'television', point, [], 0, living.id)?.surfaceId).toBe(living.id)
    expect(createPlacementAtPoint(template, 'television', point, [], 0, bedroom.id)?.surfaceId).toBe(bedroom.id)
  })

  it('does not collide devices on different sheets', () => {
    // The fan on the floor sits at the same plan point as the hand warmer's tabletop.
    const warmer = { deviceId: 'hand-warmer' as const, roomId: 'home-living', surfaceId: 'home-living-table', u: 0.5, v: 0.5, rotation: 0 as const }
    const fan = { deviceId: 'fan' as const, roomId: 'home-living', surfaceId: 'home-living-floor', u: 166 / 391, v: 397 / 541, rotation: 0 as const }
    expect(placementToWorld(template, fan)!.x).toBeCloseTo(placementToWorld(template, warmer)!.x)
    expect(hasPlacementCollision(template, fan, [warmer])).toBe(false)
  })

  it('keeps robot routes on the floor of their room', () => {
    for (const route of template.robotRoutes) {
      for (const point of route.points)
        expect(roomAt(template, projectFloorPoint(template, point)), route.roomId).toBe(route.roomId)
    }
  })
})

describe('3D scene posters', () => {
  it.each(templateIds)('ships a day and a night poster of %s in both sizes', (templateId) => {
    for (const variant of ['day', 'night']) {
      for (const width of [800, 1600])
        expect(existsSync(new URL(`../public/scene/${templateId}-${variant}-${width}.webp`, import.meta.url)), `${variant} ${width}`).toBe(true)
    }
  })
})
