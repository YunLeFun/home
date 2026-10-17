/**
 * Plugin icons: a small declarative vector format that plugins use to design
 * their own app icon.
 *
 * Icons are data, not markup. The host renders them with a fixed set of shape
 * elements and attributes, so a third-party icon can never carry scripts,
 * event handlers, external references or CSS. Motion is limited to the host's
 * own animations, which keeps every plugin in the same motion language and
 * honours reduced motion. The canvas is 64 × 64.
 */

/** Host animations a shape may play while its device is running. */
export type PluginIconMotion = 'spin' | 'sway' | 'pulse' | 'float' | 'blink' | 'flow'

/**
 * A colour: hex (`#rgb`, `#rrggbb`, `#rrggbbaa`), `none`, or a host token
 * that follows the device and the theme:
 *
 * - `tone`, `tone-soft`: the device's current tone (cool, heat, warm…)
 * - `surface`: appliance white, a little dimmer in dark mode
 * - `ink`: outlines and faces
 */
export type PluginIconPaint = string

export type PluginIconShapeType = 'group' | 'path' | 'circle' | 'ellipse' | 'rect' | 'line' | 'polyline' | 'polygon'

export interface PluginIconShape {
  type: PluginIconShapeType
  d?: string
  cx?: number
  cy?: number
  r?: number
  rx?: number
  ry?: number
  x?: number
  y?: number
  width?: number
  height?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
  points?: string
  fill?: PluginIconPaint
  stroke?: PluginIconPaint
  strokeWidth?: number
  opacity?: number
  linecap?: 'butt' | 'round' | 'square'
  linejoin?: 'miter' | 'round' | 'bevel'
  /** `translate`, `rotate`, `scale`, `skewX` and `skewY` with numeric arguments */
  transform?: string
  /** Animation played while the device runs */
  motion?: PluginIconMotion
  /** Pivot of `spin`, `sway` and `pulse`, in canvas units; defaults to the centre */
  origin?: [number, number]
  /** Draw only while the device is running, or only while it is idle */
  when?: 'active' | 'idle'
  /** Delay of the motion in seconds, to stagger repeated shapes */
  delay?: number
  children?: PluginIconShape[]
}

export interface DevicePluginIcon {
  /** Two-stop tile gradient, top-left to bottom-right */
  background: [string, string]
  /** Tile gradient in dark mode; defaults to a dimmed `background` */
  backgroundDark?: [string, string]
  shapes: PluginIconShape[]
}

const SHAPE_TYPES = new Set<PluginIconShapeType>(['group', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon'])
const MOTIONS = new Set<PluginIconMotion>(['spin', 'sway', 'pulse', 'float', 'blink', 'flow'])
const NUMBER_KEYS = ['cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2', 'strokeWidth', 'opacity', 'delay'] as const
const PAINT_TOKENS = new Set(['none', 'tone', 'tone-soft', 'surface', 'ink'])
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const PATH_DATA = /^[MLHVCSQTAZ\d\s.,eE+-]+$/i
const POINTS = /^[\d\s.,eE+-]+$/
const NUMBER = String.raw`-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?`
const TRANSFORM = new RegExp(String.raw`^(?:\s*(?:translate|rotate|scale|skewX|skewY)\(\s*${NUMBER}(?:\s*[,\s]\s*${NUMBER}){0,2}\s*\)\s*)+$`)

/** Limits that keep icons cheap to render in long lists. */
export const PLUGIN_ICON_LIMITS = { shapes: 80, depth: 4, pathLength: 4000 } as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Whether a value is a colour the icon renderer accepts.
 *
 * @param value - Candidate colour
 * @returns Whether it is a hex colour or a host token
 */
export function isPluginIconPaint(value: unknown): value is PluginIconPaint {
  return typeof value === 'string' && (HEX.test(value) || PAINT_TOKENS.has(value))
}

interface NormalizeContext {
  count: number
  errors: string[]
}

function normalizeShape(value: unknown, depth: number, path: string, context: NormalizeContext): PluginIconShape | null {
  if (!isRecord(value) || !SHAPE_TYPES.has(value.type as PluginIconShapeType)) {
    context.errors.push(`${path}: unknown shape`)
    return null
  }
  if (++context.count > PLUGIN_ICON_LIMITS.shapes) {
    context.errors.push(`${path}: more than ${PLUGIN_ICON_LIMITS.shapes} shapes`)
    return null
  }
  const shape: PluginIconShape = { type: value.type as PluginIconShapeType }
  for (const key of NUMBER_KEYS) {
    const number = value[key]
    if (number === undefined)
      continue
    if (typeof number === 'number' && Number.isFinite(number) && Math.abs(number) <= 1000)
      shape[key] = number
    else
      context.errors.push(`${path}.${key}: not a number`)
  }
  if (typeof value.d === 'string') {
    if (value.d.length <= PLUGIN_ICON_LIMITS.pathLength && PATH_DATA.test(value.d))
      shape.d = value.d
    else
      context.errors.push(`${path}.d: invalid path data`)
  }
  if (typeof value.points === 'string') {
    if (value.points.length <= PLUGIN_ICON_LIMITS.pathLength && POINTS.test(value.points))
      shape.points = value.points
    else
      context.errors.push(`${path}.points: invalid points`)
  }
  for (const key of ['fill', 'stroke'] as const) {
    if (value[key] === undefined)
      continue
    if (isPluginIconPaint(value[key]))
      shape[key] = value[key]
    else
      context.errors.push(`${path}.${key}: unsupported colour`)
  }
  if (value.linecap === 'butt' || value.linecap === 'round' || value.linecap === 'square')
    shape.linecap = value.linecap
  if (value.linejoin === 'miter' || value.linejoin === 'round' || value.linejoin === 'bevel')
    shape.linejoin = value.linejoin
  if (typeof value.transform === 'string') {
    if (value.transform.length <= 200 && TRANSFORM.test(value.transform))
      shape.transform = value.transform.trim()
    else
      context.errors.push(`${path}.transform: unsupported transform`)
  }
  if (value.motion !== undefined) {
    if (MOTIONS.has(value.motion as PluginIconMotion))
      shape.motion = value.motion as PluginIconMotion
    else
      context.errors.push(`${path}.motion: unknown motion`)
  }
  if (Array.isArray(value.origin) && value.origin.length === 2 && value.origin.every(item => typeof item === 'number' && Number.isFinite(item)))
    shape.origin = [value.origin[0], value.origin[1]]
  if (value.when === 'active' || value.when === 'idle')
    shape.when = value.when
  if (Array.isArray(value.children)) {
    if (depth >= PLUGIN_ICON_LIMITS.depth) {
      context.errors.push(`${path}: nested too deeply`)
    }
    else {
      shape.children = value.children
        .map((child, index) => normalizeShape(child, depth + 1, `${path}.children[${index}]`, context))
        .filter((child): child is PluginIconShape => child !== null)
    }
  }
  return shape
}

/**
 * Validate an icon from a plugin manifest and keep only what the renderer
 * supports. Unknown keys are dropped; invalid values are dropped and reported.
 *
 * @param value - Icon from an untrusted manifest
 * @returns The sanitized icon (or null when unusable) and the problems found
 */
export function normalizePluginIcon(value: unknown): { icon: DevicePluginIcon | null, errors: string[] } {
  const context: NormalizeContext = { count: 0, errors: [] }
  if (!isRecord(value) || !Array.isArray(value.shapes))
    return { icon: null, errors: ['icon: expected { background, shapes }'] }
  const gradient = (input: unknown, name: string): [string, string] | undefined => {
    if (Array.isArray(input) && input.length === 2 && input.every(item => typeof item === 'string' && HEX.test(item)))
      return [input[0], input[1]]
    if (input !== undefined)
      context.errors.push(`icon.${name}: expected two hex colours`)
    return undefined
  }
  const background = gradient(value.background, 'background')
  const backgroundDark = gradient(value.backgroundDark, 'backgroundDark')
  const shapes = value.shapes
    .map((shape, index) => normalizeShape(shape, 1, `icon.shapes[${index}]`, context))
    .filter((shape): shape is PluginIconShape => shape !== null)
  if (!background || shapes.length === 0)
    return { icon: null, errors: [...context.errors, 'icon: needs a background and at least one shape'] }
  return { icon: { background, ...(backgroundDark ? { backgroundDark } : {}), shapes }, errors: context.errors }
}

/** Helper for authors: an identity function that types an icon literal. */
export function definePluginIcon(icon: DevicePluginIcon): DevicePluginIcon {
  return icon
}
