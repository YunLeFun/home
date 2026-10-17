import type { FurnitureSpec } from '~/constants/scene3d'
import type { DevicePlacement, FurnitureEdit, FurnitureKind, FurnitureRotation, HomeObstacle, HomePoint, HomeRobotRoute, HomeSurface, HomeTemplate, HomeTemplateId } from '~/types'
import type { FloorBounds, TabletopSpec, Vec3 } from './projection'
import { FURNITURE_KINDS } from '~/constants/furniture'
import { HOME_TEMPLATES } from '~/constants/home'
import { SCENE3D_TEMPLATES } from '~/constants/scene3d'
import { getPolygonBounds, pointInPolygon, surfacePointToWorld } from '~/utils/home'
import { isPlan, PLAN3D, planX, planZ, projectPlacement, projectSurfacePoint, roomBounds, SCENE3D, unprojectSurfacePoint, worldX } from './projection'

/**
 * A home as the user arranged it: the template with their furniture edits
 * applied. The floor obstacles, the tabletop surfaces and the robot routes
 * follow the furniture, so the placement rules and the 3D scene read this
 * rather than the bare template.
 */
export interface ResolvedHome {
  template: HomeTemplate
  furniture: FurnitureSpec[]
  tabletops: Record<string, TabletopSpec>
}

/** Where a piece of furniture stands: the centre of its footprint and its turn. */
export interface FurniturePose {
  x: number
  z: number
  rotation: FurnitureRotation
}

/** Why a piece cannot go somewhere. */
export type FurnitureProblem = 'fixed' | 'outside' | 'overlap' | 'device'

/** Grid furniture snaps to while dragging, in metres. */
export const FURNITURE_SNAP = 0.05
/** How far robot routes keep from furniture, in metres. */
const ROUTE_CLEARANCE = 0.15
/** Distance between the rows of a robot's sweep, in metres. */
const ROUTE_ROW = 0.45
/** How far inside an added piece's edge its tabletop stops, in metres. */
const TOP_INSET = 0.08

const round = (value: number, step = 0.01) => Math.round(value / step) * step
const roundCm = (value: number) => Math.round(value * 100) / 100

/**
 * Turn as a quarter of a full turn.
 *
 * @param rotation - Degrees
 * @returns 0, 90, 180 or 270
 */
export function quarterTurn(rotation: number | undefined): FurnitureRotation {
  return (((Math.round((rotation ?? 0) / 90) % 4) + 4) % 4 * 90) as FurnitureRotation
}

export function poseOf(spec: FurnitureSpec): FurniturePose {
  return { x: spec.x, z: spec.z ?? 0, rotation: quarterTurn(spec.rotation) }
}

/**
 * Whether the user can move, turn and remove a piece.
 *
 * @param spec - The piece
 * @returns True for floor furniture the catalogue lets the user arrange
 */
export function isMovableFurniture(spec: FurnitureSpec) {
  return FURNITURE_KINDS[spec.kind].movable
}

/**
 * The footprint of a floor piece in diorama x and z. Pieces turn in quarter
 * turns, so their footprint stays a rectangle along the axes.
 *
 * @param spec - The piece
 * @param pose - Where it stands; its own pose when unset
 * @returns West, east, north and south edges, or null for pieces off the floor
 */
export function furnitureFootprint(spec: FurnitureSpec, pose: FurniturePose = poseOf(spec)): FloorBounds | null {
  const info = FURNITURE_KINDS[spec.kind]
  if (info.mount !== 'floor')
    return null
  const w = spec.w ?? info.size.w
  const d = spec.d ?? info.size.d
  const across = pose.rotation % 180 === 0
  const hx = (across ? w : d) / 2
  const hz = (across ? d : w) / 2
  return { x0: pose.x - hx, x1: pose.x + hx, z0: pose.z - hz, z1: pose.z + hz }
}

/**
 * Move a point the way a piece moves from one pose to another, turning with it.
 *
 * @param point - Point in diorama x and z
 * @param from - Where the piece stood
 * @param to - Where it stands now
 * @returns The point, carried along
 */
export function carryPoint(point: { x: number, z: number }, from: FurniturePose, to: FurniturePose) {
  const angle = (to.rotation - from.rotation) * Math.PI / 180
  const dx = point.x - from.x
  const dz = point.z - from.z
  // A turn about the vertical, as three.js turns the piece.
  return {
    x: to.x + dx * Math.cos(angle) + dz * Math.sin(angle),
    z: to.z - dx * Math.sin(angle) + dz * Math.cos(angle),
  }
}

function carryBounds(bounds: FloorBounds, from: FurniturePose, to: FurniturePose): FloorBounds {
  const corners = [carryPoint({ x: bounds.x0, z: bounds.z0 }, from, to), carryPoint({ x: bounds.x1, z: bounds.z1 }, from, to)]
  return {
    x0: Math.min(corners[0]!.x, corners[1]!.x),
    x1: Math.max(corners[0]!.x, corners[1]!.x),
    z0: Math.min(corners[0]!.z, corners[1]!.z),
    z1: Math.max(corners[0]!.z, corners[1]!.z),
  }
}

function overlaps(a: FloorBounds, b: FloorBounds, tolerance = 0.01) {
  return a.x0 < b.x1 - tolerance && b.x0 < a.x1 - tolerance && a.z0 < b.z1 - tolerance && b.z0 < a.z1 - tolerance
}

// Sheets ---------------------------------------------------------------------

/** Plan point of a diorama point on a floor plan template, in centimetres. */
function toPlan(template: HomeTemplate, x: number, z: number): HomePoint {
  return { x: roundCm(x / PLAN3D.scale + template.width / 2), y: roundCm(z / PLAN3D.scale + template.height / 2) }
}

/** Elevation sheet x of a diorama x. */
function toElevationX(template: HomeTemplate, x: number) {
  return roundCm(x / SCENE3D.scaleX + template.width / 2)
}

/** Elevation floor sheet y of a diorama depth. */
function toElevationFloorY(z: number) {
  return roundCm(SCENE3D.floorLine + z / SCENE3D.depth * (SCENE3D.floorFront - SCENE3D.floorLine))
}

function rectangle(x0: number, y0: number, x1: number, y1: number): HomeSurface['polygon'] {
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
}

function floorFor(template: HomeTemplate, roomId: string) {
  return template.surfaces.find(surface => surface.kind === 'floor' && surface.roomId === roomId)
    ?? template.surfaces.find(surface => surface.kind === 'floor')
}

/** A footprint on the floor sheet, the way floor placements measure it. */
function footprintOnFloor(template: HomeTemplate, floor: HomeSurface, bounds: FloorBounds): HomePoint[] {
  const corner = (x: number, z: number) => {
    const point = unprojectSurfacePoint(template, floor, { x, y: 0, z })
    return { x: roundCm(point.x), y: roundCm(point.y) }
  }
  return [corner(bounds.x0, bounds.z0), corner(bounds.x1, bounds.z0), corner(bounds.x1, bounds.z1), corner(bounds.x0, bounds.z1)]
}

/** A tabletop's area in diorama x and z. */
function tabletopBounds(template: HomeTemplate, surface: HomeSurface, spec: TabletopSpec): FloorBounds {
  const bounds = getPolygonBounds(surface.polygon)
  if (isPlan(template)) {
    return {
      x0: planX(bounds.minX, template.width),
      x1: planX(bounds.maxX, template.width),
      z0: planZ(bounds.minY, template.height),
      z1: planZ(bounds.maxY, template.height),
    }
  }
  return { x0: worldX(bounds.minX, template.width), x1: worldX(bounds.maxX, template.width), z0: spec.z0 ?? 0.1, z1: spec.z1 ?? 0.6 }
}

/**
 * A tabletop surface over an area of the diorama. Elevations draw tabletops
 * on the shared sheet, their rows spread over the depth range; plans draw
 * them on the floor plan.
 */
function tabletopAt(template: HomeTemplate, surface: HomeSurface, spec: TabletopSpec, bounds: FloorBounds, rows?: [number, number]): { surface: HomeSurface, spec: TabletopSpec } {
  if (isPlan(template)) {
    const a = toPlan(template, bounds.x0, bounds.z0)
    const b = toPlan(template, bounds.x1, bounds.z1)
    return { surface: { ...surface, polygon: rectangle(a.x, a.y, b.x, b.y) }, spec: { height: spec.height } }
  }
  const [y0, y1] = rows ?? [toElevationFloorY(bounds.z0), toElevationFloorY(bounds.z1)]
  return {
    surface: { ...surface, polygon: rectangle(toElevationX(template, bounds.x0), y0, toElevationX(template, bounds.x1), y1) },
    spec: { height: spec.height, z0: roundCm(bounds.z0), z1: roundCm(bounds.z1) },
  }
}

/** Move a template tabletop with the piece that carries it. */
function carryTabletop(template: HomeTemplate, surface: HomeSurface, spec: TabletopSpec, from: FurniturePose, to: FurniturePose) {
  if (from.rotation === to.rotation) {
    // A straight move keeps the tabletop's drawn shape.
    const dx = to.x - from.x
    const dz = to.z - from.z
    if (isPlan(template)) {
      const polygon = surface.polygon.map(point => ({ x: roundCm(point.x + dx / PLAN3D.scale), y: roundCm(point.y + dz / PLAN3D.scale) })) as HomeSurface['polygon']
      return { surface: { ...surface, polygon }, spec }
    }
    const polygon = surface.polygon.map(point => ({ x: roundCm(point.x + dx / SCENE3D.scaleX), y: point.y })) as HomeSurface['polygon']
    return { surface: { ...surface, polygon }, spec: { ...spec, z0: roundCm((spec.z0 ?? 0.1) + dz), z1: roundCm((spec.z1 ?? 0.6) + dz) } }
  }
  const bounds = getPolygonBounds(surface.polygon)
  return tabletopAt(template, surface, spec, carryBounds(tabletopBounds(template, surface, spec), from, to), [bounds.minY, bounds.maxY])
}

// Routes ---------------------------------------------------------------------

/**
 * A robot's sweep over a room's floor: rows across the room, each along its
 * longest stretch clear of furniture, turning back at the end of each row.
 *
 * @param template - Home template, with its obstacles
 * @param roomId - Room to sweep
 * @param furniture - Pieces standing in the way
 * @returns Points on the floor sheet
 */
export function sweepRoute(template: HomeTemplate, roomId: string, furniture: FurnitureSpec[]): HomePoint[] {
  const floor = template.surfaces.find(surface => surface.kind === 'floor' && surface.roomId === roomId)
  if (!floor)
    return []
  const blockers = furniture
    .filter(spec => spec.roomId === roomId && FURNITURE_KINDS[spec.kind].blocks)
    .map(spec => furnitureFootprint(spec))
    .filter((bounds): bounds is FloorBounds => Boolean(bounds))
  const near = projectSurfacePoint(template, floor, 0.5, 0)
  const far = projectSurfacePoint(template, floor, 0.5, 1)
  const depth = Math.hypot(far.x - near.x, far.z - near.z)
  const rows = Math.max(2, Math.round(depth / ROUTE_ROW))
  const samples = 48
  const points: HomePoint[] = []
  for (let row = 0; row < rows; row++) {
    const v = 0.06 + row * 0.88 / (rows - 1)
    const clear = Array.from({ length: samples + 1 }, (_, index) => {
      const position = projectSurfacePoint(template, floor, 0.04 + index * 0.92 / samples, v)
      return !blockers.some(bounds => position.x > bounds.x0 - ROUTE_CLEARANCE && position.x < bounds.x1 + ROUTE_CLEARANCE
        && position.z > bounds.z0 - ROUTE_CLEARANCE && position.z < bounds.z1 + ROUTE_CLEARANCE)
    })
    let best: [number, number] | null = null
    for (let start = 0; start <= samples; start++) {
      if (!clear[start] || (start > 0 && clear[start - 1]))
        continue
      let end = start
      while (end < samples && clear[end + 1])
        end++
      if (!best || end - start > best[1] - best[0])
        best = [start, end]
    }
    if (!best || best[1] - best[0] < 3)
      continue
    const ends = best.map(index => surfacePointToWorld(floor, 0.04 + index * 0.92 / samples, v))
    if (points.length % 4 === 2)
      ends.reverse()
    points.push(...ends.map(point => ({ x: roundCm(point.x), y: roundCm(point.y) })))
  }
  return points
}

// Resolving ------------------------------------------------------------------

function piecesOf(templateId: HomeTemplateId) {
  return SCENE3D_TEMPLATES[templateId].furniture
}

/**
 * A piece added from the catalogue, at the catalogue's size.
 *
 * @param id - Its id
 * @param kind - What it is
 * @param roomId - Room it stands in
 * @param pose - Where it stands
 * @returns Its spec
 */
export function cataloguePiece(id: string, kind: FurnitureKind, roomId: string, pose: FurniturePose): FurnitureSpec {
  const info = FURNITURE_KINDS[kind]
  return {
    id,
    kind,
    roomId,
    x: pose.x,
    z: pose.z,
    rotation: pose.rotation,
    w: info.size.w,
    d: info.size.d,
    h: info.size.h,
    light: info.light,
  }
}

function insideRoom(template: HomeTemplate, roomId: string, bounds: FloorBounds) {
  if (!isPlan(template)) {
    const room = roomBounds(template, roomId)
    return bounds.x0 >= room.x0 - 0.01 && bounds.x1 <= room.x1 + 0.01 && bounds.z0 >= -0.01 && bounds.z1 <= SCENE3D.depth + 0.01
  }
  const room = template.rooms.find(item => item.id === roomId)
  if (!room)
    return false
  const outline = SCENE3D_TEMPLATES[template.id].plan?.outlines?.[roomId]
    ?? rectangle(room.x, room.y, room.x + room.width, room.y + room.height)
  // A centimetre in from each edge, so a piece may stand against the wall.
  const inset = 0.01
  const corners = [
    toPlan(template, bounds.x0 + inset, bounds.z0 + inset),
    toPlan(template, bounds.x1 - inset, bounds.z0 + inset),
    toPlan(template, bounds.x1 - inset, bounds.z1 - inset),
    toPlan(template, bounds.x0 + inset, bounds.z1 - inset),
    toPlan(template, (bounds.x0 + bounds.x1) / 2, (bounds.z0 + bounds.z1) / 2),
  ]
  return corners.every(point => pointInPolygon(point, outline))
}

/**
 * Apply the user's furniture edits to a template.
 *
 * Edits for pieces the template no longer has, or poses outside a piece's
 * room, are ignored. Lamps follow the piece they stand on, and tabletops the
 * piece that carries them; both go when it goes. Floor obstacles are the
 * footprints of the furniture; a room's robot route is the template's own
 * until its furniture changes, and a fresh sweep after.
 *
 * @param templateId - Template to arrange
 * @param edits - The user's changes to its furniture
 * @returns The arranged home
 */
export function resolveHomeLayout(templateId: HomeTemplateId, edits: readonly FurnitureEdit[] = []): ResolvedHome {
  const base = HOME_TEMPLATES[templateId]
  const scene = SCENE3D_TEMPLATES[templateId]
  const byId = new Map(edits.map(edit => [edit.id, edit]))
  const changedRooms = new Set<string>()
  const moves = new Map<string, { from: FurniturePose, to: FurniturePose }>()
  const removed = new Set<string>()

  for (const spec of piecesOf(templateId)) {
    const edit = byId.get(spec.id)
    if (!edit || edit.kind || !isMovableFurniture(spec))
      continue
    if (edit.removed) {
      removed.add(spec.id)
      changedRooms.add(spec.roomId)
      continue
    }
    const to = { x: edit.x ?? spec.x, z: edit.z ?? spec.z ?? 0, rotation: quarterTurn(edit.rotation) }
    const footprint = furnitureFootprint(spec, to)
    if (footprint && !insideRoom(base, spec.roomId, footprint))
      continue
    moves.set(spec.id, { from: poseOf(spec), to })
    changedRooms.add(spec.roomId)
  }

  const furniture: FurnitureSpec[] = []
  for (const spec of piecesOf(templateId)) {
    const owner = spec.on ?? spec.id
    if (removed.has(owner))
      continue
    const move = moves.get(owner)
    if (!move) {
      furniture.push(spec)
      continue
    }
    const at = carryPoint({ x: spec.x, z: spec.z ?? 0 }, move.from, move.to)
    furniture.push({ ...spec, x: roundCm(at.x), z: roundCm(at.z), rotation: quarterTurn((spec.rotation ?? 0) + move.to.rotation - move.from.rotation) })
  }
  const known = new Set(piecesOf(templateId).map(spec => spec.id))
  for (const edit of edits) {
    if (!edit.kind || !edit.roomId || known.has(edit.id) || !FURNITURE_KINDS[edit.kind].movable || !base.rooms.some(room => room.id === edit.roomId))
      continue
    const spec = cataloguePiece(edit.id, edit.kind, edit.roomId, { x: edit.x ?? 0, z: edit.z ?? 0, rotation: quarterTurn(edit.rotation) })
    const footprint = furnitureFootprint(spec)
    if (footprint && !insideRoom(base, spec.roomId, footprint))
      continue
    furniture.push(spec)
    changedRooms.add(spec.roomId)
  }

  // Tabletops ride on the piece that carries them.
  const carriers = new Map(piecesOf(templateId).filter(spec => spec.tabletop).map(spec => [spec.tabletop!, spec]))
  const surfaces: HomeSurface[] = []
  const tabletops: Record<string, TabletopSpec> = {}
  for (const surface of base.surfaces) {
    const spec = scene.tabletops[surface.id]
    const carrier = surface.kind === 'tabletop' ? carriers.get(surface.id) : undefined
    if (!spec || !carrier) {
      surfaces.push(surface)
      if (spec)
        tabletops[surface.id] = spec
      continue
    }
    if (removed.has(carrier.id))
      continue
    const move = moves.get(carrier.id)
    const top = move ? carryTabletop(base, surface, spec, move.from, move.to) : { surface, spec }
    surfaces.push(top.surface)
    tabletops[surface.id] = top.spec
  }
  for (const spec of furniture) {
    const info = FURNITURE_KINDS[spec.kind]
    const footprint = furnitureFootprint(spec)
    if (!info.top || known.has(spec.id) || !footprint)
      continue
    const inset = (from: number, to: number) => {
      const amount = Math.min(TOP_INSET, (to - from) / 2 - 0.05)
      return [from + amount, to - amount] as const
    }
    const [x0, x1] = inset(footprint.x0, footprint.x1)
    const [z0, z1] = inset(footprint.z0, footprint.z1)
    const surface: HomeSurface = {
      id: `${spec.id}-top`,
      roomId: spec.roomId,
      name: `${info.name}桌面`,
      kind: 'tabletop',
      polygon: rectangle(0, 0, 1, 1),
      accepts: ['hand-warmer'],
    }
    const top = tabletopAt(base, surface, { height: spec.h ?? info.size.h ?? 0.5 }, { x0, x1, z0, z1 })
    surfaces.push(top.surface)
    tabletops[surface.id] = top.spec
  }

  const template: HomeTemplate = { ...base, surfaces }
  const obstacles: HomeObstacle[] = []
  for (const spec of furniture) {
    const footprint = FURNITURE_KINDS[spec.kind].blocks ? furnitureFootprint(spec) : null
    const floor = footprint && floorFor(template, spec.roomId)
    if (footprint && floor)
      obstacles.push({ id: spec.id, roomId: spec.roomId, polygon: footprintOnFloor(template, floor, footprint) })
  }
  template.obstacles = obstacles
  const robotRoutes: HomeRobotRoute[] = base.robotRoutes.filter(route => !changedRooms.has(route.roomId))
  for (const roomId of changedRooms) {
    const points = sweepRoute(template, roomId, furniture)
    if (points.length > 1)
      robotRoutes.push({ roomId, points })
  }
  template.robotRoutes = robotRoutes
  return { template, furniture, tabletops }
}

// Arranging ------------------------------------------------------------------

/**
 * Check whether a piece can stand somewhere: inside its room, clear of the
 * other floor furniture and of floor devices. Rugs lie under anything.
 *
 * @param home - The arranged home
 * @param placements - Device placements
 * @param spec - Piece to move, or a new one to add
 * @param pose - Where it would stand
 * @returns Why it cannot, or null when it can
 */
export function furnitureProblem(home: ResolvedHome, placements: readonly DevicePlacement[], spec: FurnitureSpec, pose: FurniturePose): FurnitureProblem | null {
  const id = spec.id
  const footprint = isMovableFurniture(spec) ? furnitureFootprint(spec, pose) : null
  if (!footprint)
    return 'fixed'
  if (!insideRoom(home.template, spec.roomId, footprint))
    return 'outside'
  if (spec.kind !== 'rug') {
    for (const other of home.furniture) {
      if (other.id === id || other.kind === 'rug' || other.roomId !== spec.roomId)
        continue
      const bounds = furnitureFootprint(other)
      if (bounds && overlaps(footprint, bounds))
        return 'overlap'
    }
  }
  if (FURNITURE_KINDS[spec.kind].blocks) {
    for (const placement of placements) {
      const projected = placement.roomId === spec.roomId ? projectPlacement(home.template, placement, home.tabletops) : null
      if (projected?.surfaceKind === 'floor' && inside(projected.position, footprint))
        return 'device'
    }
  }
  return null
}

function inside(position: Vec3, bounds: FloorBounds) {
  return position.x > bounds.x0 && position.x < bounds.x1 && position.z > bounds.z0 && position.z < bounds.z1
}

/**
 * The closest spot to a target where a piece can stand.
 *
 * @param home - The arranged home
 * @param placements - Device placements
 * @param spec - Piece to place
 * @param target - Where it should ideally stand
 * @param reach - How far from the target to look, in metres
 * @returns A pose at the target's turn, or null when there is none within reach
 */
export function nearestFurniturePose(home: ResolvedHome, placements: readonly DevicePlacement[], spec: FurnitureSpec, target: FurniturePose, reach = 0.6): FurniturePose | null {
  const step = FURNITURE_SNAP * 2
  const rings = Math.ceil(reach / step)
  const candidates: FurniturePose[] = []
  for (let i = -rings; i <= rings; i++) {
    for (let j = -rings; j <= rings; j++) {
      if (Math.hypot(i, j) * step <= reach + 1e-6)
        candidates.push({ x: roundCm(target.x + i * step), z: roundCm(target.z + j * step), rotation: target.rotation })
    }
  }
  candidates.sort((a, b) => Math.hypot(a.x - target.x, a.z - target.z) - Math.hypot(b.x - target.x, b.z - target.z))
  return candidates.find(pose => !furnitureProblem(home, placements, spec, pose)) ?? null
}

/**
 * A piece and the lamps it carries, moved to a new pose.
 *
 * @param home - The arranged home
 * @param id - The piece
 * @param pose - Where it would stand
 * @returns The piece and its followers at their new spots
 */
export function piecesMovedTo(home: ResolvedHome, id: string, pose: FurniturePose): FurnitureSpec[] {
  const spec = home.furniture.find(item => item.id === id)
  if (!spec)
    return []
  const from = poseOf(spec)
  return home.furniture.filter(item => item.id === id || item.on === id).map((item) => {
    const at = carryPoint({ x: item.x, z: item.z ?? 0 }, from, pose)
    return { ...item, x: at.x, z: at.z, rotation: quarterTurn((item.rotation ?? 0) + pose.rotation - from.rotation) }
  })
}

/**
 * Snap a dragged position to the furniture grid.
 *
 * @param value - Metres
 * @returns The nearest grid line
 */
export function snapFurniture(value: number) {
  return roundCm(round(value, FURNITURE_SNAP))
}

function isTemplatePiece(templateId: HomeTemplateId, id: string) {
  return piecesOf(templateId).some(spec => spec.id === id)
}

/**
 * Record a piece moved or turned.
 *
 * @param templateId - Template the edits belong to
 * @param edits - Current edits
 * @param id - The piece
 * @param pose - Where it now stands
 * @returns The new edits
 */
export function moveFurnitureEdit(templateId: HomeTemplateId, edits: readonly FurnitureEdit[], id: string, pose: FurniturePose): FurnitureEdit[] {
  const at = { x: roundCm(pose.x), z: roundCm(pose.z), rotation: pose.rotation }
  const rest = edits.filter(edit => edit.id !== id)
  const current = edits.find(edit => edit.id === id)
  if (current?.kind)
    return [...rest, { ...current, ...at }]
  const spec = piecesOf(templateId).find(item => item.id === id)
  if (!spec)
    return [...edits]
  const home = poseOf(spec)
  // Back where the template put it: no edit needed.
  if (home.x === at.x && home.z === at.z && home.rotation === at.rotation)
    return rest
  return [...rest, { id, ...at }]
}

/**
 * Record a piece taken out of the home.
 *
 * @param templateId - Template the edits belong to
 * @param edits - Current edits
 * @param id - The piece
 * @returns The new edits
 */
export function removeFurnitureEdit(templateId: HomeTemplateId, edits: readonly FurnitureEdit[], id: string): FurnitureEdit[] {
  const rest = edits.filter(edit => edit.id !== id)
  return isTemplatePiece(templateId, id) ? [...rest, { id, removed: true }] : rest
}

/**
 * Record a piece added from the catalogue.
 *
 * @param edits - Current edits
 * @param kind - What to add
 * @param roomId - Room it stands in
 * @param pose - Where it stands
 * @returns The new edits and the new piece's id
 */
export function addFurnitureEdit(edits: readonly FurnitureEdit[], kind: FurnitureKind, roomId: string, pose: FurniturePose) {
  const prefix = `added-${kind}-`
  const taken = edits.filter(edit => edit.id.startsWith(prefix)).map(edit => Number(edit.id.slice(prefix.length)) || 0)
  const id = `${prefix}${Math.max(0, ...taken) + 1}`
  return { id, edits: [...edits, { id, kind, roomId, x: roundCm(pose.x), z: roundCm(pose.z), rotation: pose.rotation }] }
}

/**
 * A free spot in a room for a new piece, as near its middle as there is.
 *
 * @param templateId - Template to arrange
 * @param edits - Current edits
 * @param placements - Device placements
 * @param kind - What to add
 * @param roomId - Room it should stand in
 * @returns The edits with the piece added and its id, or null when the room is full
 */
export function addFurnitureInRoom(templateId: HomeTemplateId, edits: readonly FurnitureEdit[], placements: readonly DevicePlacement[], kind: FurnitureKind, roomId: string) {
  const home = resolveHomeLayout(templateId, edits)
  const room = roomBounds(home.template, roomId)
  const middle = { x: snapFurniture((room.x0 + room.x1) / 2), z: snapFurniture(isPlan(home.template) ? (room.z0 + room.z1) / 2 : SCENE3D.depth * 0.45) }
  const reach = Math.hypot(room.x1 - room.x0, room.z1 - room.z0) / 2
  const { id } = addFurnitureEdit(edits, kind, roomId, { ...middle, rotation: 0 })
  for (const rotation of [0, 90] as const) {
    const target = { ...middle, rotation }
    const pose = nearestFurniturePose(home, placements, cataloguePiece(id, kind, roomId, target), target, reach)
    if (pose)
      return addFurnitureEdit(edits, kind, roomId, pose)
  }
  return null
}
