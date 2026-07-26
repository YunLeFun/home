import { describe, expect, it } from 'vitest'
import { HOME_TEMPLATES, createDefaultHomeState } from '~/constants/home'
import {
  createPlacementAtPoint,
  createPlacementInRoom,
  findSurfaceAtPoint,
  getPointAlongRoute,
  hasHomeRevisionConflict,
  normalizeHomeState,
  placementToWorld,
  surfacePointToWorld,
  worldPointToSurface,
} from '~/utils/home'

describe('virtual home projection', () => {
  const template = HOME_TEMPLATES['cloud-apartment']

  it('projects stable local surface coordinates into world coordinates', () => {
    const surface = template.surfaces.find(item => item.id === 'living-wall')!
    const world = surfacePointToWorld(surface, 0.25, 0.75)
    const local = worldPointToSurface(surface, world)

    expect(local.u).toBeCloseTo(0.25, 5)
    expect(local.v).toBeCloseTo(0.75, 5)
  })

  it('keeps placements independent from viewport scaling', () => {
    const state = createDefaultHomeState('cloud-apartment', '2026-07-15T00:00:00.000Z')
    const placement = state.placements.find(item => item.deviceId === 'air-conditioner')!
    const world = placementToWorld(template, placement)!
    const desktopPercent = world.x / template.width
    const scaledPixel = desktopPercent * 800

    expect(scaledPixel).toBeCloseTo((world.x / 1600) * 800, 5)
  })

  it('only snaps devices to compatible surfaces', () => {
    const wall = findSurfaceAtPoint(template, 'air-conditioner', { x: 200, y: 220 })
    const televisionWall = findSurfaceAtPoint(template, 'television', { x: 440, y: 280 })
    const invalid = findSurfaceAtPoint(template, 'fan', { x: 200, y: 220 })

    expect(wall?.surface.kind).toBe('wall')
    expect(televisionWall?.surface.id).toBe('living-wall')
    expect(invalid).toBeNull()
  })

  it('rejects floor placement inside furniture obstacles', () => {
    const placement = createPlacementAtPoint(template, 'fan', { x: 250, y: 520 }, createDefaultHomeState().placements)
    expect(placement).toBeNull()
  })

  it('moves a device to a compatible surface in another room', () => {
    const state = createDefaultHomeState()
    const placement = createPlacementInRoom(template, 'air-conditioner', 'bedroom', state.placements)

    expect(placement).toMatchObject({
      deviceId: 'air-conditioner',
      roomId: 'bedroom',
      surfaceId: 'bedroom-wall',
    })
  })

  it('interpolates the robot route without persisting animation frames', () => {
    const route = template.robotRoutes[0]?.points ?? []
    expect(route.length).toBeGreaterThan(1)
    expect(getPointAlongRoute(route, 0)).toEqual(route[0])
    expect(getPointAlongRoute(route, 1)).toEqual(route.at(-1))
    expect(getPointAlongRoute(route, 0.5)).not.toEqual(route[0])
  })
})

describe('virtual home persistence', () => {
  it('normalizes corrupted local data and restores all device slots', () => {
    const state = normalizeHomeState({ templateId: 'studio', placements: [{ deviceId: 'fan', u: 7, v: -2 }] })

    expect(state.templateId).toBe('studio')
    expect(state.placements).toHaveLength(5)
    expect(state.placements.find(item => item.deviceId === 'fan')).toMatchObject({ u: 1, v: 0 })
    expect(state.placements.find(item => item.deviceId === 'television')?.surfaceId).toBe('studio-wall')
  })

  it('detects optimistic revision conflicts', () => {
    const remote = createDefaultHomeState()
    remote.revision = 4
    const local = createDefaultHomeState()
    local.revision = 3

    expect(hasHomeRevisionConflict(remote, local)).toBe(true)
    local.revision = 4
    expect(hasHomeRevisionConflict(remote, local)).toBe(false)
  })
})
