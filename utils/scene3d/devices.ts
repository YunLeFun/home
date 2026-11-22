import * as THREE from 'three'
import type { WarmerProfile } from '~/devices/hand-warmer/outline'
import { cloud, sleeve } from '~/devices/hand-warmer/outline'
import type { DeviceTone } from '~/devices/types'
import type { DeviceKind } from '~/types'
import type { Kit } from './kit'
import { PALETTE, TONE_COLORS } from './kit'

/** What a device model shows; derived from the device's state. */
export interface DeviceVisual {
  active: boolean
  tone: DeviceTone
  /** Fan speed, 1 to 3. */
  speed?: number
  oscillating?: boolean
  /** Short reading shown on the device, such as the AC's target temperature. */
  display?: string
}

export interface DeviceModel {
  kind: DeviceKind
  object: THREE.Group
  /** Where the hotspot sits, in the model's local space. */
  anchor: THREE.Vector3
  light?: THREE.PointLight
  setVisual: (visual: DeviceVisual) => void
  setVideoTexture?: (texture: THREE.VideoTexture | null) => void
  /**
   * Advance the model's own motion.
   *
   * @returns Whether the model is still moving
   */
  update: (dt: number, time: number, reducedMotion: boolean) => boolean
}

function approach(current: number, target: number, dt: number, rate: number) {
  return current + (target - current) * (1 - Math.exp(-dt * rate))
}

function toneColor(tone: DeviceTone) {
  return TONE_COLORS[tone] ?? TONE_COLORS.idle
}

function glowMaterial(kit: Kit, color: string) {
  return kit.ownMaterial(color, { roughness: 0.4, emissive: color, emissiveIntensity: 0 })
}

/** Three tapered streams share a mesh and leave nearby wall devices pickable. */
function outletAir(kit: Kit, flap: THREE.Group, flapLength: number) {
  const segments = 16
  const verticesPerStream = (segments + 1) * 3
  const positions = new THREE.Float32BufferAttribute(new Float32Array(3 * verticesPerStream * 3), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  const colors = []
  const indices = []
  for (let stream = 0; stream < 3; stream++) {
    for (let step = 0; step <= segments; step++) {
      const t = step / segments
      const alpha = Math.min(1, t * 7) * (1 - t * t)
      // A bright centre and transparent edges keep the air soft against walls and screens.
      colors.push(1, 1, 1, 0, 1, 1, 1, alpha, 1, 1, 1, 0)
      if (step < segments) {
        for (let side = 0; side < 2; side++) {
          const left = stream * verticesPerStream + step * 3 + side
          indices.push(left, left + 3, left + 1, left + 1, left + 3, left + 4)
        }
      }
    }
  }
  const geometry = kit.track(new THREE.BufferGeometry())
  geometry.setIndex(indices)
  geometry.setAttribute('position', positions)
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4))
  const material = kit.track(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }))
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.visible = false
  mesh.raycast = () => {}

  function shape(heating: boolean, time: number) {
    // The air passes over the blade from inside the outlet. Local +Z faces the room.
    const up = Math.cos(flap.rotation.x)
    const forward = Math.sin(flap.rotation.x)
    const lipY = flap.position.y + flapLength * 0.6 * up + 0.018
    const lipZ = flap.position.z + flapLength * 0.6 * forward
    let vertex = 0
    for (let lane = -1; lane <= 1; lane++) {
      for (let step = 0; step <= segments; step++) {
        const t = step / segments
        const wave = heating ? Math.sin(t * 7 - time * 1.8 + lane * 0.5) * 0.075 : Math.sin(t * 3 - time * 1.3) * 0.025
        const x = lane * (0.28 + 0.12 * t) + wave * t
        const travel = t * (lane === 0 ? 0.74 : 0.59)
        const y = lipY + travel * up - 0.12 * t * t
        const z = lipZ + travel * forward
        const halfWidth = 0.075 * (1 - t * t)
        positions.setXYZ(vertex++, x - halfWidth, y, z)
        positions.setXYZ(vertex++, x, y, z)
        positions.setXYZ(vertex++, x + halfWidth, y, z)
      }
    }
    positions.needsUpdate = true
  }
  return { mesh, material, shape }
}

function airConditioner(kit: Kit): DeviceModel {
  const white = kit.material('#fbfcfd', { roughness: 0.35 })
  const object = new THREE.Group()

  // Draw side sections in (depth, height) and extrude them along the width.
  function section(profile: THREE.Shape, width: number, bevel: number) {
    const geometry = kit.track(new THREE.ExtrudeGeometry(profile, {
      depth: width, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 4, curveSegments: 10,
    }))
    geometry.translate(0, 0, -width / 2)
    geometry.rotateY(-Math.PI / 2)
    return geometry
  }
  const housing = new THREE.Shape()
  housing.moveTo(0.024, 0.15)
  housing.lineTo(0.185, 0.15)
  housing.quadraticCurveTo(0.245, 0.15, 0.245, 0.092)
  housing.lineTo(0.245, -0.035)
  housing.quadraticCurveTo(0.245, -0.053, 0.235, -0.062)
  housing.lineTo(0.159, -0.061)
  housing.lineTo(0.109, -0.142)
  housing.lineTo(0.108, -0.153)
  housing.lineTo(0.024, -0.153)
  housing.closePath()
  object.add(kit.mesh(section(housing, 1.14, 0.019), white))

  const duct = new THREE.Shape()
  duct.moveTo(0.144, -0.15)
  duct.lineTo(0.192, -0.082)
  duct.lineTo(0.235, -0.076)
  duct.lineTo(0.189, -0.094)
  duct.lineTo(0.153, -0.15)
  duct.closePath()
  object.add(kit.mesh(section(duct, 1.025, 0.002), kit.material('#596970'), 0, 0.002, -0.012, false))
  const guide = new THREE.Shape()
  guide.moveTo(0.178, -0.087)
  guide.lineTo(0.217, -0.083)
  guide.quadraticCurveTo(0.203, -0.111, 0.162, -0.134)
  guide.closePath()
  const fin = section(guide, 0.007, 0.001)
  for (const x of [-0.36, -0.12, 0.12, 0.36])
    object.add(kit.mesh(fin, kit.material('#7b898c'), x, 0, -0.012, false))

  const socket = new THREE.Shape()
  socket.moveTo(0.12, -0.058)
  socket.lineTo(0.248, -0.058)
  socket.quadraticCurveTo(0.22, -0.149, 0.16, -0.167)
  socket.quadraticCurveTo(0.13, -0.177, 0.12, -0.15)
  socket.closePath()
  const endCap = section(socket, 0.054, 0.011)
  for (const x of [-0.551, 0.551])
    object.add(kit.mesh(endCap, white, x))

  const pivotZ = 0.151
  const pivotY = -0.16
  const axle = kit.mesh(kit.cylinder(0.012, 0.012, 1.054, 12), kit.material('#acb8bc'), 0, pivotY, pivotZ, false)
  axle.rotation.z = Math.PI / 2
  object.add(axle)

  const louver = new THREE.Group()
  const flapLength = 0.128
  const closedAngle = THREE.MathUtils.degToRad(51)
  const blade = new THREE.Shape()
  blade.moveTo(-0.006, 0)
  blade.quadraticCurveTo(-0.014, 0.058, -0.002, flapLength)
  blade.quadraticCurveTo(0.002, flapLength + 0.002, 0.004, flapLength - 0.003)
  blade.quadraticCurveTo(0.008, 0.055, 0.008, 0)
  blade.closePath()
  louver.position.set(0, pivotY, pivotZ)
  louver.rotation.x = closedAngle
  const vane = kit.mesh(section(blade, 1.018, 0.002), kit.material('#e8eef0', { roughness: 0.46 }))
  // The close-fitting lip sits within a shadow-map texel of the cover.
  vane.receiveShadow = false
  louver.add(vane)
  object.add(louver)
  const led = glowMaterial(kit, TONE_COLORS.idle)
  object.add(kit.mesh(kit.roundedBox(0.078, 0.021, 0.008, 0.003), led, 0.45, 0.06, 0.266, false))

  // Temperature readout drawn on a small canvas.
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 64
  const texture = kit.track(new THREE.CanvasTexture(canvas))
  texture.colorSpace = THREE.SRGBColorSpace
  const screen = kit.ownMaterial('#ffffff', { map: texture, roughness: 0.4, emissive: '#ffffff', emissiveIntensity: 0, transparent: true })
  screen.emissiveMap = texture
  object.add(kit.mesh(kit.plane(0.24, 0.12), screen, 0.24, 0.06, 0.268, false))

  const air = outletAir(kit, louver, flapLength)
  object.add(air.mesh)

  const light = new THREE.PointLight(TONE_COLORS.cool, 0, 2.6, 2)
  light.position.set(0, -0.6, 0.6)
  object.add(light)

  let visual: DeviceVisual = { active: false, tone: 'idle' }
  let flow = 0
  let heating = false
  let shown = ''
  function drawDisplay(text: string) {
    const context = canvas.getContext('2d')
    if (!context)
      return
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = toneColor(visual.tone)
    context.font = '600 44px ui-rounded, "SF Pro Rounded", system-ui, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(text, 64, 34)
    texture.needsUpdate = true
  }

  return {
    kind: 'air-conditioner',
    object,
    anchor: new THREE.Vector3(0, 0, 0.3),
    light,
    setVisual(next) {
      const toneChanged = visual.tone !== next.tone
      visual = next
      const color = toneColor(next.tone)
      led.color.set(color)
      led.emissive.set(color)
      led.emissiveIntensity = next.active ? 1.4 : 0
      if (next.tone === 'cool' || next.tone === 'heat') {
        heating = next.tone === 'heat'
        air.material.color.set(color)
        light.color.set(color)
      }
      const text = next.active ? (next.display ?? '') : ''
      if (text !== shown || toneChanged) {
        shown = text
        drawDisplay(text)
      }
      screen.emissiveIntensity = next.active ? 1 : 0
      screen.opacity = next.active ? 1 : 0
    },
    update(dt, time, reducedMotion) {
      const on = visual.active && (visual.tone === 'cool' || visual.tone === 'heat')
      const targetAngle = visual.active ? THREE.MathUtils.degToRad(visual.tone === 'heat' ? 127 : 94) : closedAngle
      const turn = approach(louver.rotation.x, targetAngle, dt, 6) - louver.rotation.x
      const angle = louver.rotation.x + THREE.MathUtils.clamp(turn, -dt * 1.6, dt * 1.6)
      louver.rotation.x = angle
      flow = approach(flow, on ? 1 : 0, dt, 3)
      light.intensity = flow * 0.9
      air.material.opacity = flow * 0.8 * THREE.MathUtils.smoothstep(angle, closedAngle + 0.14, closedAngle + 0.55)
      air.mesh.visible = air.material.opacity > 0.01
      if (air.mesh.visible)
        air.shape(heating, reducedMotion ? 0 : time)
      return Math.abs(angle - targetAngle) > 0.002 || Math.abs(flow - (on ? 1 : 0)) > 0.002 || (on && !reducedMotion)
    },
  }
}

function tvPicture(kit: Kit) {
  return kit.canvasTexture(256, 144, (context) => {
    const sky = context.createLinearGradient(0, 0, 0, 144)
    sky.addColorStop(0, '#7fb6ec')
    sky.addColorStop(1, '#e4f0fd')
    context.fillStyle = sky
    context.fillRect(0, 0, 256, 144)
    context.fillStyle = '#fff3c4'
    context.beginPath()
    context.arc(196, 42, 18, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#ffffff'
    for (const [x, y, r] of [[56, 40, 14], [74, 34, 18], [94, 42, 13], [140, 64, 10], [154, 58, 13], [168, 64, 9]]) {
      context.beginPath()
      context.arc(x!, y!, r!, 0, Math.PI * 2)
      context.fill()
    }
    context.fillStyle = '#9ccf9f'
    context.beginPath()
    context.moveTo(0, 112)
    context.quadraticCurveTo(70, 70, 150, 108)
    context.quadraticCurveTo(210, 84, 256, 100)
    context.lineTo(256, 144)
    context.lineTo(0, 144)
    context.fill()
    context.fillStyle = '#6fb07a'
    context.beginPath()
    context.moveTo(0, 130)
    context.quadraticCurveTo(110, 96, 256, 126)
    context.lineTo(256, 144)
    context.lineTo(0, 144)
    context.fill()
  })
}

function television(kit: Kit): DeviceModel {
  const object = new THREE.Group()
  object.add(kit.mesh(kit.roundedBox(1.52, 0.9, 0.07, 0.035), kit.material('#2b3342', { roughness: 0.45 }), 0, 0, 0.035))
  const picture = tvPicture(kit)
  const screen = kit.ownMaterial('#121722', { roughness: 0.22, metalness: 0.1, emissive: '#ffffff', emissiveIntensity: 0, map: null })
  screen.emissiveMap = picture
  object.add(kit.mesh(kit.plane(1.42, 0.8), screen, 0, 0.01, 0.0715, false))
  const videoMaterial = kit.track(new THREE.MeshBasicMaterial({ toneMapped: false }))
  const videoScreen = kit.mesh(kit.plane(1.42, 0.8), videoMaterial, 0, 0.01, 0.0725, false)
  videoScreen.visible = false
  object.add(videoScreen)
  const led = glowMaterial(kit, TONE_COLORS.idle)
  object.add(kit.mesh(kit.sphere(0.012, 10, 8), led, 0.66, -0.425, 0.07, false))
  const light = new THREE.PointLight('#cfe4ff', 0, 3.2, 2)
  light.position.set(0, 0, 0.9)
  object.add(light)
  let visual: DeviceVisual = { active: false, tone: 'idle' }
  let power = 0
  return {
    kind: 'television',
    object,
    anchor: new THREE.Vector3(0, 0, 0.1),
    light,
    setVideoTexture(texture) {
      videoMaterial.map = texture
      videoMaterial.needsUpdate = true
      videoScreen.visible = Boolean(texture)
      if (texture) {
        const { videoWidth, videoHeight } = texture.image as HTMLVideoElement
        const ratio = (videoWidth / videoHeight) / (1.42 / 0.8)
        videoScreen.scale.set(Math.min(1, ratio), Math.min(1, 1 / ratio), 1)
      }
    },
    setVisual(next) {
      visual = next
      led.emissive.set(next.active ? TONE_COLORS.active : '#ff6b6b')
      led.emissiveIntensity = 0.9
    },
    update(dt, time, reducedMotion) {
      power = approach(power, visual.active ? 1 : 0, dt, 6)
      const flicker = reducedMotion ? 1 : 0.92 + Math.sin(time * 7.3) * 0.04 + Math.sin(time * 2.1) * 0.04
      screen.emissiveIntensity = videoScreen.visible ? 0 : power * flicker
      screen.color.set(videoScreen.visible || power > 0.5 ? '#000000' : '#121722')
      light.intensity = power * 0.9 * flicker
      return Math.abs(power - (visual.active ? 1 : 0)) > 0.002 || (visual.active && !reducedMotion)
    },
  }
}

/** The ElectricFan blade outline (radius 90 in SVG units, y pointing down). */
function bladeShape() {
  const shape = new THREE.Shape()
  shape.moveTo(0, 10)
  shape.bezierCurveTo(16, 10, 29, 23, 29, 39)
  shape.bezierCurveTo(29, 67.2, 16, 90, 0, 90)
  shape.bezierCurveTo(-16, 90, -29, 67.2, -29, 39)
  shape.bezierCurveTo(-29, 23, -16, 10, 0, 10)
  return shape
}

const FAN_SPIN = [0, 9, 15, 23]

function fan(kit: Kit): DeviceModel {
  const white = kit.material('#fbfcfd', { roughness: 0.35 })
  const accent = kit.material(PALETTE.fabricDeep, { roughness: 0.4 })
  const object = new THREE.Group()
  object.add(kit.mesh(kit.cylinder(0.2, 0.22, 0.06, 32), white, 0, 0.03, 0))
  const buttons = [0, 1, 2].map((index) => {
    const material = glowMaterial(kit, TONE_COLORS.cool)
    object.add(kit.mesh(kit.cylinder(0.022, 0.022, 0.02, 12), material, -0.06 + index * 0.06, 0.065, 0.12, false))
    return material
  })
  object.add(kit.mesh(kit.cylinder(0.026, 0.03, 0.78, 14), white, 0, 0.45, 0))

  const head = new THREE.Group()
  head.position.set(0, 0.88, 0)
  object.add(head)
  const tilt = new THREE.Group()
  tilt.rotation.x = -0.08
  head.add(tilt)
  const motor = kit.mesh(kit.sphere(0.1, 24, 16), white, 0, 0, -0.06)
  motor.scale.set(1, 1, 1.3)
  tilt.add(motor)

  const blades = new THREE.Group()
  blades.position.z = 0.06
  const geometry = kit.custom('fan-blade', () => {
    const extruded = new THREE.ExtrudeGeometry(bladeShape(), { depth: 2.4, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.8, bevelSegments: 2, curveSegments: 14 })
    extruded.scale(0.0032, 0.0032, 0.0032)
    return extruded
  })
  const bladeMaterial = kit.material('#8cc8ee', { roughness: 0.3, transparent: true, opacity: 0.92 })
  for (let index = 0; index < 3; index++) {
    const pivot = new THREE.Group()
    pivot.rotation.z = (index / 3) * Math.PI * 2
    const blade = new THREE.Mesh(geometry, bladeMaterial)
    blade.castShadow = true
    // Pitch each petal about its own axis, like the 2D skew.
    blade.rotation.y = 0.32
    pivot.add(blade)
    blades.add(pivot)
  }
  blades.add(kit.mesh(kit.sphere(0.045, 18, 12), accent, 0, 0, 0.012))
  tilt.add(blades)

  const cage = kit.material('#e8edf3', { roughness: 0.4, metalness: 0.2 })
  tilt.add(kit.mesh(kit.torus(0.33, 0.012, Math.PI * 2, 8, 64), cage, 0, 0, 0.11, false))
  tilt.add(kit.mesh(kit.torus(0.33, 0.01, Math.PI * 2, 8, 64), cage, 0, 0, 0.0, false))
  tilt.add(kit.mesh(kit.torus(0.17, 0.007, Math.PI * 2, 6, 40), cage, 0, 0, 0.115, false))
  for (let index = 0; index < 8; index++) {
    const spoke = kit.mesh(kit.cylinder(0.005, 0.005, 0.33, 4), cage, 0, 0, 0.115, false)
    spoke.rotation.z = (index / 8) * Math.PI * 2
    spoke.position.set(Math.sin(-spoke.rotation.z) * 0.165, Math.cos(spoke.rotation.z) * 0.165, 0.115)
    tilt.add(spoke)
  }
  tilt.add(kit.mesh(kit.cylinder(0.05, 0.05, 0.02, 20), kit.material(PALETTE.ink, { roughness: 0.4 }), 0, 0, 0.12, false).rotateX(Math.PI / 2))

  let visual: DeviceVisual = { active: false, tone: 'idle' }
  let spin = 0
  let sway = 0
  let swayTime = 0
  return {
    kind: 'fan',
    object,
    anchor: new THREE.Vector3(0, 0.88, 0.12),
    setVisual(next) {
      visual = next
      buttons.forEach((material, index) => {
        material.emissiveIntensity = next.active && (next.speed ?? 1) === index + 1 ? 1.4 : 0
      })
    },
    update(dt, _time, reducedMotion) {
      const target = visual.active && !reducedMotion ? FAN_SPIN[visual.speed ?? 1] ?? 9 : 0
      spin = approach(spin, target, dt, target > spin ? 1.6 : 0.9)
      blades.rotation.z -= spin * dt
      const oscillate = visual.active && Boolean(visual.oscillating) && !reducedMotion
      if (oscillate)
        swayTime += dt
      sway = approach(sway, oscillate ? Math.sin(swayTime * 0.7) * 0.55 : 0, dt, 4)
      head.rotation.y = sway
      return spin > 0.05 || Math.abs(sway) > 0.002 || oscillate
    },
  }
}

function robotVacuum(kit: Kit): DeviceModel {
  const object = new THREE.Group()
  object.add(kit.mesh(kit.cylinder(0.27, 0.27, 0.075, 40), kit.material('#fbfcfd', { roughness: 0.35 }), 0, 0.05, 0))
  object.add(kit.mesh(kit.cylinder(0.275, 0.275, 0.04, 40, Math.PI * 0.9), kit.material('#5c6b80', { roughness: 0.5 }), 0, 0.035, 0).rotateY(Math.PI * 0.05 + Math.PI / 2))
  object.add(kit.mesh(kit.cylinder(0.19, 0.19, 0.014, 36), kit.material('#e3e9f1', { roughness: 0.4 }), 0, 0.093, -0.02, false))
  const ring = glowMaterial(kit, TONE_COLORS.idle)
  object.add(kit.mesh(kit.torus(0.07, 0.009, Math.PI * 2, 8, 32), ring, 0, 0.1, -0.04, false).rotateX(Math.PI / 2))
  const eye = kit.material(PALETTE.ink, { roughness: 0.3 })
  for (const side of [-1, 1]) {
    const mesh = kit.mesh(kit.sphere(0.02, 12, 8), eye, side * 0.055, 0.095, 0.17, false)
    mesh.scale.set(1, 1.5, 0.5)
    object.add(mesh)
  }
  const brush = new THREE.Group()
  brush.position.set(0.19, 0.012, 0.17)
  for (let index = 0; index < 3; index++) {
    const bristle = kit.mesh(kit.roundedBox(0.12, 0.006, 0.012, 0.002), kit.material('#8fa0b6'), 0.06, 0, 0, false)
    const arm = new THREE.Group()
    arm.rotation.y = (index / 3) * Math.PI * 2
    arm.add(bristle)
    brush.add(arm)
  }
  object.add(brush)
  let visual: DeviceVisual = { active: false, tone: 'idle' }
  return {
    kind: 'robot-vacuum',
    object,
    anchor: new THREE.Vector3(0, 0.12, 0),
    setVisual(next) {
      visual = next
      const color = toneColor(next.tone)
      ring.emissive.set(color)
      ring.color.set(color)
      ring.emissiveIntensity = next.active ? 1.5 : 0.25
    },
    update(dt, _time, reducedMotion) {
      if (visual.active && !reducedMotion)
        brush.rotation.y += dt * 14
      return visual.active && !reducedMotion
    },
  }
}

function handWarmer(kit: Kit): DeviceModel {
  const object = new THREE.Group()
  const body = kit.ownMaterial('#fff7e9', { roughness: 0.62, emissive: '#ffac64', emissiveIntensity: 0 })
  const knit = kit.ownMaterial('#ffba36', { roughness: 1, emissive: '#ff8b2c', emissiveIntensity: 0 })
  // Model in icon units so the lobes, sleeve and face keep the same proportions.
  const shell = new THREE.Group()
  shell.scale.setScalar(0.01)
  object.add(shell)
  function profileMesh(profile: WarmerProfile, depth: number, bevel: number, material: THREE.Material) {
    const shape = new THREE.Shape()
    shape.moveTo(profile.start[0], -profile.start[1])
    for (const [x1, y1, x2, y2, x, y] of profile.curves)
      shape.bezierCurveTo(x1, -y1, x2, -y2, x, -y)
    shape.closePath()
    const geometry = kit.track(new THREE.ExtrudeGeometry(shape, {
      depth, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 4, curveSegments: 10,
    }))
    return kit.mesh(geometry, material, -32, 53, -depth / 2)
  }
  shell.add(profileMesh(cloud, 9, 2.5, body), profileMesh(sleeve, 13, 1, knit))
  const blush = kit.material('#f99583', { roughness: 0.8 })
  const eye = kit.material(PALETTE.ink, { roughness: 0.3 })
  for (const side of [-1, 1]) {
    const pupil = kit.mesh(kit.sphere(1.5, 12, 8), eye, side * 6, 21, 7, false)
    pupil.scale.set(1, 1.3, 0.55)
    const cheek = kit.mesh(kit.sphere(2.6, 12, 8), blush, side * 11, 17, 7, false)
    cheek.scale.set(1, 0.62, 0.3)
    shell.add(pupil, cheek)
  }
  const smile = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-2, 17, 7.1), new THREE.Vector3(0, 15, 7.1), new THREE.Vector3(2, 17, 7.1))
  shell.add(kit.mesh(kit.track(new THREE.TubeGeometry(smile, 6, 0.65, 6, false)), eye, 0, 0, 0, false))
  const light = new THREE.PointLight('#ffa549', 0, 0.60, 2)
  light.position.set(0, 0.19, 0.04)
  object.add(light)
  let visual: DeviceVisual = { active: false, tone: 'idle' }
  let heat = 0
  return {
    kind: 'hand-warmer',
    object,
    anchor: new THREE.Vector3(0, 0.20, 0.08),
    light,
    setVisual(next) {
      visual = next
    },
    update(dt, time, reducedMotion) {
      heat = approach(heat, visual.active ? 1 : 0, dt, 3)
      const pulse = visual.active && !reducedMotion ? 0.82 + Math.sin(time * 2.4) * 0.18 : 1
      body.emissiveIntensity = heat * 0.48 * pulse
      knit.emissiveIntensity = heat * 1.1 * pulse
      light.intensity = heat * 0.75 * pulse
      return Math.abs(heat - (visual.active ? 1 : 0)) > 0.002 || (visual.active && !reducedMotion)
    },
  }
}

function nightLight(kit: Kit): DeviceModel {
  const object = new THREE.Group()
  const base = kit.mesh(kit.cylinder(0.147, 0.155, 0.05), kit.material(PALETTE.woodLight), 0, 0.025, 0)
  base.scale.z = 0.78
  const stem = kit.mesh(kit.cylinder(0.036, 0.045, 0.071), kit.material('#b89565', { metalness: 0.25 }), 0, 0.079, 0)
  const profile = new THREE.Shape()
  profile.moveTo(0.086, 0.47)
  profile.bezierCurveTo(-0.046, 0.49, -0.189, 0.413, -0.20, 0.27)
  profile.bezierCurveTo(-0.222, 0.127, -0.112, 0.05, 0.009, 0.061)
  profile.bezierCurveTo(0.097, 0.061, 0.174, 0.116, 0.207, 0.204)
  profile.bezierCurveTo(0.13, 0.149, 0.02, 0.171, -0.024, 0.248)
  profile.bezierCurveTo(-0.068, 0.336, -0.024, 0.424, 0.086, 0.47)
  const geometry = kit.track(new THREE.ExtrudeGeometry(profile, {
    depth: 0.075, bevelSize: 0.009, bevelThickness: 0.017, bevelSegments: 4, curveSegments: 14,
  }))
  const glass = kit.ownMaterial('#f7edda', { roughness: 0.55, emissive: '#ffcb79', emissiveIntensity: 0 })
  const shade = kit.mesh(geometry, glass, 0, 0.016, -0.0375)
  const light = new THREE.PointLight('#ffcb8c', 0, 2.8, 2)
  light.position.set(0, 0.32, 0.09)
  object.add(base, stem, shade, light)
  let lit = false
  let intensity = 0
  return {
    kind: 'night-light',
    object,
    anchor: new THREE.Vector3(-0.05, 0.25, 0.06),
    light,
    setVisual(next) { lit = next.active },
    update(dt, _time, reducedMotion) {
      const target = Number(lit)
      intensity = reducedMotion ? target : approach(intensity, target, dt, 9)
      if (Math.abs(intensity - target) < 0.002)
        intensity = target
      glass.emissiveIntensity = intensity * 1.65
      light.intensity = intensity * 2.35
      return intensity !== target
    },
  }
}

/** A charging dock for the robot vacuum. */
export function buildRobotDock(kit: Kit) {
  const object = new THREE.Group()
  object.add(kit.mesh(kit.roundedBox(0.4, 0.3, 0.14, 0.05), kit.material('#fbfcfd', { roughness: 0.35 }), 0, 0.15, 0))
  object.add(kit.mesh(kit.roundedBox(0.36, 0.02, 0.2, 0.008), kit.material('#5c6b80'), 0, 0.01, 0.12))
  object.add(kit.mesh(kit.sphere(0.014, 10, 8), kit.ownMaterial(TONE_COLORS.active, { emissive: TONE_COLORS.active, emissiveIntensity: 1.2 }), 0, 0.24, 0.072, false))
  return object
}

/**
 * Build the 3D model of a built-in device.
 *
 * @param kit - Resource kit for device models
 * @param kind - Device kind
 * @returns The model with its animation hooks
 */
export function buildDevice(kit: Kit, kind: DeviceKind): DeviceModel {
  switch (kind) {
    case 'air-conditioner': return airConditioner(kit)
    case 'television': return television(kit)
    case 'fan': return fan(kit)
    case 'robot-vacuum': return robotVacuum(kit)
    case 'hand-warmer': return handWarmer(kit)
    case 'night-light': return nightLight(kit)
  }
}
