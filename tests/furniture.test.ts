import { describe, expect, it } from 'vitest'
import { FURNITURE_KINDS } from '~/constants/furniture'
import { createDefaultHomeState, HOME_TEMPLATES } from '~/constants/home'
import { SCENE3D_TEMPLATES } from '~/constants/scene3d'
import type { DevicePlacement, FurnitureEdit, HomeTemplateId } from '~/types'
import { createPlacementAtPoint, MAX_SAVED_LAYOUTS, normalizeHomeState, normalizeSavedLayouts, pointInPolygon, settlePlacements, surfacePointToWorld } from '~/utils/home'
import { addFurnitureInRoom, furnitureFootprint, furnitureProblem, moveFurnitureEdit, nearestFurniturePose, poseOf, removeFurnitureEdit, resolveHomeLayout } from '~/utils/scene3d/layout'
import { planX, planZ, projectFloorPoint, projectPlacement, roomAt, unprojectSurfacePoint } from '~/utils/scene3d/projection'

const templateIds = Object.keys(HOME_TEMPLATES) as HomeTemplateId[]

function piece(templateId: HomeTemplateId, id: string, edits: FurnitureEdit[] = []) {
  const spec = resolveHomeLayout(templateId, edits).furniture.find(item => item.id === id)
  if (!spec)
    throw new Error(`no ${id} in ${templateId}`)
  return spec
}

const warmer = (templateId: HomeTemplateId) => createDefaultHomeState(templateId).placements.find(item => item.deviceId === 'hand-warmer')!

describe('furniture persistence', () => {
  it('migrates version 1 state to version 2 with the template furniture', () => {
    const state = normalizeHomeState({ version: 1, templateId: 'my-home', placements: [], revision: 3, changedAt: '2026-10-01T00:00:00.000Z' })
    expect(state.version).toBe(2)
    expect(state.furniture).toEqual([])
    expect(state.layouts).toEqual([])
    expect(state.revision).toBe(3)
  })

  it('keeps well-formed edits, the last one per piece, and drops the rest', () => {
    const state = normalizeHomeState({
      templateId: 'my-home',
      furniture: [
        { id: 'home-living-sofa', x: -2, z: 0.5, rotation: 0 },
        { id: 'home-living-sofa', x: -2.071, z: 0.785, rotation: 90 },
        { id: 'home-living-rug', removed: true },
        { id: 'added-plant-1', kind: 'plant', roomId: 'home-living', x: 0, z: 0, rotation: 180 },
        { id: 'bad-rotation', x: 0, z: 0, rotation: 45 },
        { id: 'bad-number', x: Number.NaN, z: 0, rotation: 0 },
        { id: 'bad-kind', kind: 'piano', roomId: 'home-living', x: 0, z: 0, rotation: 0 },
        { id: 'bad-room', kind: 'plant', roomId: 'garage', x: 0, z: 0, rotation: 0 },
        { x: 0, z: 0, rotation: 0 },
        'sofa',
      ],
    })
    expect(state.furniture).toEqual([
      { id: 'home-living-sofa', x: -2.07, z: 0.79, rotation: 90 },
      { id: 'home-living-rug', removed: true },
      { id: 'added-plant-1', kind: 'plant', roomId: 'home-living', x: 0, z: 0, rotation: 180 },
    ])
  })

  it('round-trips furniture edits through saved JSON', () => {
    const state = createDefaultHomeState('cloud-apartment')
    state.furniture = moveFurnitureEdit('cloud-apartment', [], 'living-table', { x: -4.73, z: 2.5, rotation: 0 })
    state.furniture = removeFurnitureEdit('cloud-apartment', state.furniture, 'utility-baskets')
    expect(normalizeHomeState(JSON.parse(JSON.stringify(state)))).toEqual(state)
  })

  it('keeps a device on the tabletop of an added table across a reload', () => {
    const state = createDefaultHomeState('my-home')
    const added = addFurnitureInRoom('my-home', [], state.placements, 'coffee-table', 'home-bedroom-b')!
    state.furniture = added.edits
    state.placements = state.placements.map(placement => placement.deviceId === 'hand-warmer'
      ? { ...placement, roomId: 'home-bedroom-b', surfaceId: `${added.id}-top`, u: 0.4, v: 0.6 }
      : placement)
    expect(normalizeHomeState(JSON.parse(JSON.stringify(state)))).toEqual(state)
    // Without the table its tabletop is gone, and so is the spot.
    const orphan = normalizeHomeState({ ...state, furniture: [] })
    expect(orphan.placements.find(placement => placement.deviceId === 'hand-warmer')).toMatchObject({ roomId: null, surfaceId: null })
  })

  it('keeps well-formed saved layouts, at most the limit', () => {
    const good = {
      id: 'layout-a',
      name: '  冬天\n客厅  ',
      templateId: 'studio',
      placements: createDefaultHomeState('studio').placements,
      furniture: [{ id: 'studio-sofa', x: -3.5, z: 1, rotation: 0 }],
      savedAt: '2026-10-18T08:00:00.000Z',
    }
    const layouts = normalizeSavedLayouts([
      good,
      { ...good },
      { ...good, id: 'no-name', name: '   ' },
      { ...good, id: 'bad-template', templateId: 'castle' },
      { ...good, id: 'long', name: '一'.repeat(40), savedAt: 'yesterday' },
      'layout',
    ])
    expect(layouts.map(layout => layout.id)).toEqual(['layout-a', 'long'])
    expect(layouts[0]).toEqual({ ...good, name: '冬天 客厅' })
    expect(layouts[1]!.name).toHaveLength(24)
    expect(layouts[1]!.savedAt).toBe('1970-01-01T00:00:00.000Z')
    const many = Array.from({ length: MAX_SAVED_LAYOUTS + 5 }, (_, index) => ({ ...good, id: `layout-${index}` }))
    expect(normalizeSavedLayouts(many)).toHaveLength(MAX_SAVED_LAYOUTS)
    const state = createDefaultHomeState('my-home')
    state.layouts = layouts
    expect(normalizeHomeState(JSON.parse(JSON.stringify(state))).layouts).toEqual(layouts)
  })

  it('drops the edit when a piece goes back where the template has it', () => {
    const sofa = piece('studio', 'studio-sofa')
    const moved = moveFurnitureEdit('studio', [], sofa.id, { ...poseOf(sofa), x: sofa.x + 0.5 })
    expect(moved).toHaveLength(1)
    expect(moveFurnitureEdit('studio', moved, sofa.id, poseOf(sofa))).toEqual([])
  })

  it('removes added pieces outright and marks template pieces removed', () => {
    const added = addFurnitureInRoom('studio', [], [], 'plant', 'studio-room')!
    expect(removeFurnitureEdit('studio', added.edits, added.id)).toEqual([])
    expect(removeFurnitureEdit('studio', [], 'studio-sofa')).toEqual([{ id: 'studio-sofa', removed: true }])
  })
})

describe('furnished layout', () => {
  it.each(templateIds)('keeps the template layout of %s when nothing changed', (templateId) => {
    const home = resolveHomeLayout(templateId)
    expect(home.template.surfaces).toEqual(HOME_TEMPLATES[templateId].surfaces)
    expect(home.template.robotRoutes).toEqual(HOME_TEMPLATES[templateId].robotRoutes)
    expect(home.tabletops).toEqual(SCENE3D_TEMPLATES[templateId].tabletops)
    expect(home.furniture).toEqual(SCENE3D_TEMPLATES[templateId].furniture)
  })

  it.each(templateIds)('links every tabletop and lamp of %s to the piece that carries it', (templateId) => {
    const { furniture } = SCENE3D_TEMPLATES[templateId]
    const ids = new Set(furniture.map(item => item.id))
    for (const surface of HOME_TEMPLATES[templateId].surfaces.filter(item => item.kind === 'tabletop'))
      expect(furniture.filter(item => item.tabletop === surface.id), surface.id).toHaveLength(1)
    for (const item of furniture.filter(spec => spec.on))
      expect(ids.has(item.on!), item.id).toBe(true)
  })

  it.each(templateIds)('keeps floor devices off the furniture of %s', (templateId) => {
    const { template, furniture } = resolveHomeLayout(templateId)
    for (const spec of furniture.filter(item => FURNITURE_KINDS[item.kind].blocks)) {
      const floor = template.surfaces.find(surface => surface.kind === 'floor' && surface.roomId === spec.roomId)!
      const centre = unprojectSurfacePoint(template, floor, { x: spec.x, y: 0, z: spec.z ?? 0 })
      expect(template.obstacles?.some(obstacle => obstacle.id === spec.id), spec.id).toBe(true)
      if (pointInPolygon(centre, floor.polygon))
        expect(createPlacementAtPoint(template, 'fan', centre, [], 0, floor.id), spec.id).toBeNull()
    }
  })

  it.each(templateIds)('stands the default floor devices of %s clear of the furniture', (templateId) => {
    const { template } = resolveHomeLayout(templateId)
    for (const placement of createDefaultHomeState(templateId).placements) {
      const surface = template.surfaces.find(item => item.id === placement.surfaceId)
      if (surface?.kind !== 'floor')
        continue
      const point = surfacePointToWorld(surface, placement.u, placement.v)
      expect(createPlacementAtPoint(template, placement.deviceId, point, [], 0, surface.id)?.surfaceId, placement.deviceId).toBe(surface.id)
    }
  })

  it('moves the floor obstacle and the robot route with a sofa on a floor plan', () => {
    const sofa = piece('my-home', 'home-living-sofa')
    const edits = moveFurnitureEdit('my-home', [], sofa.id, { ...poseOf(sofa), x: sofa.x + 0.4 })
    const before = resolveHomeLayout('my-home').template
    const after = resolveHomeLayout('my-home', edits)
    const oldSpot = { x: 250, y: 440 }
    const newSpot = { x: 340, y: 440 }
    expect(createPlacementAtPoint(before, 'fan', oldSpot, [], 0, 'home-living-floor')).toBeNull()
    expect(createPlacementAtPoint(after.template, 'fan', oldSpot, [], 0, 'home-living-floor')?.surfaceId).toBe('home-living-floor')
    expect(createPlacementAtPoint(after.template, 'fan', newSpot, [], 0, 'home-living-floor')).toBeNull()

    // Only the living room gets a fresh sweep, clear of its furniture.
    for (const route of after.template.robotRoutes.filter(item => item.roomId !== 'home-living'))
      expect(HOME_TEMPLATES['my-home'].robotRoutes).toContainEqual(route)
    const route = after.template.robotRoutes.find(item => item.roomId === 'home-living')!
    expect(route.points.length).toBeGreaterThan(3)
    expect(route.points).not.toEqual(HOME_TEMPLATES['my-home'].robotRoutes.find(item => item.roomId === 'home-living')!.points)
    const blockers = after.furniture.filter(item => item.roomId === 'home-living' && FURNITURE_KINDS[item.kind].blocks).map(item => furnitureFootprint(item)!)
    for (const point of route.points) {
      const position = projectFloorPoint(after.template, point)
      expect(roomAt(after.template, position)).toBe('home-living')
      expect(blockers.some(bounds => position.x > bounds.x0 && position.x < bounds.x1 && position.z > bounds.z0 && position.z < bounds.z1)).toBe(false)
    }
  })

  it('carries a tabletop and the device on it with its table on a floor plan', () => {
    const table = piece('my-home', 'home-living-table')
    const edits = moveFurnitureEdit('my-home', [], table.id, { ...poseOf(table), z: (table.z ?? 0) - 0.3 })
    const shift = edits[0]!.z! - (table.z ?? 0)
    const before = resolveHomeLayout('my-home')
    const after = resolveHomeLayout('my-home', edits)
    const from = projectPlacement(before.template, warmer('my-home'), before.tabletops)!.position
    const to = projectPlacement(after.template, warmer('my-home'), after.tabletops)!.position
    expect(to.x).toBeCloseTo(from.x)
    expect(to.y).toBeCloseTo(from.y)
    expect(to.z).toBeCloseTo(from.z + shift)
  })

  it('turns a tabletop with its table', () => {
    const table = piece('my-home', 'home-living-table')
    const after = resolveHomeLayout('my-home', moveFurnitureEdit('my-home', [], table.id, { ...poseOf(table), rotation: 0 }))
    const surface = after.template.surfaces.find(item => item.id === 'home-living-table')!
    const original = HOME_TEMPLATES['my-home'].surfaces.find(item => item.id === 'home-living-table')!
    const size = (polygon: typeof surface.polygon) => ({ x: polygon[1].x - polygon[0].x, y: polygon[3].y - polygon[0].y })
    expect(size(surface.polygon).x).toBeCloseTo(size(original.polygon).y)
    expect(size(surface.polygon).y).toBeCloseTo(size(original.polygon).x)
    // The tabletop stays on the table: inside its footprint, in plan centimetres.
    const footprint = furnitureFootprint(after.furniture.find(item => item.id === table.id)!)!
    for (const corner of surface.polygon) {
      expect(planX(corner.x, 1060)).toBeGreaterThanOrEqual(footprint.x0 - 1e-6)
      expect(planX(corner.x, 1060)).toBeLessThanOrEqual(footprint.x1 + 1e-6)
      expect(planZ(corner.y, 723)).toBeGreaterThanOrEqual(footprint.z0 - 1e-6)
      expect(planZ(corner.y, 723)).toBeLessThanOrEqual(footprint.z1 + 1e-6)
    }
  })

  it('carries a tabletop and its device with the table on an elevation', () => {
    const table = piece('cloud-apartment', 'living-table')
    const after = resolveHomeLayout('cloud-apartment', moveFurnitureEdit('cloud-apartment', [], table.id, { ...poseOf(table), x: table.x + 0.4, z: 2.5 }))
    expect(after.tabletops['living-table']).toEqual({ height: 0.44, z0: 2.12, z1: 2.88 })
    const before = resolveHomeLayout('cloud-apartment')
    const from = projectPlacement(before.template, warmer('cloud-apartment'), before.tabletops)!.position
    const to = projectPlacement(after.template, warmer('cloud-apartment'), after.tabletops)!.position
    expect(to.x).toBeCloseTo(from.x + 0.4)
    expect(to.z).toBeCloseTo(from.z + 0.5)
    // Turned a quarter, the tabletop's width and depth swap.
    const turned = resolveHomeLayout('cloud-apartment', moveFurnitureEdit('cloud-apartment', [], table.id, { ...poseOf(table), rotation: 90 }))
    const spec = turned.tabletops['living-table']!
    const surface = turned.template.surfaces.find(item => item.id === 'living-table')!
    expect((surface.polygon[1].x - surface.polygon[0].x) * 0.01).toBeCloseTo(0.76)
    expect(spec.z1! - spec.z0!).toBeCloseTo(2.35)
  })

  it('moves lamps with the piece they stand on and drops them with it', () => {
    const console = piece('cloud-apartment', 'living-media-console')
    const lamp = piece('cloud-apartment', 'living-lamp')
    const moved = resolveHomeLayout('cloud-apartment', moveFurnitureEdit('cloud-apartment', [], console.id, { ...poseOf(console), x: console.x - 0.5 }))
    expect(moved.furniture.find(item => item.id === lamp.id)!.x).toBeCloseTo(lamp.x - 0.5)
    const removed = resolveHomeLayout('cloud-apartment', removeFurnitureEdit('cloud-apartment', [], console.id))
    expect(removed.furniture.some(item => item.id === lamp.id || item.id === console.id)).toBe(false)
  })

  it('takes a tabletop away with its table', () => {
    const home = resolveHomeLayout('my-home', removeFurnitureEdit('my-home', [], 'home-living-table'))
    expect(home.template.surfaces.some(item => item.id === 'home-living-table')).toBe(false)
    expect(home.tabletops['home-living-table']).toBeUndefined()
    expect(home.template.obstacles?.some(item => item.id === 'home-living-table')).toBe(false)
  })

  it('ignores edits that would put a piece outside its room or that name no piece', () => {
    const sofa = piece('my-home', 'home-living-sofa')
    const home = resolveHomeLayout('my-home', [{ id: sofa.id, x: 4, z: 0, rotation: 0 }, { id: 'gone', x: 0, z: 0, rotation: 0 }])
    expect(home.furniture.find(item => item.id === sofa.id)).toEqual(sofa)
    expect(home.furniture).toHaveLength(SCENE3D_TEMPLATES['my-home'].furniture.length)
  })
})

describe('settling devices', () => {
  it('moves a floor device aside when a piece comes back over it', () => {
    // The fan stands where the sofa was before it moved east; resetting brings the sofa back.
    const sofa = piece('my-home', 'home-living-sofa')
    const moved = resolveHomeLayout('my-home', moveFurnitureEdit('my-home', [], sofa.id, { ...poseOf(sofa), x: sofa.x + 0.4 }))
    const fan = createPlacementAtPoint(moved.template, 'fan', { x: 250, y: 440 }, [], 0, 'home-living-floor')!
    const placements = createDefaultHomeState('my-home').placements.map(placement => placement.deviceId === 'fan' ? fan : placement)
    expect(settlePlacements(moved.template, placements)).toEqual(placements)
    const reset = resolveHomeLayout('my-home').template
    const settled = settlePlacements(reset, placements).find(placement => placement.deviceId === 'fan')!
    expect(settled.surfaceId).toBe('home-living-floor')
    expect(settled).not.toEqual(fan)
    expect(createPlacementAtPoint(reset, 'fan', surfacePointToWorld(reset.surfaces.find(item => item.id === 'home-living-floor')!, settled.u, settled.v), [], 0, 'home-living-floor')).not.toBeNull()
  })

  it('takes a device off a tabletop the home no longer has', () => {
    const home = resolveHomeLayout('my-home', removeFurnitureEdit('my-home', [], 'home-living-table'))
    const settled = settlePlacements(home.template, createDefaultHomeState('my-home').placements)
    expect(settled.find(placement => placement.deviceId === 'hand-warmer')).toMatchObject({ roomId: null, surfaceId: null })
    expect(settled.find(placement => placement.deviceId === 'television')?.surfaceId).toBe('home-living-wall')
  })
})

describe('arranging furniture', () => {
  const home = resolveHomeLayout('my-home')
  const placements = createDefaultHomeState('my-home').placements

  it('keeps a piece in its room, off other furniture and off floor devices', () => {
    const sofa = piece('my-home', 'home-living-sofa')
    const table = piece('my-home', 'home-living-table')
    const bed = piece('my-home', 'home-bedroom-a-bed')
    expect(furnitureProblem(home, placements, sofa, { ...poseOf(sofa), x: sofa.x + 0.4 })).toBeNull()
    expect(furnitureProblem(home, placements, sofa, { ...poseOf(sofa), x: sofa.x - 0.5 })).toBe('outside')
    expect(furnitureProblem(home, placements, sofa, { ...poseOf(sofa), x: table.x })).toBe('overlap')
    // The fan stands near bedroom A's west wall.
    expect(furnitureProblem(home, placements, bed, { ...poseOf(bed), x: planX(774, 1060) })).toBe('device')
    expect(furnitureProblem(home, [], bed, { ...poseOf(bed), x: planX(774, 1060) })).toBeNull()
    // Rugs lie under anything.
    const rug = piece('my-home', 'home-living-rug')
    expect(furnitureProblem(home, placements, rug, { ...poseOf(rug), x: rug.x + 0.05 })).toBeNull()
    expect(furnitureProblem(home, placements, piece('my-home', 'home-kitchen-fridge'), poseOf(piece('my-home', 'home-kitchen-fridge')))).toBe('fixed')
  })

  it('finds the nearest free spot for a turned piece, if there is one', () => {
    const table = piece('my-home', 'home-dining-table')
    const pose = nearestFurniturePose(home, placements, table, { ...poseOf(table), rotation: 90 })
    expect(pose).not.toBeNull()
    expect(furnitureProblem(home, placements, table, pose!)).toBeNull()
    // The sofa turned to face north no longer fits between the wall and the coffee table.
    const sofa = piece('my-home', 'home-living-sofa')
    expect(nearestFurniturePose(home, placements, sofa, { ...poseOf(sofa), rotation: 0 })).toBeNull()
  })

  it.each([['my-home', 'home-bedroom-b'], ['comfort-suite', 'suite-bedroom']] as const)('adds a table with a tabletop to %s', (templateId, roomId) => {
    const state = createDefaultHomeState(templateId)
    const added = addFurnitureInRoom(templateId, [], state.placements, 'coffee-table', roomId)!
    expect(added.id).toBe('added-coffee-table-1')
    const furnished = resolveHomeLayout(templateId, added.edits)
    const spec = furnished.furniture.find(item => item.id === added.id)!
    expect(spec.roomId).toBe(roomId)
    expect(furnitureProblem(furnished, state.placements, spec, poseOf(spec))).toBeNull()
    const surface = furnished.template.surfaces.find(item => item.id === `${added.id}-top`)!
    expect(surface.roomId).toBe(roomId)
    const placement = createPlacementAtPoint(furnished.template, 'hand-warmer', surfacePointToWorld(surface, 0.5, 0.5), [], 0, surface.id)
    expect(placement?.surfaceId).toBe(surface.id)
    const projected = projectPlacement(furnished.template, placement as DevicePlacement, furnished.tabletops)!
    expect(projected.position.y).toBeCloseTo(FURNITURE_KINDS['coffee-table'].size.h!)
    expect(roomAt(furnished.template, projected.position)).toBe(roomId)
    // A second one gets its own id.
    expect(addFurnitureInRoom(templateId, added.edits, state.placements, 'coffee-table', roomId)?.id).toBe('added-coffee-table-2')
  })
})
