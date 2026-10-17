import * as THREE from 'three'
import type { ScenePhase } from '~/composables/scene-time'
import type { FurnitureSpec, PlanShell, PlanWall } from '~/constants/scene3d'
import type { DeviceKind, DevicePlacement, HomePoint, HomeSurface, HomeSurfaceKind, HomeTemplate, SurfaceTarget } from '~/types'
import type { DeviceModel, DeviceVisual } from './devices'
import type { PhaseTargets, SceneLamp } from './furniture'
import type { FurniturePose, FurnitureProblem, ResolvedHome } from './layout'
import type { FloorBounds, Ray3, TabletopSpec, Vec3 } from './projection'
import { SCENE3D_TEMPLATES } from '~/constants/scene3d'
import { createPlacementAtPoint, getPointAlongRoute, getRobotRoute } from '~/utils/home'
import { buildDevice, buildRobotDock } from './devices'
import { buildFurniture } from './furniture'
import { EDIT_COLORS, Kit, PALETTE, TONE_COLORS } from './kit'
import { carryPoint, furnitureFootprint, furnitureProblem, isMovableFurniture, piecesMovedTo, poseOf, snapFurniture } from './layout'
import { findSurfaceAlongRay, intersectSurfacePlane, isPlan, PLAN3D, planX, planZ, projectFloorPoint, projectPlacement, roomAt, roomBounds, SCENE3D, surfaceCorners, surfaceFrame, worldX } from './projection'

/** A device hotspot projected to canvas pixels. */
export interface ScreenAnchor {
  id: DeviceKind
  x: number
  y: number
  visible: boolean
}

export interface HomeScene3DOptions {
  canvas: HTMLCanvasElement
  reducedMotion: boolean
  mobile: boolean
  onProject?: (anchors: ScreenAnchor[]) => void
}

interface PhaseLighting {
  hemiSky: string
  hemiGround: string
  hemi: number
  sun: string
  sunIntensity: number
  sky: string
  cloud: string
  beam: number
  lamp: number
}

const PHASE_LIGHTING: Record<ScenePhase, PhaseLighting> = {
  dawn: { hemiSky: '#ffe9dc', hemiGround: '#d9bea6', hemi: 1.15, sun: '#ffd2b4', sunIntensity: 1.9, sky: '#f7b9a6', cloud: '#fff1e6', beam: 0.3, lamp: 0.4 },
  day: { hemiSky: '#f1f6ff', hemiGround: '#e6d2b3', hemi: 1.35, sun: '#fff3dc', sunIntensity: 2.5, sky: '#9fcbf3', cloud: '#ffffff', beam: 0.34, lamp: 0 },
  dusk: { hemiSky: '#ffd9bb', hemiGround: '#c49e86', hemi: 1, sun: '#ffb27a', sunIntensity: 1.7, sky: '#f39a7f', cloud: '#ffe6d3', beam: 0.3, lamp: 0.75 },
  night: { hemiSky: '#8299cc', hemiGround: '#3b3a55', hemi: 0.62, sun: '#a9c2ff', sunIntensity: 0.5, sky: '#162a4a', cloud: '#3b5277', beam: 0.05, lamp: 1 },
}

const CAMERA_DURATION = 760
const PHASE_DURATION = 1400
const FOV = 28
/** Camera elevation; phones look down more steeply to fill a squarer frame. */
const BASE_PITCH = 0.34
const MOBILE_PITCH = 0.52
/** Floor plans are seen from higher up, and a little from the west so east walls face the camera. */
const PLAN_PITCH = 0.92
const PLAN_MOBILE_PITCH = 1.02
const PLAN_YAW = -0.28

interface CameraPose {
  x: number
  y: number
  z: number
  distance: number
  shift: number
}

/** A device being dragged to a new spot. */
interface DeviceDrag {
  deviceId: DeviceKind
  /** Where the pointer meets the surface, in plan coordinates. */
  point: HomePoint | null
  /** The placement a drop would make, or null when the spot is not allowed. */
  placement: DevicePlacement | null
  /** Where the pointer meets the surface, in diorama space. */
  position: Vec3 | null
  surfaceKind: HomeSurfaceKind | null
  /** Out of the surface under the pointer. */
  normal: Vec3 | null
}

/** A piece of furniture being dragged to a new spot. */
interface FurnitureDrag {
  id: string
  /** From the pointer's spot on the floor to the centre of the piece. */
  grab: { x: number, z: number }
  pose: FurniturePose | null
  problem: FurnitureProblem | null
}

interface SurfaceOverlay {
  surface: HomeSurface
  object: THREE.Group
  fill: THREE.MeshBasicMaterial
  edge: THREE.MeshBasicMaterial
}

interface DeviceEntry {
  model: DeviceModel
  holder: THREE.Group
  scale: number
  lift: number
  heading: number
}

function isShown(object: THREE.Object3D) {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    if (!node.visible)
      return false
  }
  return true
}

function easeOutQuart(progress: number) {
  return 1 - (1 - progress) ** 4
}

function approach(current: number, target: number, dt: number, rate: number) {
  return current + (target - current) * (1 - Math.exp(-dt * rate))
}

function plankTexture(kit: Kit) {
  const texture = kit.canvasTexture(512, 64, (context) => {
    const planks = 8
    const width = 512 / planks
    for (let index = 0; index < planks; index++) {
      const shade = [0, 6, -4, 3, -7, 5, -2, 4][index]!
      context.fillStyle = `hsl(34 ${54 + shade / 2}% ${72 + shade / 3}%)`
      context.fillRect(index * width, 0, width, 64)
      context.fillStyle = 'rgba(122, 78, 34, 0.18)'
      context.fillRect(index * width, 0, 2, 64)
      // A soft grain stroke on each plank.
      context.fillStyle = 'rgba(122, 78, 34, 0.06)'
      context.fillRect(index * width + width * 0.35, 0, 3, 64)
    }
  })
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

/** Floor tile colours of the wet rooms, by room accent: tile and grout. */
const TILE_COLORS = {
  warm: ['#f3ede4', '#e2d8ca'],
  sky: ['#e6f0f9', '#cbdcec'],
  clay: ['#f5e4d2', '#e3cbb2'],
} as const

function tileTexture(kit: Kit, [tile, grout]: readonly [string, string]) {
  const texture = kit.canvasTexture(128, 128, (context) => {
    context.fillStyle = grout
    context.fillRect(0, 0, 128, 128)
    context.fillStyle = tile
    for (const x of [0, 64]) {
      for (const y of [0, 64])
        context.fillRect(x + 2, y + 2, 60, 60)
    }
  })
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

function fadeTexture(kit: Kit, inner: string, outer: string, radial: boolean) {
  return kit.canvasTexture(128, 128, (context) => {
    const gradient = radial
      ? context.createRadialGradient(64, 64, 0, 64, 64, 64)
      : context.createLinearGradient(0, 0, 0, 128)
    gradient.addColorStop(0, inner)
    gradient.addColorStop(1, outer)
    context.fillStyle = gradient
    context.fillRect(0, 0, 128, 128)
  })
}

/**
 * The 3D diorama of the home: a cut-away dollhouse built from the template,
 * lit by the time of day, with animated devices. It renders on demand and
 * pauses while nothing moves.
 */
export class HomeScene3D {
  readonly renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(FOV, 2, 0.5, 80)
  private hemi = new THREE.HemisphereLight('#ffffff', '#e6d2b3', 1.3)
  private sun = new THREE.DirectionalLight('#fff3dc', 2.5)
  private templateRoot = new THREE.Group()
  private deviceRoot = new THREE.Group()
  private templateKit = new Kit()
  private furnitureRoot = new THREE.Group()
  private furnitureKit = new Kit()
  private furnitureObjects = new Map<string, THREE.Object3D>()
  private overlayKit = new Kit()
  private deviceKit = new Kit()
  private phaseTargets: PhaseTargets
  private lamps: SceneLamp[] = []
  private ticks: Array<(time: number) => void> = []
  private devices = new Map<DeviceKind, DeviceEntry>()
  private dock: THREE.Object3D
  private route: THREE.Line | null = null
  private raycaster = new THREE.Raycaster()
  /** Placement overlay; kept out of picking. */
  private editRoot = new THREE.Group()
  private surfaceOverlays: SurfaceOverlay[] = []
  private marker: THREE.Group
  private markerMaterials: THREE.MeshBasicMaterial[]
  private editing = false
  private drag: DeviceDrag | null = null
  private furnitureDrag: FurnitureDrag | null = null
  private selectedFurniture: string | null = null
  /** Footprint of the selected or dragged piece. */
  private footprint: THREE.Group
  private footprintMaterials: THREE.MeshBasicMaterial[]
  private options: HomeScene3DOptions

  private home: ResolvedHome | null = null
  private template: HomeTemplate | null = null
  private placements: DevicePlacement[] = []
  private focusRoomId: string | null = null
  private overview = true
  private selected: DeviceKind | null = null
  private hovered: DeviceKind | null = null
  private insetRight = 0
  private robot = { cleaning: false, progress: 0, at: 0 }

  private pose: CameraPose = { x: 0, y: 1.3, z: 1.8, distance: 20, shift: 0 }
  private poseFrom: CameraPose = { ...this.pose }
  private poseTo: CameraPose = { ...this.pose }
  private poseStartedAt = -Infinity
  private orbit = { yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0 }
  /** The user's pan, in world x and z, and zoom, as a factor on the framed distance. */
  private view = { x: 0, z: 0, zoom: 1, targetX: 0, targetZ: 0, targetZoom: 1 }

  private phase: ScenePhase = 'day'
  private phaseFrom = this.snapshotLighting(PHASE_LIGHTING.day)
  private phaseTo = this.snapshotLighting(PHASE_LIGHTING.day)
  private phaseStartedAt = -Infinity

  private width = 1
  private height = 1
  private frame = 0
  private last = 0
  private lastRender = 0
  private paused = false
  private disposed = false

  constructor(options: HomeScene3DOptions) {
    this.options = options
    this.renderer = new THREE.WebGLRenderer({ canvas: options.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.mobile ? 1.75 : 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.NeutralToneMapping
    this.renderer.toneMappingExposure = 1.02
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.sun.position.set(-6, 10, 9)
    this.sun.target.position.set(0, 0, 1.6)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(options.mobile ? 1024 : 2048, options.mobile ? 1024 : 2048)
    Object.assign(this.sun.shadow.camera, { left: -10, right: 10, top: 7, bottom: -6, near: 1, far: 40 })
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.025
    this.scene.add(this.hemi, this.sun, this.sun.target, this.templateRoot, this.furnitureRoot, this.deviceRoot, this.editRoot)
    this.editRoot.visible = false

    const beam = new THREE.MeshBasicMaterial({
      color: '#fff6dc',
      alphaMap: fadeTexture(this.deviceKit, '#ffffff', '#000000', false),
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    this.phaseTargets = {
      sky: this.deviceKit.track(new THREE.MeshBasicMaterial({ color: '#9fcbf3' })),
      cloud: this.deviceKit.track(new THREE.MeshBasicMaterial({ color: '#ffffff' })),
      beams: [this.deviceKit.track(beam)],
    }
    this.dock = buildRobotDock(this.deviceKit)
    this.dock.visible = false
    this.deviceRoot.add(this.dock)
    this.markerMaterials = [0.9, 0.2].map(opacity => this.deviceKit.track(new THREE.MeshBasicMaterial({ color: EDIT_COLORS.surface, transparent: true, opacity, depthTest: false, depthWrite: false, side: THREE.DoubleSide })))
    this.marker = new THREE.Group()
    this.marker.add(
      new THREE.Mesh(this.deviceKit.custom('marker-ring', () => new THREE.RingGeometry(0.22, 0.28, 48)), this.markerMaterials[0]!),
      new THREE.Mesh(this.deviceKit.custom('marker-disc', () => new THREE.CircleGeometry(0.22, 48)), this.markerMaterials[1]!),
    )
    this.marker.traverse((child) => {
      child.renderOrder = 10
    })
    this.marker.visible = false
    this.editRoot.add(this.marker)
    this.footprintMaterials = [0.16, 0.85].map(opacity => this.deviceKit.track(new THREE.MeshBasicMaterial({ color: EDIT_COLORS.surface, transparent: true, opacity, depthTest: false, depthWrite: false, side: THREE.DoubleSide })))
    this.footprint = new THREE.Group()
    this.footprint.visible = false
    this.footprint.renderOrder = 9
    this.editRoot.add(this.footprint)
    this.applyLighting(this.phaseTo)
  }

  // Lighting -----------------------------------------------------------------

  private snapshotLighting(lighting: PhaseLighting) {
    return {
      hemiSky: new THREE.Color(lighting.hemiSky),
      hemiGround: new THREE.Color(lighting.hemiGround),
      hemi: lighting.hemi,
      sun: new THREE.Color(lighting.sun),
      sunIntensity: lighting.sunIntensity,
      sky: new THREE.Color(lighting.sky),
      cloud: new THREE.Color(lighting.cloud),
      beam: lighting.beam,
      lamp: lighting.lamp,
    }
  }

  private current = this.snapshotLighting(PHASE_LIGHTING.day)

  private applyLighting(lighting: ReturnType<HomeScene3D['snapshotLighting']>) {
    this.hemi.color.copy(lighting.hemiSky)
    this.hemi.groundColor.copy(lighting.hemiGround)
    this.hemi.intensity = lighting.hemi
    this.sun.color.copy(lighting.sun)
    this.sun.intensity = lighting.sunIntensity
    this.phaseTargets.sky.color.copy(lighting.sky)
    this.phaseTargets.cloud.color.copy(lighting.cloud)
    for (const beam of this.phaseTargets.beams)
      beam.opacity = lighting.beam
    for (const lamp of this.lamps) {
      lamp.light.intensity = lamp.intensity * lighting.lamp
      lamp.shade.emissiveIntensity = lighting.lamp * 0.9
    }
    this.current = lighting
  }

  /** Re-light the diorama for a time of day. */
  setPhase(phase: ScenePhase, immediate = false) {
    if (phase === this.phase && !immediate)
      return
    this.phase = phase
    this.phaseFrom = {
      ...this.current,
      hemiSky: this.current.hemiSky.clone(),
      hemiGround: this.current.hemiGround.clone(),
      sun: this.current.sun.clone(),
      sky: this.current.sky.clone(),
      cloud: this.current.cloud.clone(),
    }
    this.phaseTo = this.snapshotLighting(PHASE_LIGHTING[phase])
    if (immediate || this.options.reducedMotion) {
      this.applyLighting(this.phaseTo)
      this.phaseStartedAt = -Infinity
    }
    else {
      this.phaseStartedAt = performance.now()
    }
    this.invalidate()
  }

  private stepPhase(now: number) {
    if (!Number.isFinite(this.phaseStartedAt))
      return false
    const progress = Math.min(1, (now - this.phaseStartedAt) / PHASE_DURATION)
    const t = easeOutQuart(progress)
    const from = this.phaseFrom
    const to = this.phaseTo
    const mix = (a: number, b: number) => a + (b - a) * t
    this.applyLighting({
      hemiSky: from.hemiSky.clone().lerp(to.hemiSky, t),
      hemiGround: from.hemiGround.clone().lerp(to.hemiGround, t),
      hemi: mix(from.hemi, to.hemi),
      sun: from.sun.clone().lerp(to.sun, t),
      sunIntensity: mix(from.sunIntensity, to.sunIntensity),
      sky: from.sky.clone().lerp(to.sky, t),
      cloud: from.cloud.clone().lerp(to.cloud, t),
      beam: mix(from.beam, to.beam),
      lamp: mix(from.lamp, to.lamp),
    })
    if (progress >= 1)
      this.phaseStartedAt = -Infinity
    return progress < 1
  }

  // Template -----------------------------------------------------------------

  private get tabletops(): Record<string, TabletopSpec> {
    return this.home?.tabletops ?? {}
  }

  /**
   * Show a home: build its rooms when the template changes, and its
   * furniture, tabletops and routes whenever the user rearranges it.
   */
  setHome(home: ResolvedHome) {
    const previous = this.home
    if (previous === home)
      return
    this.home = home
    this.template = home.template
    const template = home.template
    if (previous?.template.id !== template.id) {
      this.drag = null
      this.templateRoot.clear()
      this.templateKit.dispose()
      this.templateKit = new Kit()
      const spec = SCENE3D_TEMPLATES[template.id]
      if (spec.plan)
        this.buildPlanShell(template, spec.plan)
      else
        this.buildShell(template)
      this.sun.target.position.set(0, 0, isPlan(template) ? 0 : 1.6)
    }
    if (previous?.furniture !== home.furniture)
      this.buildFurniture(template, home.furniture)
    this.furnitureDrag = null
    if (this.selectedFurniture && !home.furniture.some(item => item.id === this.selectedFurniture))
      this.selectedFurniture = null
    this.showFootprint()
    this.buildSurfaceOverlays(template)
    this.updateRoute()
    this.setPlacements(this.placements)
    if (previous?.template.id !== template.id)
      this.reframe(true)
  }

  private buildFurniture(template: HomeTemplate, furniture: FurnitureSpec[]) {
    this.furnitureRoot.clear()
    this.furnitureKit.dispose()
    this.furnitureKit = new Kit()
    this.furnitureObjects.clear()
    this.lamps = []
    this.ticks = []
    const ceiling = isPlan(template) ? PLAN3D.height : SCENE3D.height
    const movable = new Set(furniture.filter(isMovableFurniture).map(item => item.id))
    for (const item of furniture) {
      const built = buildFurniture(this.furnitureKit, item, this.phaseTargets, ceiling)
      built.object.position.set(item.x, item.y ?? 0, item.z ?? 0)
      built.object.rotation.y = THREE.MathUtils.degToRad(item.rotation ?? 0)
      built.object.userData.roomId = item.roomId
      // A lamp on a console picks the console.
      const owner = item.on ?? item.id
      if (movable.has(owner))
        built.object.userData.furnitureId = owner
      built.object.userData.flat = item.kind === 'rug'
      this.furnitureRoot.add(built.object)
      this.furnitureObjects.set(item.id, built.object)
      if (built.lamp)
        this.lamps.push(built.lamp)
      if (built.tick)
        this.ticks.push(built.tick)
    }
    for (const tick of this.ticks)
      tick(0)
    this.applyLighting(this.current)
  }

  private buildShell(template: HomeTemplate) {
    const kit = this.templateKit
    const accents = SCENE3D_TEMPLATES[template.id].rooms
    const { depth, height } = SCENE3D
    const left = worldX(18, template.width)
    const right = worldX(template.width - 18, template.width)
    const wall = 0.16
    const trim = kit.material(PALETTE.trim, { roughness: 0.6 })
    const accentColor = { warm: PALETTE.wallWarm, sky: PALETTE.wallSky, clay: PALETTE.wallClay }

    // A rounded plinth so the home reads as a model on the table.
    const plinthWidth = right - left + wall * 2 + 0.5
    this.templateRoot.add(kit.mesh(kit.roundedBox(plinthWidth, 0.34, depth + 0.7, 0.14), kit.material(PALETTE.plinth, { roughness: 0.7 }), 0, -0.33, depth / 2 - 0.05))
    this.templateRoot.add(kit.mesh(kit.roundedBox(plinthWidth + 0.04, 0.05, depth + 0.74, 0.025), kit.material(PALETTE.plinthEdge, { roughness: 0.7 }), 0, -0.48, depth / 2 - 0.05, false))
    const shadow = new THREE.Mesh(kit.plane(plinthWidth + 3, depth + 3.4), kit.track(new THREE.MeshBasicMaterial({
      map: fadeTexture(kit, 'rgba(30, 50, 80, 0.32)', 'rgba(30, 50, 80, 0)', true),
      transparent: true,
      depthWrite: false,
    })))
    shadow.rotation.x = -Math.PI / 2
    shadow.position.set(0.3, -0.52, depth / 2 + 0.2)
    this.templateRoot.add(shadow)

    const floorTexture = plankTexture(kit)
    floorTexture.repeat.set((right - left) / 1.6, 1)
    const floor = kit.mesh(kit.custom(`floor:${right - left}`, () => new THREE.BoxGeometry(right - left, 0.16, depth)), kit.material('#ffffff', { roughness: 0.78, map: floorTexture }), (left + right) / 2, -0.08, depth / 2)
    floor.castShadow = false
    this.templateRoot.add(floor)

    template.rooms.forEach((room, index) => {
      const x0 = Math.max(left, worldX(room.x, template.width))
      const x1 = Math.min(right, worldX(room.x + room.width, template.width))
      const width = x1 - x0
      const color = accentColor[accents[room.id] ?? 'warm']
      const back = kit.mesh(kit.custom(`wall:${width}`, () => new THREE.BoxGeometry(width, height, wall)), kit.material(color, { roughness: 0.92 }), (x0 + x1) / 2, height / 2, -wall / 2)
      back.castShadow = false
      back.userData.roomId = room.id
      this.templateRoot.add(back)
      this.templateRoot.add(kit.mesh(kit.roundedBox(width, 0.1, 0.03, 0.012), trim, (x0 + x1) / 2, 0.05, 0.015, false))
      this.templateRoot.add(kit.mesh(kit.roundedBox(width + 0.02, 0.06, wall + 0.04, 0.02), trim, (x0 + x1) / 2, height + 0.03, -wall / 2, false))
      if (index > 0) {
        // Partition walls between rooms, open towards the viewer.
        const divider = kit.mesh(kit.custom(`divider:${depth}`, () => new THREE.BoxGeometry(0.12, height, depth)), kit.material(PALETTE.wallWarm, { roughness: 0.92 }), x0, height / 2, depth / 2)
        this.templateRoot.add(divider)
        this.templateRoot.add(kit.mesh(kit.roundedBox(0.16, 0.06, depth + 0.02, 0.02), trim, x0, height + 0.03, depth / 2, false))
      }
    })
    for (const x of [left - wall / 2, right + wall / 2]) {
      const side = kit.mesh(kit.custom(`side:${depth}`, () => new THREE.BoxGeometry(wall, height, depth + wall)), kit.material(PALETTE.wallWarm, { roughness: 0.92 }), x, height / 2, depth / 2 - wall / 2)
      this.templateRoot.add(side)
      this.templateRoot.add(kit.mesh(kit.roundedBox(wall + 0.04, 0.06, depth + wall + 0.02, 0.02), trim, x, height + 0.03, depth / 2 - wall / 2, false))
    }
  }

  /**
   * Build a floor plan template: a plinth, each room's floor in its true
   * place, and the walls the plan draws, cut away where they would hide a
   * room from the camera.
   */
  private buildPlanShell(template: HomeTemplate, plan: PlanShell) {
    const kit = this.templateKit
    const accents = SCENE3D_TEMPLATES[template.id].rooms
    const width = template.width * PLAN3D.scale
    const depth = template.height * PLAN3D.scale
    const toWorld = (point: HomePoint) => new THREE.Vector2(planX(point.x, template.width), planZ(point.y, template.height))

    const plinthWidth = width + 0.6
    const plinthDepth = depth + 0.6
    this.templateRoot.add(kit.mesh(kit.roundedBox(plinthWidth, 0.34, plinthDepth, 0.14), kit.material(PALETTE.plinth, { roughness: 0.7 }), 0, -0.33, 0))
    this.templateRoot.add(kit.mesh(kit.roundedBox(plinthWidth + 0.04, 0.05, plinthDepth + 0.04, 0.025), kit.material(PALETTE.plinthEdge, { roughness: 0.7 }), 0, -0.48, 0, false))
    const shadow = new THREE.Mesh(kit.plane(plinthWidth + 3, plinthDepth + 3), kit.track(new THREE.MeshBasicMaterial({
      map: fadeTexture(kit, 'rgba(30, 50, 80, 0.32)', 'rgba(30, 50, 80, 0)', true),
      transparent: true,
      depthWrite: false,
    })))
    shadow.rotation.x = -Math.PI / 2
    shadow.position.set(0.3, -0.52, 0.3)
    this.templateRoot.add(shadow)

    // Floors: planks, or tiles in the wet rooms. Texture coordinates are in metres.
    const planks = plankTexture(kit)
    planks.repeat.set(1 / 1.6, 1 / 4.4)
    const plankMaterial = kit.material('#ffffff', { roughness: 0.78, map: planks })
    const tileMaterials = new Map<string, THREE.Material>()
    const tileMaterial = (accent: keyof typeof TILE_COLORS) => {
      let material = tileMaterials.get(accent)
      if (!material) {
        const texture = tileTexture(kit, TILE_COLORS[accent])
        texture.repeat.set(1 / 1.2, 1 / 1.2)
        material = kit.material('#ffffff', { roughness: 0.5, map: texture })
        tileMaterials.set(accent, material)
      }
      return material
    }
    const addFloor = (key: string, outline: HomePoint[], material: THREE.Material, roomId?: string) => {
      const geometry = kit.custom(`plan-floor:${key}`, () => {
        const shape = new THREE.Shape(outline.map(toWorld))
        const extruded = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false })
        extruded.rotateX(Math.PI / 2)
        return extruded
      })
      const floor = kit.mesh(geometry, material)
      floor.castShadow = false
      if (roomId)
        floor.userData.roomId = roomId
      this.templateRoot.add(floor)
    }
    for (const room of template.rooms) {
      const outline = plan.outlines?.[room.id] ?? [
        { x: room.x, y: room.y },
        { x: room.x + room.width, y: room.y },
        { x: room.x + room.width, y: room.y + room.height },
        { x: room.x, y: room.y + room.height },
      ]
      const material = plan.tiled?.includes(room.id) ? tileMaterial(accents[room.id] ?? 'warm') : plankMaterial
      addFloor(room.id, outline, material, room.id)
    }

    for (const wall of plan.walls)
      this.buildPlanWall(wall, toWorld)
  }

  private buildPlanWall(wall: PlanWall, toWorld: (point: HomePoint) => THREE.Vector2) {
    const kit = this.templateKit
    const kind = wall.height ?? 'full'
    const thickness: number = PLAN3D.wall
    const height = kind === 'full' ? PLAN3D.height : kind === 'cut' ? PLAN3D.cutHeight : 0.08
    const paint = kit.material(PALETTE.wallWarm, { roughness: 0.92 })
    // Cut walls show their section, like a drawing.
    const cap = kind === 'cut' ? kit.material(PALETTE.plinthEdge, { roughness: 0.7 }) : kit.material(PALETTE.trim, { roughness: 0.6 })
    const glass = kit.material('#cfe6f7', { roughness: 0.1, transparent: true, opacity: 0.32 })
    const openings = (wall.openings ?? []).map(opening => [opening.at / 100, (opening.at + opening.width) / 100] as const)
    const doorHeight = 2.1
    const points = wall.points.map(toWorld)
    let travelled = 0
    points.slice(1).forEach((end, index) => {
      const start = points[index]!
      const length = start.distanceTo(end)
      const angle = Math.atan2(end.y - start.y, end.x - start.x)
      const piece = (from: number, to: number, y0: number, y1: number, material: THREE.Material, depth = thickness) => {
        const along = (from + to) / 2
        const mesh = kit.mesh(kit.custom(`plan-wall:${(to - from).toFixed(3)}:${(y1 - y0).toFixed(3)}:${depth}`, () => new THREE.BoxGeometry(to - from, y1 - y0, depth)), material)
        mesh.position.set(start.x + Math.cos(angle) * along, (y0 + y1) / 2, start.y + Math.sin(angle) * along)
        mesh.rotation.y = -angle
        this.templateRoot.add(mesh)
        return mesh
      }
      // Solid stretches between the door gaps; the outer ends reach over the corners.
      const gaps = openings
        .map(([a, b]) => [a - travelled, b - travelled] as const)
        .filter(([a, b]) => b > 0 && a < length)
      const first = index === 0 ? -thickness / 2 : 0
      const last = index === points.length - 2 ? length + thickness / 2 : length
      let cursor = first
      const solids: Array<[number, number]> = []
      for (const [a, b] of gaps) {
        if (a > cursor)
          solids.push([cursor, a])
        if (kind === 'full')
          piece(Math.max(0, a), Math.min(length, b), doorHeight, height, paint)
        cursor = Math.max(cursor, b)
      }
      if (cursor < last)
        solids.push([cursor, last])
      for (const [from, to] of solids) {
        if (to - from < 0.01)
          continue
        if (kind === 'rail') {
          piece(from, to, 0, 0.08, cap, 0.1)
          piece(from, to, 0.08, 0.92, glass, 0.03).castShadow = false
          piece(from, to, 0.92, 0.97, kit.material(PALETTE.trim, { roughness: 0.6 }), 0.07)
          continue
        }
        const body = piece(from, to, 0, height, paint)
        body.castShadow = kind === 'full'
        piece(from - 0.01, to + 0.01, height, height + 0.04, cap, thickness + 0.03).castShadow = false
      }
      travelled += length
    })
  }

  // Devices ------------------------------------------------------------------

  private entry(kind: DeviceKind) {
    let entry = this.devices.get(kind)
    if (!entry) {
      const model = buildDevice(this.deviceKit, kind)
      const holder = new THREE.Group()
      holder.userData.deviceId = kind
      // Hidden until a placement puts it in a room.
      holder.visible = false
      holder.add(model.object)
      this.deviceRoot.add(holder)
      entry = { model, holder, scale: 1, lift: 0, heading: 0 }
      this.devices.set(kind, entry)
    }
    return entry
  }

  /** Move devices to their placements. */
  setPlacements(placements: DevicePlacement[]) {
    this.placements = placements
    if (!this.template)
      return
    this.layoutDevices()
    this.updateRoute()
    this.invalidate()
  }

  private layoutDevices() {
    const template = this.template
    if (!template)
      return
    const tabletops = this.tabletops
    const drag = this.drag
    const carried = this.carriedTabletop()
    const placed = new Set<DeviceKind>()
    const put = (kind: DeviceKind, position: Vec3, surfaceKind: HomeSurfaceKind, normal: Vec3, rotation: number) => {
      const entry = this.entry(kind)
      placed.add(kind)
      entry.holder.visible = true
      entry.holder.position.set(position.x, position.y, position.z)
      // Wall devices face out of their wall; the rest turn with the placement.
      const heading = surfaceKind === 'wall' ? Math.atan2(normal.x, normal.z) : -THREE.MathUtils.degToRad(rotation)
      entry.heading = heading
      entry.holder.rotation.y = heading
      entry.holder.userData.base = position
    }
    for (const placement of this.placements) {
      if (placement.deviceId === drag?.deviceId && (drag.placement || drag.position))
        continue
      const projected = projectPlacement(template, placement, tabletops)
      if (!projected)
        continue
      // A device on a tabletop rides along with the piece being dragged.
      if (carried && placement.surfaceId === carried.surfaceId) {
        const at = carryPoint(projected.position, carried.from, carried.to)
        projected.position = { ...projected.position, x: at.x, z: at.z }
      }
      put(placement.deviceId, projected.position, projected.surfaceKind, projected.normal, placement.rotation)
    }
    this.marker.visible = false
    if (drag) {
      const rotation = this.placements.find(item => item.deviceId === drag.deviceId)?.rotation ?? 0
      const projected = drag.placement && projectPlacement(template, drag.placement, tabletops)
      const position = projected?.position ?? (drag.position && this.clampToDiorama(drag.position))
      const surfaceKind = projected?.surfaceKind ?? drag.surfaceKind
      const normal = projected?.normal ?? drag.normal
      if (position && surfaceKind && normal) {
        put(drag.deviceId, position, surfaceKind, normal, rotation)
        this.showMarker(position, surfaceKind, normal, Boolean(projected))
      }
    }
    for (const [kind, entry] of this.devices) {
      if (!placed.has(kind))
        entry.holder.visible = false
    }
  }

  private clampToDiorama(position: Vec3): Vec3 {
    const template = this.template
    if (!template)
      return position
    const bounds = roomBounds(template, null)
    return {
      x: THREE.MathUtils.clamp(position.x, bounds.x0, bounds.x1),
      y: THREE.MathUtils.clamp(position.y, 0, isPlan(template) ? PLAN3D.height : SCENE3D.height),
      z: THREE.MathUtils.clamp(position.z, bounds.z0, bounds.z1),
    }
  }

  // Placement ----------------------------------------------------------------

  private buildSurfaceOverlays(template: HomeTemplate) {
    for (const overlay of this.surfaceOverlays)
      this.editRoot.remove(overlay.object)
    // Tabletops move with their furniture, so overlays are rebuilt rather than cached.
    this.overlayKit.dispose()
    this.overlayKit = new Kit()
    const tabletops = this.tabletops
    const kit = this.overlayKit
    this.surfaceOverlays = template.surfaces.map((surface) => {
      // Lift each overlay just clear of what it lies on: wall, rug or tabletop.
      const { normal } = surfaceFrame(template, surface, tabletops[surface.id])
      const lift = surface.kind === 'wall' ? 0.014 - SCENE3D.wallOffset : surface.kind === 'floor' ? 0.032 : 0.008
      const corners = surfaceCorners(template, surface, tabletops[surface.id])
        .map(corner => new THREE.Vector3(corner.x + normal.x * lift, corner.y + normal.y * lift, corner.z + normal.z * lift))
      const [a, b, c, d] = corners as [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]
      // A solid border band reads better than a 1 px WebGL line at any size.
      const at = (u: number, v: number) => a.clone().lerp(b, u).lerp(d.clone().lerp(c, u), v)
      const iu = 0.05 / a.distanceTo(b)
      const iv = 0.05 / a.distanceTo(d)
      const inner = [at(iu, iv), at(1 - iu, iv), at(1 - iu, 1 - iv), at(iu, 1 - iv)]
      const band = corners.flatMap((corner, index) => {
        const next = (index + 1) % 4
        return [corner, corners[next]!, inner[next]!, corner, inner[next]!, inner[index]!]
      })
      const material = (opacity: number) => kit.track(new THREE.MeshBasicMaterial({ color: EDIT_COLORS.surface, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }))
      const fill = material(0.1)
      const edge = material(0.5)
      const area = new THREE.Mesh(kit.custom(`surface:${surface.id}`, () => new THREE.BufferGeometry().setFromPoints([0, 1, 2, 0, 2, 3].map(index => inner[index]!))), fill)
      const outline = new THREE.Mesh(kit.custom(`surface-edge:${surface.id}`, () => new THREE.BufferGeometry().setFromPoints(band)), edge)
      const object = new THREE.Group()
      object.add(area, outline)
      object.renderOrder = 2
      this.editRoot.add(object)
      return { surface, object, fill, edge }
    })
    this.styleSurfaceOverlays(0)
  }

  /** Light the surfaces the selected (or dragged) device can go on. */
  private styleSurfaceOverlays(time: number) {
    const focus = this.drag?.deviceId ?? this.selected
    const pulse = focus && !this.options.reducedMotion ? (Math.sin(time * 3.6) + 1) / 2 : 0
    for (const overlay of this.surfaceOverlays) {
      overlay.object.visible = !focus || overlay.surface.accepts.includes(focus)
      overlay.fill.opacity = focus ? 0.16 + pulse * 0.14 : 0.1
      overlay.edge.opacity = focus ? 0.9 : 0.5
    }
  }

  private showMarker(position: Vec3, surfaceKind: HomeSurfaceKind, normal: Vec3, valid: boolean) {
    const wall = surfaceKind === 'wall'
    // Just clear of the wall face, or of the floor or tabletop.
    const lift = wall ? 0.02 - SCENE3D.wallOffset : 0.036
    this.marker.visible = true
    this.marker.position.set(position.x + normal.x * lift, position.y + normal.y * lift, position.z + normal.z * lift)
    if (wall)
      this.marker.rotation.set(0, Math.atan2(normal.x, normal.z), 0)
    else
      this.marker.rotation.set(-Math.PI / 2, 0, 0)
    for (const material of this.markerMaterials)
      material.color.set(valid ? EDIT_COLORS.surface : EDIT_COLORS.invalid)
  }

  /** Show where devices can go, for editing the layout. */
  setEditing(editing: boolean) {
    if (editing === this.editing)
      return
    this.editing = editing
    this.editRoot.visible = editing
    if (!editing) {
      this.endDrag()
      this.endFurnitureDrag()
    }
    this.styleSurfaceOverlays(performance.now() / 1000)
    this.invalidate()
  }

  private rayAt(x: number, y: number): Ray3 {
    this.camera.updateMatrixWorld()
    this.raycaster.setFromCamera(new THREE.Vector2(x / this.width * 2 - 1, -(y / this.height) * 2 + 1), this.camera)
    const { origin, direction } = this.raycaster.ray
    return { origin: { x: origin.x, y: origin.y, z: origin.z }, direction: { x: direction.x, y: direction.y, z: direction.z } }
  }

  /**
   * The surface point under a point of the canvas, on a surface that accepts
   * the device. Feed it to the placement rules to place the device there.
   *
   * @param deviceId - Device being placed
   * @param x - Canvas x in CSS pixels
   * @param y - Canvas y in CSS pixels
   * @returns The surface and the point on its sheet, or null when no surface is under the pointer
   */
  surfacePointAt(deviceId: DeviceKind, x: number, y: number): SurfaceTarget | null {
    const template = this.template
    if (!template)
      return null
    const hit = findSurfaceAlongRay(template, deviceId, this.rayAt(x, y), this.tabletops)
    return hit && { surfaceId: hit.surface.id, point: hit.point }
  }

  /**
   * Preview a device dragged to a point of the canvas: it moves to where a
   * drop would put it, or follows the pointer with a warning marker when the
   * spot is not allowed.
   *
   * @param deviceId - Device being dragged
   * @param x - Canvas x in CSS pixels
   * @param y - Canvas y in CSS pixels
   * @returns The surface point and whether a drop there would place the device
   */
  dragDevice(deviceId: DeviceKind, x: number, y: number): { target: SurfaceTarget | null, valid: boolean } {
    const template = this.template
    if (!template)
      return { target: null, valid: false }
    const tabletops = this.tabletops
    const hit = findSurfaceAlongRay(template, deviceId, this.rayAt(x, y), tabletops)
    const rotation = this.placements.find(item => item.deviceId === deviceId)?.rotation ?? 0
    const placement = hit ? createPlacementAtPoint(template, deviceId, hit.point, this.placements, rotation, hit.surface.id) : null
    this.drag = {
      deviceId,
      point: hit?.point ?? null,
      placement,
      position: hit?.position ?? null,
      surfaceKind: hit?.surface.kind ?? null,
      normal: hit ? surfaceFrame(template, hit.surface, tabletops[hit.surface.id]).normal : null,
    }
    this.layoutDevices()
    this.styleSurfaceOverlays(performance.now() / 1000)
    this.invalidate()
    return { target: hit && { surfaceId: hit.surface.id, point: hit.point }, valid: Boolean(placement) }
  }

  /** End a drag preview and put the device back on its placement. */
  endDrag() {
    if (!this.drag)
      return
    this.drag = null
    this.layoutDevices()
    this.styleSurfaceOverlays(performance.now() / 1000)
    this.invalidate()
  }

  // Furniture -----------------------------------------------------------------

  /** The tabletop of the piece being dragged, and how the piece moves. */
  private carriedTabletop() {
    const drag = this.furnitureDrag
    const spec = drag?.pose && this.home?.furniture.find(item => item.id === drag.id)
    if (!drag?.pose || !spec)
      return null
    const surfaceId = spec.tabletop ?? `${spec.id}-top`
    return { surfaceId, from: poseOf(spec), to: drag.pose }
  }

  /** Outline the selected or dragged piece's footprint on the floor. */
  private showFootprint() {
    const drag = this.furnitureDrag
    const id = drag?.id ?? this.selectedFurniture
    const spec = id ? this.home?.furniture.find(item => item.id === id) : undefined
    const bounds = spec && furnitureFootprint(spec, drag?.pose ?? poseOf(spec))
    for (const child of this.footprint.children)
      (child as THREE.Mesh).geometry.dispose()
    this.footprint.clear()
    this.footprint.visible = Boolean(bounds)
    if (!bounds)
      return
    const y = 0.04
    const corner = (x: number, z: number) => new THREE.Vector3(x, y, z)
    const outer = [corner(bounds.x0, bounds.z0), corner(bounds.x1, bounds.z0), corner(bounds.x1, bounds.z1), corner(bounds.x0, bounds.z1)]
    const band = Math.min(0.05, (bounds.x1 - bounds.x0) / 4, (bounds.z1 - bounds.z0) / 4)
    const inner = [corner(bounds.x0 + band, bounds.z0 + band), corner(bounds.x1 - band, bounds.z0 + band), corner(bounds.x1 - band, bounds.z1 - band), corner(bounds.x0 + band, bounds.z1 - band)]
    const edge = outer.flatMap((point, index) => {
      const next = (index + 1) % 4
      return [point, outer[next]!, inner[next]!, point, inner[next]!, inner[index]!]
    })
    const fill = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([0, 1, 2, 0, 2, 3].map(index => inner[index]!)), this.footprintMaterials[0])
    const outline = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints(edge), this.footprintMaterials[1])
    fill.renderOrder = 9
    outline.renderOrder = 9
    this.footprint.add(fill, outline)
    for (const material of this.footprintMaterials)
      material.color.set(drag?.problem ? EDIT_COLORS.invalid : EDIT_COLORS.surface)
  }

  /** Outline a piece of furniture as selected, or none. */
  setFurnitureSelection(id: string | null) {
    if (id === this.selectedFurniture)
      return
    this.selectedFurniture = id
    this.showFootprint()
    this.invalidate()
  }

  /** Set the pieces of a drag at a pose, or back where they stand. */
  private poseFurniture(id: string, pose: FurniturePose | null) {
    const home = this.home
    if (!home)
      return
    const pieces = pose ? piecesMovedTo(home, id, pose) : home.furniture.filter(item => item.id === id || item.on === id)
    for (const piece of pieces) {
      const object = this.furnitureObjects.get(piece.id)
      object?.position.set(piece.x, piece.y ?? 0, piece.z ?? 0)
      object?.rotation.set(0, THREE.MathUtils.degToRad(piece.rotation ?? 0), 0)
    }
  }

  /**
   * Preview a piece of furniture dragged to a point of the canvas. It slides
   * over the floor of its room on the furniture grid; its footprint turns red
   * where it cannot stand.
   *
   * @param id - Piece being dragged
   * @param x - Canvas x in CSS pixels
   * @param y - Canvas y in CSS pixels
   * @returns Where a drop would put it and why it cannot go there, if it cannot
   */
  dragFurniture(id: string, x: number, y: number): { pose: FurniturePose | null, problem: FurnitureProblem | null } {
    const home = this.home
    const spec = home?.furniture.find(item => item.id === id)
    if (!home || !spec)
      return { pose: null, problem: 'fixed' }
    const template = home.template
    const floor = template.surfaces.find(surface => surface.kind === 'floor' && surface.roomId === spec.roomId)
      ?? template.surfaces.find(surface => surface.kind === 'floor')
    const hit = floor && intersectSurfacePlane(template, floor, this.rayAt(x, y))
    if (!hit)
      return { pose: this.furnitureDrag?.pose ?? null, problem: this.furnitureDrag?.problem ?? 'outside' }
    if (this.furnitureDrag?.id !== id)
      this.furnitureDrag = { id, grab: { x: spec.x - hit.position.x, z: (spec.z ?? 0) - hit.position.z }, pose: null, problem: null }
    const drag = this.furnitureDrag
    const pose = { x: snapFurniture(hit.position.x + drag.grab.x), z: snapFurniture(hit.position.z + drag.grab.z), rotation: poseOf(spec).rotation }
    drag.pose = pose
    drag.problem = furnitureProblem(home, this.placements, spec, pose)
    this.poseFurniture(id, pose)
    this.showFootprint()
    this.layoutDevices()
    this.invalidate()
    return { pose, problem: drag.problem }
  }

  /** End a furniture drag and put the piece back where it stands. */
  endFurnitureDrag() {
    const drag = this.furnitureDrag
    if (!drag)
      return
    this.furnitureDrag = null
    this.poseFurniture(drag.id, null)
    this.showFootprint()
    this.layoutDevices()
    this.invalidate()
  }

  /** Show each device's state. */
  setVisuals(visuals: Partial<Record<DeviceKind, DeviceVisual>>) {
    for (const [kind, visual] of Object.entries(visuals) as Array<[DeviceKind, DeviceVisual]>)
      this.entry(kind).model.setVisual(visual)
    this.invalidate()
  }

  /** Follow the robot vacuum's cleaning progress, extrapolated between updates. */
  setRobot(cleaning: boolean, progress: number) {
    const changed = cleaning !== this.robot.cleaning
    this.robot = { cleaning, progress, at: performance.now() }
    if (changed)
      this.updateRoute()
    this.invalidate()
  }

  private robotRoute(): HomePoint[] {
    const template = this.template
    const placement = this.placements.find(item => item.deviceId === 'robot-vacuum')
    if (!template || !placement?.surfaceId)
      return []
    return getRobotRoute(template, placement)
  }

  private updateRoute() {
    if (this.route) {
      this.deviceRoot.remove(this.route)
      this.route.geometry.dispose()
      ;(this.route.material as THREE.Material).dispose()
      this.route = null
    }
    const template = this.template
    const robot = this.devices.get('robot-vacuum')
    this.dock.visible = Boolean(this.robot.cleaning && robot?.holder.visible)
    if (robot?.holder.userData.base) {
      const base = robot.holder.userData.base as { x: number, z: number }
      const z = base.z - 0.32
      this.dock.position.set(base.x, 0, template && isPlan(template) ? z : Math.max(0.08, z))
    }
    const points = this.robotRoute()
    if (!template || !this.robot.cleaning || points.length < 2)
      return
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map((point) => {
      const p = projectFloorPoint(template, point)
      return new THREE.Vector3(p.x, 0.012, p.z)
    }))
    const line = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color: TONE_COLORS.cool, dashSize: 0.12, gapSize: 0.1, transparent: true, opacity: 0.75 }))
    line.computeLineDistances()
    this.route = line
    this.deviceRoot.add(line)
  }

  private stepRobot(dt: number) {
    const entry = this.devices.get('robot-vacuum')
    const template = this.template
    if (!entry || !template || !entry.holder.visible)
      return false
    const base = entry.holder.userData.base as { x: number, y: number, z: number } | undefined
    if (!this.robot.cleaning || !base || this.drag?.deviceId === 'robot-vacuum') {
      if (base)
        entry.holder.position.set(base.x, base.y, base.z)
      entry.holder.rotation.y = entry.heading
      return false
    }
    const route = this.robotRoute()
    if (route.length < 2)
      return false
    const elapsed = this.options.reducedMotion ? 0 : (performance.now() - this.robot.at) / 30_000
    const progress = (this.robot.progress + elapsed) % 1
    const current = getPointAlongRoute(route, progress)
    const next = getPointAlongRoute(route, (progress + 0.004) % 1)
    if (!current || !next)
      return false
    const point = projectFloorPoint(template, current)
    const ahead = projectFloorPoint(template, next)
    entry.holder.position.set(point.x, 0, point.z)
    const heading = Math.atan2(ahead.x - point.x, ahead.z - point.z)
    let delta = heading - entry.holder.rotation.y
    delta = Math.atan2(Math.sin(delta), Math.cos(delta))
    entry.holder.rotation.y += delta * (1 - Math.exp(-dt * 10))
    if (this.route) {
      const material = this.route.material as THREE.LineDashedMaterial
      material.opacity = 0.55 + Math.sin(performance.now() / 300) * 0.15
    }
    return !this.options.reducedMotion
  }

  private stepDevices(dt: number, time: number) {
    let busy = this.stepRobot(dt)
    for (const [kind, entry] of this.devices) {
      if (!entry.holder.visible)
        continue
      busy = entry.model.update(dt, time, this.options.reducedMotion) || busy
      const selected = this.selected === kind
      const hovered = this.hovered === kind
      const scale = selected ? 1.08 : hovered ? 1.05 : 1
      const lift = selected ? 0.05 : hovered ? 0.025 : 0
      if (this.options.reducedMotion) {
        entry.scale = scale
        entry.lift = lift
      }
      else {
        entry.scale = approach(entry.scale, scale, dt, 14)
        entry.lift = approach(entry.lift, lift, dt, 14)
      }
      entry.holder.scale.setScalar(entry.scale)
      entry.model.object.position.y = entry.lift
      busy = busy || Math.abs(entry.scale - scale) > 0.001 || Math.abs(entry.lift - lift) > 0.0005
    }
    return busy
  }

  /** Emphasise the selected and hovered devices. */
  setSelection(selected: DeviceKind | null, hovered: DeviceKind | null = this.hovered) {
    this.selected = selected
    this.hovered = hovered
    this.styleSurfaceOverlays(performance.now() / 1000)
    this.invalidate()
  }

  // Camera -------------------------------------------------------------------

  /** Frame a room, or the whole home when `roomId` is null. */
  setFocus(roomId: string | null, overview: boolean) {
    if (roomId === this.focusRoomId && overview === this.overview)
      return
    this.focusRoomId = roomId
    this.overview = overview
    this.resetView()
  }

  /**
   * Follow the reduced motion preference: no ambient animation or easing,
   * and frames only render when something changes.
   */
  setReducedMotion(reduced: boolean) {
    if (reduced === this.options.reducedMotion)
      return
    this.options.reducedMotion = reduced
    if (reduced) {
      this.pose = { ...this.poseTo }
      this.poseStartedAt = -Infinity
      this.applyLighting(this.phaseTo)
      this.phaseStartedAt = -Infinity
    }
    this.invalidate()
  }

  /** Switch between the phone and desktop camera. */
  setMobile(mobile: boolean) {
    if (mobile === this.options.mobile)
      return
    this.options.mobile = mobile
    this.reframe(true)
  }

  /** Keep content clear of an overlay on the right, in CSS pixels. */
  setInsetRight(pixels: number) {
    if (pixels === this.insetRight)
      return
    this.insetRight = pixels
    this.reframe(false)
  }

  /** Turn the diorama, from a pointer drag in CSS pixels. */
  rotateBy(dx: number, dy: number) {
    this.orbit.targetYaw = THREE.MathUtils.clamp(this.orbit.targetYaw - dx * 0.0045, -0.85, 0.85)
    this.orbit.targetPitch = THREE.MathUtils.clamp(this.orbit.targetPitch + dy * 0.003, -0.24, 0.42)
    this.invalidate()
  }

  /**
   * Slide the view over the home, from a pointer drag in CSS pixels: the
   * floor under the pointer follows it.
   */
  panBy(dx: number, dy: number) {
    const template = this.template
    if (!template)
      return
    const yaw = this.baseYaw + this.orbit.targetYaw
    const pitch = this.basePitch + this.orbit.targetPitch
    const distance = this.poseTo.distance * this.view.targetZoom
    const perPixel = 2 * distance * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) / this.height
    // Screen right and screen up, laid on the floor.
    const right = { x: Math.cos(yaw), z: -Math.sin(yaw) }
    const away = { x: -Math.sin(yaw), z: -Math.cos(yaw) }
    const along = perPixel / Math.max(0.35, Math.sin(pitch))
    const bounds = roomBounds(template, null)
    const centre = { x: (bounds.x0 + bounds.x1) / 2 - this.poseTo.x, z: (bounds.z0 + bounds.z1) / 2 - this.poseTo.z }
    const reachX = (bounds.x1 - bounds.x0) / 2 + 1
    const reachZ = (bounds.z1 - bounds.z0) / 2 + 1
    this.view.targetX = THREE.MathUtils.clamp(this.view.targetX - right.x * dx * perPixel + away.x * dy * along, centre.x - reachX, centre.x + reachX)
    this.view.targetZ = THREE.MathUtils.clamp(this.view.targetZ - right.z * dx * perPixel + away.z * dy * along, centre.z - reachZ, centre.z + reachZ)
    this.invalidate()
  }

  /** Move the camera closer (factor below 1) or further away. */
  zoomBy(factor: number) {
    this.view.targetZoom = THREE.MathUtils.clamp(this.view.targetZoom * factor, 0.35, 1.6)
    this.invalidate()
  }

  /** Back to the framed view of the room or home. */
  resetView() {
    this.orbit.targetYaw = 0
    this.orbit.targetPitch = 0
    Object.assign(this.view, { targetX: 0, targetZ: 0, targetZoom: 1 })
    this.reframe(false)
  }

  /** Camera elevation for the template and screen. */
  private get basePitch() {
    if (this.template && isPlan(this.template))
      return this.options.mobile ? PLAN_MOBILE_PITCH : PLAN_PITCH
    return this.options.mobile ? MOBILE_PITCH : BASE_PITCH
  }

  /** Camera turn for the template. */
  private get baseYaw() {
    return this.template && isPlan(this.template) ? PLAN_YAW : 0
  }

  private framePose(): CameraPose {
    const template = this.template
    const aspect = this.width / this.height
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    const usable = Math.max(0.4, 1 - this.insetRight / this.width)
    if (template && isPlan(template))
      return this.framePlan(roomBounds(template, this.overview ? null : this.focusRoomId), aspect, tan, usable)
    const extent = template ? roomBounds(template, this.overview ? null : this.focusRoomId) : { x0: -8, x1: 8 }
    const width = extent.x1 - extent.x0 + (this.overview ? 0.9 : this.options.mobile ? 0.5 : 1.6)
    const pitch = this.basePitch
    const visibleHeight = SCENE3D.height * Math.cos(pitch) + SCENE3D.depth * Math.sin(pitch) + 1.1
    // Leave room for the overlay by narrowing the usable width.
    const distance = Math.max(width / 2 / (tan * aspect * usable), visibleHeight / 2 / tan) + SCENE3D.depth * 0.45
    return {
      x: (extent.x0 + extent.x1) / 2,
      y: 1.2,
      z: SCENE3D.depth * 0.42,
      distance,
      shift: this.insetRight / 2,
    }
  }

  /** Frame an area of a floor plan, seen from above and a little to the west. */
  private framePlan(bounds: FloorBounds, aspect: number, tan: number, usable: number): CameraPose {
    const margin = this.overview ? 0.7 : this.options.mobile ? 0.8 : 1.8
    const pitch = this.basePitch
    const yaw = this.baseYaw
    // The footprint as the turned camera sees it.
    const spanX = bounds.x1 - bounds.x0 + margin
    const spanZ = bounds.z1 - bounds.z0 + margin
    const turn = Math.abs(yaw)
    const across = spanX * Math.cos(turn) + spanZ * Math.sin(turn)
    const along = spanX * Math.sin(turn) + spanZ * Math.cos(turn)
    const visibleHeight = along * Math.sin(pitch) + PLAN3D.height * Math.cos(pitch)
    const distance = Math.max(across / 2 / (tan * aspect * usable), visibleHeight / 2 / tan) + along * 0.2
    return {
      x: (bounds.x0 + bounds.x1) / 2,
      y: 0.4,
      z: (bounds.z0 + bounds.z1) / 2 + 0.15,
      distance,
      shift: this.insetRight / 2,
    }
  }

  private reframe(immediate: boolean) {
    this.poseTo = this.framePose()
    if (immediate || this.options.reducedMotion) {
      this.pose = { ...this.poseTo }
      this.poseStartedAt = -Infinity
    }
    else {
      this.poseFrom = { ...this.pose }
      this.poseStartedAt = performance.now()
    }
    this.invalidate()
  }

  private stepCamera(now: number, dt: number) {
    let busy = false
    if (Number.isFinite(this.poseStartedAt)) {
      const progress = Math.min(1, (now - this.poseStartedAt) / CAMERA_DURATION)
      const t = easeOutQuart(progress)
      const from = this.poseFrom
      const to = this.poseTo
      this.pose = {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        z: from.z + (to.z - from.z) * t,
        distance: from.distance + (to.distance - from.distance) * t,
        shift: from.shift + (to.shift - from.shift) * t,
      }
      if (progress >= 1)
        this.poseStartedAt = -Infinity
      busy = progress < 1
    }
    const orbit = this.orbit
    const view = this.view
    if (this.options.reducedMotion) {
      orbit.yaw = orbit.targetYaw
      orbit.pitch = orbit.targetPitch
      Object.assign(view, { x: view.targetX, z: view.targetZ, zoom: view.targetZoom })
    }
    else {
      orbit.yaw = approach(orbit.yaw, orbit.targetYaw, dt, 9)
      orbit.pitch = approach(orbit.pitch, orbit.targetPitch, dt, 9)
      view.x = approach(view.x, view.targetX, dt, 14)
      view.z = approach(view.z, view.targetZ, dt, 14)
      view.zoom = approach(view.zoom, view.targetZoom, dt, 12)
      busy = busy || Math.abs(orbit.yaw - orbit.targetYaw) > 0.0005 || Math.abs(orbit.pitch - orbit.targetPitch) > 0.0005
        || Math.abs(view.x - view.targetX) > 0.001 || Math.abs(view.z - view.targetZ) > 0.001 || Math.abs(view.zoom - view.targetZoom) > 0.0005
    }
    const yaw = this.baseYaw + orbit.yaw
    const pitch = this.basePitch + orbit.pitch
    const x = this.pose.x + view.x
    const z = this.pose.z + view.z
    const { y, shift } = this.pose
    const distance = this.pose.distance * view.zoom
    this.camera.position.set(
      x + Math.sin(yaw) * Math.cos(pitch) * distance,
      y + Math.sin(pitch) * distance,
      z + Math.cos(yaw) * Math.cos(pitch) * distance,
    )
    this.camera.lookAt(x, y, z)
    this.camera.setViewOffset(this.width, this.height, shift, 0, this.width, this.height)
    return busy
  }

  // Rendering ----------------------------------------------------------------

  /** Match the canvas size in CSS pixels. */
  resize(width: number, height: number) {
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
    this.renderer.setSize(this.width, this.height, false)
    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()
    this.reframe(true)
  }

  /** Stop rendering while hidden. */
  setPaused(paused: boolean) {
    this.paused = paused
    if (!paused)
      this.invalidate()
  }

  /** Request a frame. */
  invalidate() {
    if (this.frame || this.disposed || this.paused)
      return
    this.frame = requestAnimationFrame(this.loop)
  }

  private loop = (now: number) => {
    this.frame = 0
    if (this.disposed || this.paused)
      return
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60
    this.last = now
    const time = now / 1000
    let busy = this.stepCamera(now, dt)
    busy = this.stepPhase(now) || busy
    busy = this.stepDevices(dt, time) || busy
    const pulsing = this.editing && Boolean(this.drag ?? this.selected)
    const ambient = !this.options.reducedMotion && (this.ticks.length > 0 || pulsing)
    // Ambient motion alone runs at a calmer 30 fps.
    if (busy || !ambient || now - this.lastRender > 32) {
      if (ambient) {
        for (const tick of this.ticks)
          tick(time)
      }
      if (this.editing)
        this.styleSurfaceOverlays(time)
      this.renderer.render(this.scene, this.camera)
      this.lastRender = now
      this.project()
    }
    if (busy || ambient)
      this.frame = requestAnimationFrame(this.loop)
    else
      this.last = 0
  }

  private project() {
    const callback = this.options.onProject
    if (!callback)
      return
    const anchors: ScreenAnchor[] = []
    const vector = new THREE.Vector3()
    for (const [id, entry] of this.devices) {
      if (!entry.holder.visible)
        continue
      vector.copy(entry.model.anchor)
      entry.model.object.localToWorld(vector)
      vector.project(this.camera)
      anchors.push({
        id,
        x: (vector.x + 1) / 2 * this.width,
        y: (1 - vector.y) / 2 * this.height,
        visible: vector.z < 1 && Math.abs(vector.x) < 1.05 && Math.abs(vector.y) < 1.05,
      })
    }
    callback(anchors)
  }

  /**
   * Find what lies under a point of the canvas.
   *
   * @param x - Canvas x in CSS pixels
   * @param y - Canvas y in CSS pixels
   * @returns The device or movable piece of furniture under the point, and the room it falls in
   */
  pick(x: number, y: number): { deviceId: DeviceKind | null, furnitureId: string | null, roomId: string | null } {
    const pointer = new THREE.Vector2(x / this.width * 2 - 1, -(y / this.height) * 2 + 1)
    this.raycaster.setFromCamera(pointer, this.camera)
    // Raycasting ignores visibility; skip devices hidden because they are not placed.
    const first = this.raycaster.intersectObjects([this.deviceRoot, this.furnitureRoot, this.templateRoot], true).find(item => isShown(item.object))
    if (!first || !this.template)
      return { deviceId: null, furnitureId: null, roomId: null }
    const owner = (object: THREE.Object3D) => {
      let node: THREE.Object3D | null = object
      while (node && !node.userData.deviceId && !node.userData.furnitureId)
        node = node.parent
      return node
    }
    let picked = owner(first.object)
    // Rugs lie under tables and sofas: a press on the rug just beside one
    // means the piece, which is what people reach for.
    if (picked?.userData.flat && this.home) {
      const near = this.home.furniture.find((item) => {
        const bounds = item.kind !== 'rug' && item.roomId === picked!.userData.roomId && isMovableFurniture(item) ? furnitureFootprint(item) : null
        const reach = 0.15
        return bounds && first.point.x > bounds.x0 - reach && first.point.x < bounds.x1 + reach && first.point.z > bounds.z0 - reach && first.point.z < bounds.z1 + reach
      })
      if (near)
        picked = this.furnitureObjects.get(near.id) ?? picked
    }
    return {
      deviceId: (picked?.userData.deviceId as DeviceKind | undefined) ?? null,
      furnitureId: (picked?.userData.furnitureId as string | undefined) ?? null,
      roomId: roomAt(this.template, first.point),
    }
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.updateRouteDispose()
    this.templateKit.dispose()
    this.furnitureKit.dispose()
    this.overlayKit.dispose()
    for (const child of this.footprint.children)
      (child as THREE.Mesh).geometry.dispose()
    this.deviceKit.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }

  private updateRouteDispose() {
    if (!this.route)
      return
    this.route.geometry.dispose()
    ;(this.route.material as THREE.Material).dispose()
    this.route = null
  }
}
