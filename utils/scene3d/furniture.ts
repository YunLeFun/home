import * as THREE from 'three'
import type { FurnitureSpec } from '~/constants/scene3d'
import { SCENE3D } from './projection'
import type { Kit} from './kit';
import { PALETTE } from './kit'

/** A lamp whose glow follows the time of day. */
export interface SceneLamp {
  light: THREE.PointLight
  shade: THREE.MeshStandardMaterial
  /** Peak light intensity at night. */
  intensity: number
}

/** Materials the lighting phase recolours. */
export interface PhaseTargets {
  sky: THREE.MeshBasicMaterial
  cloud: THREE.MeshBasicMaterial
  beams: THREE.MeshBasicMaterial[]
}

export interface BuiltFurniture {
  object: THREE.Object3D
  lamp?: SceneLamp
  /** Ambient motion, called with seconds since start. */
  tick?: (time: number) => void
}

function group(...children: THREE.Object3D[]) {
  const result = new THREE.Group()
  if (children.length)
    result.add(...children)
  return result
}

function legs(kit: Kit, width: number, depth: number, height: number, radius = 0.03, inset = 0.1, color: string = PALETTE.wood) {
  const material = kit.material(color, { roughness: 0.7 })
  const geometry = kit.cylinder(radius, radius * 0.75, height, 12)
  const result = group()
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1])
      result.add(kit.mesh(geometry, material, sx * (width / 2 - inset), height / 2, sz * (depth / 2 - inset)))
  }
  return result
}

function sofa(kit: Kit, spec: FurnitureSpec): BuiltFurniture {
  const w = spec.w ?? 3
  const d = spec.d ?? 0.95
  const fabric = kit.material(PALETTE.fabric, { roughness: 0.95 })
  const deep = kit.material(PALETTE.fabricDeep, { roughness: 0.95 })
  const object = group(legs(kit, w - 0.1, d - 0.1, 0.1, 0.035, 0.12))
  object.add(kit.mesh(kit.roundedBox(w, 0.26, d, 0.09), deep, 0, 0.23, 0))
  const cushions = w > 3.4 ? 3 : 2
  const inner = w - 0.56
  const cushionWidth = inner / cushions - 0.04
  for (let index = 0; index < cushions; index++) {
    const x = -inner / 2 + (index + 0.5) * (inner / cushions)
    object.add(kit.mesh(kit.roundedBox(cushionWidth, 0.17, d - 0.3, 0.075), fabric, x, 0.43, 0.1))
    object.add(kit.mesh(kit.roundedBox(cushionWidth, 0.46, 0.24, 0.1), fabric, x, 0.66, -d / 2 + 0.2))
  }
  for (const side of [-1, 1])
    object.add(kit.mesh(kit.roundedBox(0.28, 0.5, d, 0.12), deep, side * (w / 2 - 0.14), 0.4, 0))
  const pillows = [
    { color: PALETTE.accent, x: -inner / 2 + 0.28, rotation: 0.22 },
    { color: PALETTE.sun, x: inner / 2 - 0.28, rotation: -0.18 },
  ]
  for (const pillow of pillows) {
    const mesh = kit.mesh(kit.roundedBox(0.4, 0.36, 0.13, 0.065), kit.material(pillow.color, { roughness: 0.95 }), pillow.x, 0.66, -d / 2 + 0.38)
    mesh.rotation.set(-0.18, 0, pillow.rotation)
    object.add(mesh)
  }
  return { object }
}

function coffeeTable(kit: Kit, spec: FurnitureSpec): BuiltFurniture {
  const w = spec.w ?? 2
  const d = spec.d ?? 0.9
  const h = spec.h ?? 0.44
  const top = kit.material(PALETTE.woodLight, { roughness: 0.6 })
  const object = group(legs(kit, w, d, h - 0.06, 0.04, 0.14))
  object.add(kit.mesh(kit.roundedBox(w, 0.07, d, 0.035), top, 0, h - 0.035, 0))
  object.add(kit.mesh(kit.roundedBox(w - 0.3, 0.04, d - 0.3, 0.02), kit.material(PALETTE.wood, { roughness: 0.7 }), 0, 0.14, 0))
  // A small stack of books at the far end leaves the centre free for devices.
  const books = [PALETTE.fabricDeep, PALETTE.accent]
  books.forEach((color, index) => {
    const book = kit.mesh(kit.roundedBox(0.34, 0.05, 0.24, 0.012), kit.material(color, { roughness: 0.8 }), -w / 2 + 0.3, h + 0.025 + index * 0.05, -0.08)
    book.rotation.y = index * 0.25 - 0.1
    object.add(book)
  })
  object.add(kit.mesh(kit.cylinder(0.05, 0.045, 0.1, 18), kit.material(PALETTE.ceramic, { roughness: 0.3 }), -w / 2 + 0.62, h + 0.05, 0.12))
  return { object }
}

function cabinet(kit: Kit, w: number, d: number, h: number, drawers: number) {
  const body = kit.material(PALETTE.oat, { roughness: 0.75 })
  const front = kit.material(PALETTE.woodLight, { roughness: 0.65 })
  const knob = kit.material(PALETTE.wood, { roughness: 0.5 })
  const object = group(legs(kit, w, d, 0.08, 0.025, 0.1))
  object.add(kit.mesh(kit.roundedBox(w, h - 0.08, d, 0.04), body, 0, 0.08 + (h - 0.08) / 2, 0))
  const gap = 0.05
  const drawerWidth = (w - gap * (drawers + 1)) / drawers
  for (let index = 0; index < drawers; index++) {
    const x = -w / 2 + gap + drawerWidth / 2 + index * (drawerWidth + gap)
    object.add(kit.mesh(kit.roundedBox(drawerWidth, h - 0.2, 0.03, 0.012), front, x, 0.08 + (h - 0.08) / 2, d / 2))
    object.add(kit.mesh(kit.sphere(0.022, 12, 8), knob, x, 0.08 + (h - 0.08) / 2 + 0.06, d / 2 + 0.025))
  }
  return object
}

function consoleUnit(kit: Kit, spec: FurnitureSpec): BuiltFurniture {
  const w = spec.w ?? 2
  return { object: cabinet(kit, w, spec.d ?? 0.48, spec.h ?? 0.5, w > 1.6 ? 3 : 2) }
}

function nightstand(kit: Kit, spec: FurnitureSpec): BuiltFurniture {
  return { object: cabinet(kit, spec.w ?? 0.9, spec.d ?? 0.6, spec.h ?? 0.62, 1) }
}

function lampShade(kit: Kit, radiusTop: number, radiusBottom: number, height: number): [THREE.Mesh, THREE.MeshStandardMaterial] {
  const shade = kit.ownMaterial(PALETTE.shade, { roughness: 0.9, emissive: '#ffcf8a', emissiveIntensity: 0, side: THREE.DoubleSide })
  const geometry = kit.cylinder(radiusTop, radiusBottom, height, 28)
  return [kit.mesh(geometry, shade, 0, 0, 0, false), shade]
}

function lampLight(intensity: number, distance: number) {
  const light = new THREE.PointLight('#ffc98a', 0, distance, 2)
  light.userData.peak = intensity
  return light
}

function tableLamp(kit: Kit): BuiltFurniture {
  const ceramic = kit.material(PALETTE.accent, { roughness: 0.4 })
  const object = group(kit.mesh(kit.sphere(0.09, 20, 14), ceramic, 0, 0.09, 0))
  object.add(kit.mesh(kit.cylinder(0.012, 0.012, 0.16, 8), kit.material(PALETTE.metal, { roughness: 0.4, metalness: 0.4 }), 0, 0.24, 0))
  const [shade, material] = lampShade(kit, 0.09, 0.16, 0.18)
  shade.position.y = 0.38
  object.add(shade)
  const light = lampLight(1.6, 3.2)
  light.position.set(0, 0.36, 0.08)
  object.add(light)
  return { object, lamp: { light, shade: material, intensity: 1.6 } }
}

function floorLamp(kit: Kit): BuiltFurniture {
  const metal = kit.material(PALETTE.ink, { roughness: 0.45, metalness: 0.3 })
  const object = group(kit.mesh(kit.cylinder(0.17, 0.19, 0.04, 28), metal, 0, 0.02, 0))
  object.add(kit.mesh(kit.cylinder(0.016, 0.016, 1.42, 10), metal, 0, 0.75, 0))
  const [shade, material] = lampShade(kit, 0.14, 0.24, 0.3)
  shade.position.y = 1.52
  object.add(shade)
  const light = lampLight(2.6, 4.2)
  light.position.set(0, 1.42, 0.1)
  object.add(light)
  return { object, lamp: { light, shade: material, intensity: 2.6 } }
}

function pendant(kit: Kit, spec: FurnitureSpec): BuiltFurniture {
  const y = spec.y ?? 1.6
  const object = group()
  const cord = SCENE3D.height - y
  object.add(kit.mesh(kit.cylinder(0.006, 0.006, cord, 6), kit.material(PALETTE.ink), 0, cord / 2, 0, false))
  const shade = kit.ownMaterial(PALETTE.sun, { roughness: 0.6, emissive: '#ffcf8a', emissiveIntensity: 0, side: THREE.DoubleSide })
  const dome = kit.mesh(kit.sphere(0.2, 28, 12, Math.PI / 2), shade, 0, -0.12, 0)
  object.add(dome)
  object.add(kit.mesh(kit.sphere(0.06, 14, 10), kit.ownMaterial('#fff6e0', { emissive: '#ffe1a8', emissiveIntensity: 0.6 }), 0, -0.13, 0, false))
  const light = lampLight(2.4, 4.4)
  light.position.set(0, -0.3, 0)
  object.add(light)
  // The group's origin is the bulb; the cord rises to the top of the wall.
  return { object, lamp: { light, shade, intensity: 2.4 } }
}

function plant(kit: Kit, spec: FurnitureSpec): BuiltFurniture {
  const tall = spec.variant === 'tall'
  const bush = spec.variant === 'bush'
  const potHeight = tall ? 0.38 : 0.3
  const object = group(kit.mesh(kit.cylinder(0.17, 0.13, potHeight, 24), kit.material(PALETTE.pot, { roughness: 0.6 }), 0, potHeight / 2, 0))
  object.add(kit.mesh(kit.cylinder(0.155, 0.155, 0.02, 20), kit.material('#8a6446', { roughness: 1 }), 0, potHeight - 0.01, 0, false))
  const foliage = group()
  foliage.position.y = potHeight
  const colors: string[] = [PALETTE.leaf, PALETTE.leafDeep, PALETTE.leafLight]
  if (bush) {
    const blobs = [[0, 0.24, 0, 0.26], [-0.16, 0.16, 0.06, 0.18], [0.17, 0.18, 0.04, 0.19], [0.02, 0.4, -0.04, 0.17]] as const
    blobs.forEach(([x, y, z, r], index) => foliage.add(kit.mesh(kit.sphere(r, 20, 14), kit.material(colors[index % 3]!, { roughness: 0.9 }), x, y, z)))
  }
  else {
    const count = tall ? 7 : 6
    for (let index = 0; index < count; index++) {
      const angle = (index / count) * Math.PI * 2
      const leaf = new THREE.Mesh(kit.sphere(0.1, 16, 10), kit.material(colors[index % 3]!, { roughness: 0.85 }))
      leaf.castShadow = true
      const length = tall ? 0.42 : 0.3
      leaf.scale.set(0.55, length / 0.1 / 2, 0.22)
      const pivot = group(leaf)
      leaf.position.y = length / 2
      pivot.rotation.set(Math.sin(angle) * 0.55, angle, Math.cos(angle) * 0.55)
      foliage.add(pivot)
    }
    foliage.add(kit.mesh(kit.sphere(0.08, 14, 10), kit.material(PALETTE.leafLight, { roughness: 0.85 }), 0, tall ? 0.48 : 0.34, 0))
  }
  object.add(foliage)
  const phase = spec.x * 1.7
  return {
    object,
    tick: (time) => {
      foliage.rotation.z = Math.sin(time * 0.9 + phase) * 0.035
      foliage.rotation.x = Math.sin(time * 0.7 + phase) * 0.02
    },
  }
}

function rug(kit: Kit, spec: FurnitureSpec): BuiltFurniture {
  const w = spec.w ?? 3
  const d = spec.d ?? 2
  const radius = Math.min(w, d) * 0.45
  const object = group(kit.mesh(kit.roundedSlab(w, d, radius, 0.012), kit.material(PALETTE.rugBorder, { roughness: 1 }), 0, 0, 0))
  object.add(kit.mesh(kit.roundedSlab(w - 0.22, d - 0.22, radius * 0.9, 0.016), kit.material(PALETTE.rug, { roughness: 1 }), 0, 0, 0))
  object.traverse((child) => {
    child.castShadow = false
  })
  return { object }
}

function bed(kit: Kit, spec: FurnitureSpec): BuiltFurniture {
  const w = spec.w ?? 3
  const d = spec.d ?? 2.6
  const wood = kit.material(PALETTE.wood, { roughness: 0.65 })
  const linen = kit.material(PALETTE.linen, { roughness: 0.95 })
  const object = group(legs(kit, w, d, 0.1, 0.035, 0.14))
  object.add(kit.mesh(kit.roundedBox(w, 0.24, d, 0.06), wood, 0, 0.22, 0))
  object.add(kit.mesh(kit.roundedBox(w - 0.1, 0.2, d - 0.14, 0.09), linen, 0, 0.43, 0.02))
  const duvetDepth = d * 0.62
  object.add(kit.mesh(kit.roundedBox(w - 0.02, 0.13, duvetDepth, 0.065), kit.material(PALETTE.duvet, { roughness: 0.95 }), 0, 0.56, d / 2 - duvetDepth / 2 - 0.02))
  object.add(kit.mesh(kit.roundedBox(w + 0.01, 0.09, 0.22, 0.045), kit.material(PALETTE.duvetFold, { roughness: 0.95 }), 0, 0.6, d / 2 - duvetDepth - 0.06))
  for (const side of [-1, 1]) {
    const pillow = kit.mesh(kit.roundedBox(w * 0.36, 0.15, 0.42, 0.075), linen, side * w * 0.22, 0.6, -d / 2 + 0.36)
    pillow.rotation.x = -0.12
    object.add(pillow)
  }
  object.add(kit.mesh(kit.roundedBox(w + 0.12, 1.06, 0.14, 0.07), kit.material(PALETTE.fabricDeep, { roughness: 0.95 }), 0, 0.53, -d / 2 + 0.02))
  object.add(kit.mesh(kit.roundedBox(w + 0.16, 0.08, 0.18, 0.035), wood, 0, 1.08, -d / 2 + 0.02))
  return { object }
}

function shelf(kit: Kit, spec: FurnitureSpec): BuiltFurniture {
  const w = spec.w ?? 2.4
  const board = kit.material(PALETTE.woodLight, { roughness: 0.6 })
  const object = group()
  const palette = [PALETTE.accent, PALETTE.fabricDeep, PALETTE.sun, PALETTE.leaf, PALETTE.fabric, PALETTE.oat]
  for (const [level, y] of [0, 0.56].entries()) {
    object.add(kit.mesh(kit.roundedBox(w, 0.05, 0.3, 0.02), board, 0, y, 0.15))
    let x = -w / 2 + 0.16
    let index = level * 2
    while (x < w / 2 - 0.3) {
      const width = 0.07 + ((index * 37) % 5) * 0.012
      const height = 0.26 + ((index * 53) % 4) * 0.035
      if ((index + level) % 6 === 4) {
        // A small succulent every few books.
        object.add(kit.mesh(kit.cylinder(0.07, 0.055, 0.1, 16), kit.material(PALETTE.ceramic, { roughness: 0.4 }), x + 0.08, y + 0.075, 0.15))
        object.add(kit.mesh(kit.sphere(0.075, 14, 10), kit.material(PALETTE.leaf, { roughness: 0.9 }), x + 0.08, y + 0.16, 0.15))
        x += 0.24
      }
      else {
        const book = kit.mesh(kit.roundedBox(width, height, 0.22, 0.01), kit.material(palette[index % palette.length]!, { roughness: 0.8 }), x + width / 2, y + 0.025 + height / 2, 0.15)
        if (index % 7 === 3)
          book.rotation.z = -0.18
        object.add(book)
        x += width + 0.015
      }
      index++
    }
  }
  return { object }
}

function laundry(kit: Kit, spec: FurnitureSpec): BuiltFurniture {
  const w = spec.w ?? 3.3
  const d = spec.d ?? 0.68
  const h = spec.h ?? 0.9
  const white = kit.material(PALETTE.ceramic, { roughness: 0.35 })
  const object = group(kit.mesh(kit.roundedBox(w + 0.06, 0.06, d + 0.04, 0.025), kit.material(PALETTE.woodLight, { roughness: 0.55 }), 0, h - 0.03, 0))
  const unit = 0.66
  for (const [index, x] of [-w / 2 + unit / 2 + 0.04, -w / 2 + unit * 1.5 + 0.08].entries()) {
    object.add(kit.mesh(kit.roundedBox(unit, h - 0.08, d - 0.04, 0.05), white, x, (h - 0.08) / 2 + 0.01, 0))
    object.add(kit.mesh(kit.torus(0.2, 0.03, Math.PI * 2, 10, 32), kit.material(PALETTE.metal, { roughness: 0.3, metalness: 0.5 }), x, h * 0.45, d / 2 - 0.01))
    const glass = kit.mesh(kit.cylinder(0.19, 0.19, 0.02, 28), kit.material(index === 0 ? '#bfdcf3' : '#d9e3ee', { roughness: 0.15 }), x, h * 0.45, d / 2 - 0.02, false)
    glass.rotation.x = Math.PI / 2
    object.add(glass)
    object.add(kit.mesh(kit.roundedBox(unit - 0.12, 0.06, 0.02, 0.01), kit.material(PALETTE.oat), x, h - 0.15, d / 2 - 0.01, false))
  }
  const rest = w - unit * 2 - 0.16
  if (rest > 0.4) {
    const doors = group(cabinet(kit, rest, d - 0.04, h - 0.06, rest > 1.2 ? 2 : 1))
    doors.position.x = w / 2 - rest / 2 - 0.02
    object.add(doors)
  }
  return { object }
}

function basket(kit: Kit): BuiltFurniture {
  const object = group(kit.mesh(kit.cylinder(0.26, 0.21, 0.36, 24), kit.material(PALETTE.basket, { roughness: 1 }), 0, 0.18, 0))
  object.add(kit.mesh(kit.torus(0.255, 0.025, Math.PI * 2, 8, 32), kit.material(PALETTE.wood, { roughness: 0.9 }), 0, 0.35, 0).rotateX(Math.PI / 2))
  const towel = kit.mesh(kit.roundedBox(0.34, 0.12, 0.24, 0.05), kit.material(PALETTE.fabric, { roughness: 1 }), 0.02, 0.38, 0)
  towel.rotation.z = 0.2
  object.add(towel)
  object.add(kit.mesh(kit.roundedBox(0.3, 0.1, 0.22, 0.045), kit.material(PALETTE.duvetFold, { roughness: 1 }), -0.04, 0.46, 0.02).rotateZ(-0.12))
  return { object }
}

function desk(kit: Kit, spec: FurnitureSpec): BuiltFurniture {
  const w = spec.w ?? 3
  const d = spec.d ?? 0.8
  const h = spec.h ?? 0.76
  const object = group(legs(kit, w, d, h - 0.05, 0.03, 0.08, PALETTE.ink))
  object.add(kit.mesh(kit.roundedBox(w, 0.06, d, 0.03), kit.material(PALETTE.woodLight, { roughness: 0.55 }), 0, h - 0.03, 0))
  const drawers = group(cabinet(kit, 0.6, d - 0.1, h - 0.14, 1))
  drawers.position.set(w / 2 - 0.4, 0, 0)
  object.add(drawers)
  object.add(kit.mesh(kit.cylinder(0.05, 0.045, 0.14, 14), kit.material(PALETTE.accent, { roughness: 0.45 }), -w / 2 + 0.24, h + 0.07, -0.12))
  object.add(kit.mesh(kit.roundedBox(0.4, 0.04, 0.28, 0.012), kit.material(PALETTE.fabricDeep), -w / 2 + 0.58, h + 0.02, -0.1).rotateY(0.15))
  // A chair tucked in front of the desk.
  const chair = group(legs(kit, 0.5, 0.5, 0.44, 0.02, 0.05, PALETTE.ink))
  chair.add(kit.mesh(kit.roundedBox(0.54, 0.08, 0.5, 0.04), kit.material(PALETTE.fabric, { roughness: 0.95 }), 0, 0.46, 0))
  chair.add(kit.mesh(kit.roundedBox(0.52, 0.42, 0.07, 0.035), kit.material(PALETTE.fabric, { roughness: 0.95 }), 0, 0.72, 0.24))
  chair.position.set(-0.3, 0, d / 2 + 0.3)
  chair.rotation.y = 0.2
  object.add(chair)
  return { object }
}

function clock(kit: Kit, spec: FurnitureSpec): BuiltFurniture {
  const r = (spec.w ?? 0.6) / 2
  const face = kit.mesh(kit.cylinder(r, r, 0.04, 40), kit.material(PALETTE.ceramic, { roughness: 0.5 }), 0, 0, 0.02)
  face.rotation.x = Math.PI / 2
  const object = group(face, kit.mesh(kit.torus(r, 0.028, Math.PI * 2, 10, 48), kit.material(PALETTE.accent, { roughness: 0.5 }), 0, 0, 0.04))
  const tick = kit.material(PALETTE.ink)
  for (let index = 0; index < 12; index++) {
    const angle = (index / 12) * Math.PI * 2
    const long = index % 3 === 0
    const mark = kit.mesh(kit.roundedBox(0.018, long ? 0.07 : 0.035, 0.01, 0.004), tick, Math.sin(angle) * r * 0.8, Math.cos(angle) * r * 0.8, 0.045, false)
    mark.rotation.z = -angle
    object.add(mark)
  }
  const hand = (length: number, width: number, z: number, color: string) => {
    const mesh = kit.mesh(kit.roundedBox(width, length, 0.01, width / 2 - 0.001), kit.material(color), 0, length / 2 - 0.02, 0, false)
    const pivot = group(mesh)
    pivot.position.z = z
    object.add(pivot)
    return pivot
  }
  const hour = hand(r * 0.5, 0.028, 0.05, PALETTE.ink)
  const minute = hand(r * 0.74, 0.02, 0.056, PALETTE.ink)
  object.add(kit.mesh(kit.sphere(0.022, 12, 8), kit.material(PALETTE.accent), 0, 0, 0.06, false))
  return {
    object,
    tick: () => {
      const now = new Date()
      const minutes = now.getMinutes() + now.getSeconds() / 60
      minute.rotation.z = -(minutes / 60) * Math.PI * 2
      hour.rotation.z = -(((now.getHours() % 12) + minutes / 60) / 12) * Math.PI * 2
    },
  }
}

function moonGate(kit: Kit, spec: FurnitureSpec): BuiltFurniture {
  const r = (spec.w ?? 1.2) / 2
  const mirror = kit.mesh(kit.cylinder(r, r, 0.02, 48), kit.material('#f1f6fc', { roughness: 0.15, metalness: 0.1 }), 0, 0, 0.012, false)
  mirror.rotation.x = Math.PI / 2
  const object = group(mirror, kit.mesh(kit.torus(r, 0.055, Math.PI * 2, 12, 64), kit.material(PALETTE.wood, { roughness: 0.6 }), 0, 0, 0.04))
  return { object }
}

function windowFrame(kit: Kit, spec: FurnitureSpec, targets: PhaseTargets): BuiltFurniture {
  const w = spec.w ?? 2
  const h = spec.h ?? 1.4
  const arch = spec.variant === 'arch'
  const trim = kit.material(PALETTE.trim, { roughness: 0.55 })
  const object = group()
  const straight = arch ? h - w / 2 : h
  const glass = kit.mesh(kit.plane(w - 0.08, straight - 0.04), targets.sky, 0, straight / 2, 0.012, false)
  object.add(glass)
  if (arch) {
    const dome = kit.mesh(kit.custom(`arch:${w}`, () => new THREE.CircleGeometry(w / 2 - 0.04, 40, 0, Math.PI)), targets.sky, 0, straight - 0.02, 0.012, false)
    object.add(dome)
    object.add(kit.mesh(kit.torus(w / 2 - 0.02, 0.045, Math.PI, 10, 40), trim, 0, straight - 0.02, 0.05))
  }
  else {
    object.add(kit.mesh(kit.roundedBox(w + 0.06, 0.08, 0.1, 0.03), trim, 0, h, 0.05))
  }
  for (const side of [-1, 1])
    object.add(kit.mesh(kit.roundedBox(0.08, straight, 0.1, 0.03), trim, side * (w / 2 - 0.01), straight / 2, 0.05))
  object.add(kit.mesh(kit.roundedBox(0.04, straight - 0.04, 0.06, 0.015), trim, 0, straight / 2, 0.04))
  object.add(kit.mesh(kit.roundedBox(w, 0.035, 0.06, 0.015), trim, 0, straight * 0.56, 0.04))
  object.add(kit.mesh(kit.roundedBox(w + 0.22, 0.06, 0.2, 0.025), trim, 0, -0.02, 0.1))
  // Two soft clouds behind the glass.
  for (const [cx, cy, scale] of [[-w * 0.22, straight * 0.72, 1], [w * 0.2, straight * 0.4, 0.75]] as const) {
    const cloud = group()
    for (const [x, y, r] of [[-0.12, 0, 0.09], [0, 0.04, 0.12], [0.13, 0, 0.085]] as const)
      cloud.add(kit.mesh(kit.sphere(r, 16, 10), targets.cloud, x, y, 0, false))
    cloud.scale.set(scale, scale, 0.12)
    cloud.position.set(cx, cy, 0.02)
    object.add(cloud)
  }
  // Curtains gathered at both sides.
  const curtains: THREE.Mesh[] = []
  for (const side of [-1, 1]) {
    const curtain = kit.mesh(kit.roundedBox(w * 0.16, h + 0.16, 0.06, 0.03), kit.material(PALETTE.oat, { roughness: 1 }), side * (w / 2 + w * 0.05), (h + 0.16) / 2 - 0.08, 0.14)
    curtains.push(curtain)
    object.add(curtain)
  }
  object.add(kit.mesh(kit.cylinder(0.018, 0.018, w + w * 0.4, 10), kit.material(PALETTE.wood), 0, h + 0.12, 0.15, false).rotateZ(Math.PI / 2))
  // A sunbeam falling from the window across the floor.
  const beamMaterial = targets.beams[0]
  if (beamMaterial) {
    const beam = new THREE.Mesh(kit.custom(`beam:${w}:${straight}`, () => {
      const geometry = new THREE.PlaneGeometry(w * 0.9, 1)
      geometry.translate(0, -0.5, 0)
      return geometry
    }), beamMaterial)
    const drop = (spec.y ?? 1) + 0.02
    beam.scale.y = Math.hypot(drop, 1.7)
    beam.rotation.x = -Math.atan2(1.7, drop)
    beam.position.set(0, -0.02, 0.06)
    beam.renderOrder = 2
    object.add(beam)
  }
  const phase = spec.x
  return {
    object,
    tick: (time) => {
      curtains.forEach((curtain, index) => {
        curtain.rotation.z = Math.sin(time * 0.6 + phase + index) * 0.012
      })
    },
  }
}

/**
 * Build one piece of furniture with its origin at the centre of its footprint.
 * The caller places it at the spec's x, y and z; wall pieces sit at y on the
 * wall, hanging lamps at their bulb.
 *
 * @param kit - Resource kit of the diorama
 * @param spec - Furniture spec
 * @param targets - Phase-tinted materials shared across windows
 * @returns The furniture object and its lamp or ambient motion
 */
export function buildFurniture(kit: Kit, spec: FurnitureSpec, targets: PhaseTargets): BuiltFurniture {
  switch (spec.kind) {
    case 'sofa': return sofa(kit, spec)
    case 'coffee-table': return coffeeTable(kit, spec)
    case 'console': return consoleUnit(kit, spec)
    case 'nightstand': return nightstand(kit, spec)
    case 'table-lamp': return tableLamp(kit)
    case 'floor-lamp': return floorLamp(kit)
    case 'pendant': return pendant(kit, spec)
    case 'plant': return plant(kit, spec)
    case 'rug': return rug(kit, spec)
    case 'bed': return bed(kit, spec)
    case 'shelf': return shelf(kit, spec)
    case 'laundry': return laundry(kit, spec)
    case 'basket': return basket(kit)
    case 'desk': return desk(kit, spec)
    case 'clock': return clock(kit, spec)
    case 'moon-gate': return moonGate(kit, spec)
    case 'window': return windowFrame(kit, spec, targets)
  }
}
