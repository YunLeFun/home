import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

/**
 * The 晴空暖居 palette in 3D: warm white walls, honey oak, sky linen and
 * dopamine accents, matching the 2D scene variables in `styles/scene.scss`.
 */
export const PALETTE = {
  wallWarm: '#fbf7f0',
  wallSky: '#e8f1fb',
  wallClay: '#fcefe2',
  trim: '#ffffff',
  floor: '#e2c397',
  plinth: '#f4ece0',
  plinthEdge: '#e2d6c4',
  fabric: '#b9d1ec',
  fabricDeep: '#8fb0d8',
  oat: '#f3eadb',
  linen: '#ffffff',
  duvet: '#f7dc99',
  duvetFold: '#fbecc4',
  wood: '#c89566',
  woodLight: '#e9cfa4',
  ceramic: '#f7f7f5',
  accent: '#ff8a6b',
  sun: '#ffd36b',
  leaf: '#6fb07a',
  leafDeep: '#4f9460',
  leafLight: '#9dd49c',
  pot: '#e8916a',
  ink: '#3b4658',
  metal: '#cdd3db',
  rug: '#f6efe2',
  rugBorder: '#cfe0f3',
  basket: '#d9b382',
  shade: '#fff4dc',
} as const

/** Colours of device status lights by tone. */
export const TONE_COLORS = {
  idle: '#a4afc0',
  cool: '#4fb6ef',
  heat: '#ff8a6b',
  warm: '#ffb15c',
  active: '#4fbf7a',
} as const

interface MaterialOptions {
  roughness?: number
  metalness?: number
  emissive?: THREE.ColorRepresentation
  emissiveIntensity?: number
  transparent?: boolean
  opacity?: number
  map?: THREE.Texture | null
  side?: THREE.Side
}

function round(value: number) {
  return Math.round(value * 1000) / 1000
}

/**
 * Geometry and material factory for one part of the diorama. Shared resources
 * are cached by their parameters; everything created through a kit is freed by
 * `dispose()`.
 */
export class Kit {
  private geometries = new Map<string, THREE.BufferGeometry>()
  private materials = new Map<string, THREE.Material>()
  private owned = new Set<{ dispose: () => void }>()

  /** Register a resource the kit should free. */
  track<T extends { dispose: () => void }>(resource: T): T {
    this.owned.add(resource)
    return resource
  }

  /** A shared clay-like material. */
  material(color: THREE.ColorRepresentation, options: MaterialOptions = {}): THREE.MeshStandardMaterial {
    const key = JSON.stringify([color, options.roughness, options.metalness, options.transparent, options.opacity, options.side])
    const cached = !options.map && !options.emissive && this.materials.get(key)
    if (cached)
      return cached as THREE.MeshStandardMaterial
    const material = this.ownMaterial(color, options)
    if (!options.map && !options.emissive)
      this.materials.set(key, material)
    return material
  }

  /** A material this caller may change, such as a glowing lamp shade. */
  ownMaterial(color: THREE.ColorRepresentation, options: MaterialOptions = {}): THREE.MeshStandardMaterial {
    return this.track(new THREE.MeshStandardMaterial({
      color,
      roughness: options.roughness ?? 0.82,
      metalness: options.metalness ?? 0,
      emissive: options.emissive ?? '#000000',
      emissiveIntensity: options.emissiveIntensity ?? 1,
      transparent: options.transparent ?? false,
      opacity: options.opacity ?? 1,
      map: options.map ?? null,
      side: options.side ?? THREE.FrontSide,
    }))
  }

  private geometry<T extends THREE.BufferGeometry>(key: string, create: () => T): T {
    let geometry = this.geometries.get(key)
    if (!geometry) {
      geometry = create()
      this.geometries.set(key, geometry)
    }
    return geometry as T
  }

  /** A box with soft rounded edges. */
  roundedBox(width: number, height: number, depth: number, radius = 0.04) {
    const r = Math.min(radius, width / 2 - 0.001, height / 2 - 0.001, depth / 2 - 0.001)
    return this.geometry(`rbox:${round(width)}:${round(height)}:${round(depth)}:${round(r)}`, () => new RoundedBoxGeometry(width, height, depth, 3, Math.max(0.001, r)))
  }

  cylinder(radiusTop: number, radiusBottom: number, height: number, segments = 28, thetaLength = Math.PI * 2) {
    return this.geometry(`cyl:${round(radiusTop)}:${round(radiusBottom)}:${round(height)}:${segments}:${round(thetaLength)}`, () => new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 1, false, 0, thetaLength))
  }

  sphere(radius: number, widthSegments = 24, heightSegments = 16, thetaLength = Math.PI) {
    return this.geometry(`sph:${round(radius)}:${widthSegments}:${heightSegments}:${round(thetaLength)}`, () => new THREE.SphereGeometry(radius, widthSegments, heightSegments, 0, Math.PI * 2, 0, thetaLength))
  }

  torus(radius: number, tube: number, arc = Math.PI * 2, radialSegments = 12, tubularSegments = 40) {
    return this.geometry(`tor:${round(radius)}:${round(tube)}:${round(arc)}`, () => new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments, arc))
  }

  plane(width: number, height: number) {
    return this.geometry(`pln:${round(width)}:${round(height)}`, () => new THREE.PlaneGeometry(width, height))
  }

  /** A flat rounded rectangle lying on the floor, `height` thick. */
  roundedSlab(width: number, depth: number, radius: number, height: number) {
    return this.geometry(`slab:${round(width)}:${round(depth)}:${round(radius)}:${round(height)}`, () => {
      const w = width / 2
      const d = depth / 2
      const r = Math.min(radius, w, d)
      const shape = new THREE.Shape()
      shape.moveTo(-w + r, -d)
      shape.lineTo(w - r, -d)
      shape.quadraticCurveTo(w, -d, w, -d + r)
      shape.lineTo(w, d - r)
      shape.quadraticCurveTo(w, d, w - r, d)
      shape.lineTo(-w + r, d)
      shape.quadraticCurveTo(-w, d, -w, d - r)
      shape.lineTo(-w, -d + r)
      shape.quadraticCurveTo(-w, -d, -w + r, -d)
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 10 })
      geometry.rotateX(Math.PI / 2)
      geometry.translate(0, height, 0)
      return geometry
    })
  }

  /** Cache any other geometry under a key. */
  custom<T extends THREE.BufferGeometry>(key: string, create: () => T): T {
    return this.geometry(`custom:${key}`, create)
  }

  /** A mesh that casts and receives soft shadows. */
  mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0, shadow = true) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    mesh.castShadow = shadow
    mesh.receiveShadow = shadow
    return mesh
  }

  /** A canvas-backed texture drawn once. */
  canvasTexture(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (context)
      draw(context)
    const texture = this.track(new THREE.CanvasTexture(canvas))
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }

  dispose() {
    for (const geometry of this.geometries.values())
      geometry.dispose()
    for (const resource of this.owned)
      resource.dispose()
    this.geometries.clear()
    this.materials.clear()
    this.owned.clear()
  }
}

/** Place a group so its base sits at a point. */
export function at<T extends THREE.Object3D>(object: T, x: number, y: number, z: number): T {
  object.position.set(x, y, z)
  return object
}
