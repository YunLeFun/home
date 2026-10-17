import * as THREE from 'three'
import type { ScenePhase } from '~/composables/scene-time'
import type { DeviceKind, DevicePlacement, HomePoint, HomeSurface, HomeSurfaceKind, HomeTemplate } from '~/types'
import type { DeviceModel, DeviceVisual } from './devices'
import type { PhaseTargets, SceneLamp } from './furniture'
import type { Ray3, Vec3 } from './projection'
import { SCENE3D_TEMPLATES } from '~/constants/scene3d'
import { createPlacementAtPoint, getPointAlongRoute, getRobotRoute } from '~/utils/home'
import { buildDevice, buildRobotDock } from './devices'
import { buildFurniture } from './furniture'
import { EDIT_COLORS, Kit, PALETTE, TONE_COLORS } from './kit'
import { findSurfaceAlongRay, projectFloorPoint, projectPlacement, roomAtWorldX, roomExtent, SCENE3D, surfaceCorners, worldX } from './projection'

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
  private options: HomeScene3DOptions
  private basePitch: number

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
    this.basePitch = options.mobile ? MOBILE_PITCH : BASE_PITCH
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
    this.scene.add(this.hemi, this.sun, this.sun.target, this.templateRoot, this.deviceRoot, this.editRoot)
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

  /** Build the rooms and furniture of a template. */
  setTemplate(template: HomeTemplate) {
    if (this.template?.id === template.id)
      return
    this.template = template
    this.drag = null
    this.templateRoot.clear()
    this.templateKit.dispose()
    this.templateKit = new Kit()
    this.lamps = []
    this.ticks = []
    this.buildShell(template)
    const spec = SCENE3D_TEMPLATES[template.id]
    for (const item of spec.furniture) {
      const built = buildFurniture(this.templateKit, item, this.phaseTargets)
      built.object.position.set(item.x, item.y ?? 0, item.z ?? 0)
      built.object.userData.roomId = item.roomId
      this.templateRoot.add(built.object)
      if (built.lamp)
        this.lamps.push(built.lamp)
      if (built.tick)
        this.ticks.push(built.tick)
    }
    for (const tick of this.ticks)
      tick(0)
    this.applyLighting(this.current)
    this.buildSurfaceOverlays(template)
    this.updateRoute()
    this.setPlacements(this.placements)
    this.reframe(true)
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
    const tabletops = SCENE3D_TEMPLATES[template.id].tabletops
    const drag = this.drag
    const placed = new Set<DeviceKind>()
    const put = (kind: DeviceKind, position: Vec3, surfaceKind: HomeSurfaceKind, rotation: number) => {
      const entry = this.entry(kind)
      placed.add(kind)
      entry.holder.visible = true
      entry.holder.position.set(position.x, position.y, position.z)
      const heading = surfaceKind === 'wall' ? 0 : -THREE.MathUtils.degToRad(rotation)
      entry.heading = heading
      entry.holder.rotation.y = heading
      entry.holder.userData.base = position
    }
    for (const placement of this.placements) {
      if (placement.deviceId === drag?.deviceId && (drag.placement || drag.position))
        continue
      const projected = projectPlacement(template, placement, tabletops)
      if (projected)
        put(placement.deviceId, projected.position, projected.surfaceKind, placement.rotation)
    }
    this.marker.visible = false
    if (drag) {
      const rotation = this.placements.find(item => item.deviceId === drag.deviceId)?.rotation ?? 0
      const projected = drag.placement && projectPlacement(template, drag.placement, tabletops)
      const position = projected?.position ?? (drag.position && this.clampToDiorama(drag.position))
      const surfaceKind = projected?.surfaceKind ?? drag.surfaceKind
      if (position && surfaceKind) {
        put(drag.deviceId, position, surfaceKind, rotation)
        this.showMarker(position, surfaceKind, Boolean(projected))
      }
    }
    for (const [kind, entry] of this.devices) {
      if (!placed.has(kind))
        entry.holder.visible = false
    }
  }

  private clampToDiorama(position: Vec3): Vec3 {
    const width = this.template?.width ?? 1600
    return {
      x: THREE.MathUtils.clamp(position.x, worldX(0, width), worldX(width, width)),
      y: THREE.MathUtils.clamp(position.y, 0, SCENE3D.height),
      z: THREE.MathUtils.clamp(position.z, 0, SCENE3D.depth),
    }
  }

  // Placement ----------------------------------------------------------------

  private buildSurfaceOverlays(template: HomeTemplate) {
    for (const overlay of this.surfaceOverlays)
      this.editRoot.remove(overlay.object)
    const tabletops = SCENE3D_TEMPLATES[template.id].tabletops
    const kit = this.templateKit
    this.surfaceOverlays = template.surfaces.map((surface) => {
      // Lift each overlay just clear of what it lies on: wall, rug or tabletop.
      const lift = surface.kind === 'wall' ? { y: 0, z: 0.014 - SCENE3D.wallOffset } : { y: surface.kind === 'floor' ? 0.032 : 0.008, z: 0 }
      const corners = surfaceCorners(surface, template.width, tabletops[surface.id])
        .map(corner => new THREE.Vector3(corner.x, corner.y + lift.y, corner.z + lift.z))
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

  private showMarker(position: Vec3, surfaceKind: HomeSurfaceKind, valid: boolean) {
    const wall = surfaceKind === 'wall'
    this.marker.visible = true
    this.marker.position.set(position.x, position.y + (wall ? 0 : 0.036), wall ? 0.02 : position.z)
    this.marker.rotation.set(wall ? 0 : -Math.PI / 2, 0, 0)
    for (const material of this.markerMaterials)
      material.color.set(valid ? EDIT_COLORS.surface : EDIT_COLORS.invalid)
  }

  /** Show where devices can go, for editing the layout. */
  setEditing(editing: boolean) {
    if (editing === this.editing)
      return
    this.editing = editing
    this.editRoot.visible = editing
    if (!editing)
      this.endDrag()
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
   * The plan point under a point of the canvas, on a surface that accepts
   * the device. Feed it to the placement rules to place the device there.
   *
   * @param deviceId - Device being placed
   * @param x - Canvas x in CSS pixels
   * @param y - Canvas y in CSS pixels
   * @returns The point in plan coordinates, or null when no surface is under the pointer
   */
  surfacePointAt(deviceId: DeviceKind, x: number, y: number): HomePoint | null {
    const template = this.template
    if (!template)
      return null
    return findSurfaceAlongRay(template, deviceId, this.rayAt(x, y), SCENE3D_TEMPLATES[template.id].tabletops)?.point ?? null
  }

  /**
   * Preview a device dragged to a point of the canvas: it moves to where a
   * drop would put it, or follows the pointer with a warning marker when the
   * spot is not allowed.
   *
   * @param deviceId - Device being dragged
   * @param x - Canvas x in CSS pixels
   * @param y - Canvas y in CSS pixels
   * @returns The plan point and whether a drop there would place the device
   */
  dragDevice(deviceId: DeviceKind, x: number, y: number): { point: HomePoint | null, valid: boolean } {
    const template = this.template
    if (!template)
      return { point: null, valid: false }
    const hit = findSurfaceAlongRay(template, deviceId, this.rayAt(x, y), SCENE3D_TEMPLATES[template.id].tabletops)
    const rotation = this.placements.find(item => item.deviceId === deviceId)?.rotation ?? 0
    const placement = hit ? createPlacementAtPoint(template, deviceId, hit.point, this.placements, rotation) : null
    this.drag = { deviceId, point: hit?.point ?? null, placement, position: hit?.position ?? null, surfaceKind: hit?.surface.kind ?? null }
    this.layoutDevices()
    this.styleSurfaceOverlays(performance.now() / 1000)
    this.invalidate()
    return { point: this.drag.point, valid: Boolean(placement) }
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
      this.dock.position.set(base.x, 0, Math.max(0.08, base.z - 0.32))
    }
    const points = this.robotRoute()
    if (!template || !this.robot.cleaning || points.length < 2)
      return
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map((point) => {
      const p = projectFloorPoint(point, template.width)
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
    const point = projectFloorPoint(current, template.width)
    const ahead = projectFloorPoint(next, template.width)
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
    this.orbit.targetYaw = 0
    this.orbit.targetPitch = 0
    this.reframe(false)
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
    this.basePitch = mobile ? MOBILE_PITCH : BASE_PITCH
    this.reframe(true)
  }

  /** Keep content clear of an overlay on the right, in CSS pixels. */
  setInsetRight(pixels: number) {
    if (pixels === this.insetRight)
      return
    this.insetRight = pixels
    this.reframe(false)
  }

  /** Turn the diorama a little, from a pointer drag in CSS pixels. */
  rotateBy(dx: number, dy: number) {
    this.orbit.targetYaw = THREE.MathUtils.clamp(this.orbit.targetYaw - dx * 0.0042, -0.5, 0.5)
    this.orbit.targetPitch = THREE.MathUtils.clamp(this.orbit.targetPitch + dy * 0.0028, -0.16, 0.32)
    this.invalidate()
  }

  private framePose(): CameraPose {
    const template = this.template
    const aspect = this.width / this.height
    const extent = template ? roomExtent(template, this.overview ? null : this.focusRoomId) : { x0: -8, x1: 8 }
    const width = extent.x1 - extent.x0 + (this.overview ? 0.9 : this.options.mobile ? 0.5 : 1.6)
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    const pitch = this.basePitch
    const visibleHeight = SCENE3D.height * Math.cos(pitch) + SCENE3D.depth * Math.sin(pitch) + 1.1
    // Leave room for the overlay by narrowing the usable width.
    const usable = Math.max(0.4, 1 - this.insetRight / this.width)
    const distance = Math.max(width / 2 / (tan * aspect * usable), visibleHeight / 2 / tan) + SCENE3D.depth * 0.45
    return {
      x: (extent.x0 + extent.x1) / 2,
      y: 1.2,
      z: SCENE3D.depth * 0.42,
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
    if (this.options.reducedMotion) {
      orbit.yaw = orbit.targetYaw
      orbit.pitch = orbit.targetPitch
    }
    else {
      orbit.yaw = approach(orbit.yaw, orbit.targetYaw, dt, 9)
      orbit.pitch = approach(orbit.pitch, orbit.targetPitch, dt, 9)
      busy = busy || Math.abs(orbit.yaw - orbit.targetYaw) > 0.0005 || Math.abs(orbit.pitch - orbit.targetPitch) > 0.0005
    }
    const yaw = orbit.yaw
    const pitch = this.basePitch + orbit.pitch
    const { x, y, z, distance, shift } = this.pose
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
   * @returns The device under the point, and the room it falls in
   */
  pick(x: number, y: number): { deviceId: DeviceKind | null, roomId: string | null } {
    const pointer = new THREE.Vector2(x / this.width * 2 - 1, -(y / this.height) * 2 + 1)
    this.raycaster.setFromCamera(pointer, this.camera)
    // Raycasting ignores visibility; skip devices hidden because they are not placed.
    const hit = this.raycaster.intersectObjects([this.deviceRoot, this.templateRoot], true).find(item => isShown(item.object))
    if (!hit || !this.template)
      return { deviceId: null, roomId: null }
    let object: THREE.Object3D | null = hit.object
    while (object && !object.userData.deviceId)
      object = object.parent
    return {
      deviceId: (object?.userData.deviceId as DeviceKind | undefined) ?? null,
      roomId: roomAtWorldX(this.template, hit.point.x),
    }
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.updateRouteDispose()
    this.templateKit.dispose()
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
