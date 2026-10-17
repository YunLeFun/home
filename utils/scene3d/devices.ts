import * as THREE from 'three'
import type { DeviceTone } from '~/devices/types'
import type { DeviceKind } from '~/types'
import type { Kit} from './kit';
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

/** A soft round sprite for airflow particles. */
function dotTexture(kit: Kit) {
  return kit.canvasTexture(64, 64, (context) => {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.45)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 64, 64)
  })
}

function airConditioner(kit: Kit): DeviceModel {
  const white = kit.material('#fbfcfd', { roughness: 0.35 })
  const object = new THREE.Group()
  object.add(kit.mesh(kit.roundedBox(1.18, 0.36, 0.26, 0.11), white, 0, 0, 0.13))
  object.add(kit.mesh(kit.roundedBox(1.08, 0.04, 0.02, 0.01), kit.material('#e6ebf1', { roughness: 0.5 }), 0, -0.06, 0.262, false))
  // The louver opens downward when the AC runs.
  const louver = new THREE.Group()
  louver.position.set(0, -0.13, 0.25)
  louver.add(kit.mesh(kit.roundedBox(1.02, 0.07, 0.025, 0.012), kit.material('#eef2f6', { roughness: 0.4 }), 0, -0.035, 0, false))
  object.add(louver)
  const led = glowMaterial(kit, TONE_COLORS.idle)
  object.add(kit.mesh(kit.roundedBox(0.06, 0.022, 0.01, 0.009), led, 0.45, 0.08, 0.262, false))

  // Temperature readout drawn on a small canvas.
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 64
  const texture = kit.track(new THREE.CanvasTexture(canvas))
  texture.colorSpace = THREE.SRGBColorSpace
  const screen = kit.ownMaterial('#ffffff', { map: texture, roughness: 0.4, emissive: '#ffffff', emissiveIntensity: 0, transparent: true })
  screen.emissiveMap = texture
  object.add(kit.mesh(kit.plane(0.18, 0.09), screen, 0.36, 0.06, 0.262, false))

  const count = 42
  const positions = new Float32Array(count * 3)
  const seeds = Array.from({ length: count }, (_, index) => ({ x: ((index * 0.618) % 1) - 0.5, offset: (index * 0.137) % 1, drift: ((index * 0.381) % 1) - 0.5 }))
  const geometry = kit.track(new THREE.BufferGeometry())
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  // White with a per-particle alpha, so each puff fades in and out; the tone comes from the material.
  const fades = new Float32Array(count * 4).fill(1)
  geometry.setAttribute('color', new THREE.BufferAttribute(fades, 4))
  const airMaterial = kit.track(new THREE.PointsMaterial({ size: 0.2, map: dotTexture(kit), transparent: true, depthWrite: false, opacity: 0, color: TONE_COLORS.cool, vertexColors: true }))
  const air = new THREE.Points(geometry, airMaterial)
  air.frustumCulled = false
  object.add(air)

  const light = new THREE.PointLight(TONE_COLORS.cool, 0, 2.6, 2)
  light.position.set(0, -0.6, 0.6)
  object.add(light)

  let visual: DeviceVisual = { active: false, tone: 'idle' }
  let open = 0
  let flow = 0
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
      visual = next
      const color = toneColor(next.tone)
      led.color.set(color)
      led.emissive.set(color)
      led.emissiveIntensity = next.active ? 1.4 : 0
      airMaterial.color.set(color)
      light.color.set(color)
      const text = next.active ? (next.display ?? '') : ''
      if (text !== shown) {
        shown = text
        drawDisplay(text)
      }
      screen.emissiveIntensity = next.active ? 1 : 0
      screen.opacity = next.active ? 1 : 0
    },
    update(dt, time, reducedMotion) {
      const on = visual.active && (visual.tone === 'cool' || visual.tone === 'heat')
      open = approach(open, visual.active ? 1 : 0, dt, 5)
      flow = approach(flow, on ? 1 : 0, dt, 3)
      louver.rotation.x = open * 0.75
      light.intensity = flow * 0.9
      airMaterial.opacity = reducedMotion ? flow * 0.25 : flow * 0.5
      air.visible = flow > 0.01
      if (air.visible) {
        for (let index = 0; index < count; index++) {
          const seed = seeds[index]!
          const t = reducedMotion ? seed.offset : (time * 0.32 + seed.offset) % 1
          positions[index * 3] = seed.x * (1.0 + t * 0.6) + seed.drift * t * 0.3
          positions[index * 3 + 1] = -0.16 - t * 1.05 - t * t * 0.2
          positions[index * 3 + 2] = 0.3 + t * 1.15
          fades[index * 4 + 3] = Math.sin(t * Math.PI) ** 1.5
        }
        geometry.attributes.position!.needsUpdate = true
        geometry.attributes.color!.needsUpdate = true
      }
      return Math.abs(open - (visual.active ? 1 : 0)) > 0.002 || Math.abs(flow - (on ? 1 : 0)) > 0.002 || (on && !reducedMotion)
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
    setVisual(next) {
      visual = next
      led.emissive.set(next.active ? TONE_COLORS.active : '#ff6b6b')
      led.emissiveIntensity = 0.9
    },
    update(dt, time, reducedMotion) {
      power = approach(power, visual.active ? 1 : 0, dt, 6)
      const flicker = reducedMotion ? 1 : 0.92 + Math.sin(time * 7.3) * 0.04 + Math.sin(time * 2.1) * 0.04
      screen.emissiveIntensity = power * flicker
      screen.color.set(power > 0.5 ? '#000000' : '#121722')
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
  const body = kit.ownMaterial('#fff1e2', { roughness: 0.55, emissive: '#ff9a52', emissiveIntensity: 0 })
  const pebble = kit.mesh(kit.sphere(0.1, 28, 20), body, 0, 0.12, 0)
  pebble.scale.set(1, 1.2, 0.7)
  object.add(pebble)
  // A knitted sleeve around the base.
  object.add(kit.mesh(kit.cylinder(0.103, 0.09, 0.07, 28), kit.material(PALETTE.sun, { roughness: 1 }), 0, 0.05, 0))
  const blush = kit.material('#ffb3a7', { roughness: 0.8 })
  const eye = kit.material(PALETTE.ink, { roughness: 0.3 })
  for (const side of [-1, 1]) {
    const mesh = kit.mesh(kit.sphere(0.011, 10, 8), eye, side * 0.032, 0.15, 0.066, false)
    mesh.scale.set(1, 1.4, 0.6)
    object.add(mesh)
    const cheek = kit.mesh(kit.sphere(0.014, 10, 8), blush, side * 0.055, 0.125, 0.06, false)
    cheek.scale.set(1, 0.6, 0.4)
    object.add(cheek)
  }
  const light = new THREE.PointLight('#ffb06b', 0, 1.6, 2)
  light.position.set(0, 0.2, 0.2)
  object.add(light)
  let visual: DeviceVisual = { active: false, tone: 'idle' }
  let heat = 0
  return {
    kind: 'hand-warmer',
    object,
    anchor: new THREE.Vector3(0, 0.16, 0.05),
    light,
    setVisual(next) {
      visual = next
    },
    update(dt, time, reducedMotion) {
      heat = approach(heat, visual.active ? 1 : 0, dt, 3)
      const pulse = visual.active && !reducedMotion ? 0.82 + Math.sin(time * 2.4) * 0.18 : 1
      body.emissiveIntensity = heat * 0.55 * pulse
      light.intensity = heat * 0.7 * pulse
      return Math.abs(heat - (visual.active ? 1 : 0)) > 0.002 || (visual.active && !reducedMotion)
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
  }
}
