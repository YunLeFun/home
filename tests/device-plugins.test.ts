import { afterEach, describe, expect, it } from 'vitest'
import { HOME_DEVICES } from '~/constants/home'
import {
  airConditionerPlugin,
  airConditionerTone,
} from '~/devices/air-conditioner'
import { fanPlugin } from '~/devices/fan'
import { HAND_WARMER_TEMPERATURES, handWarmerPlugin } from '~/devices/hand-warmer'
import { robotVacuumPlugin } from '~/devices/robot-vacuum'
import { DEFAULT_TELEVISION_SOURCE_URL, televisionPlugin } from '~/devices/television'
import {
  BUILTIN_DEVICE_PLUGINS,
  getDevicePlugin,
  installBuiltinDevicePlugins,
  listDevicePlugins,
  registerDevicePlugin,
  resolveDevicePluginComponent,
  unregisterDevicePlugin,
} from '~/devices'
import { createDefaultDeviceState, getDeviceTone, isDeviceAction, isDeviceRunning, reduceDeviceState } from '~/utils/device'

afterEach(() => {
  installBuiltinDevicePlugins()
})

describe('device plugin registry', () => {
  it('installs every device kind as a built-in plugin', () => {
    expect(listDevicePlugins().map(plugin => plugin.manifest.kind).sort()).toEqual(Object.keys(HOME_DEVICES).sort())
    expect(getDevicePlugin('air-conditioner')).toBe(airConditionerPlugin)
    expect(getDevicePlugin('fan')).toBe(fanPlugin)
    expect(getDevicePlugin('robot-vacuum')).toBe(robotVacuumPlugin)
    expect(getDevicePlugin('hand-warmer')).toBe(handWarmerPlugin)
    expect(getDevicePlugin('television')).toBe(televisionPlugin)
  })

  it('is idempotent for the same plugin and rejects conflicting owners', () => {
    expect(() => installBuiltinDevicePlugins()).not.toThrow()
    expect(() => registerDevicePlugin({ ...airConditionerPlugin })).toThrow(/already registered/)
  })

  it('replaces a stale built-in copy left by module re-evaluation', () => {
    unregisterDevicePlugin('air-conditioner')
    registerDevicePlugin({ ...airConditionerPlugin })
    installBuiltinDevicePlugins()
    expect(getDevicePlugin('air-conditioner')).toBe(airConditionerPlugin)
  })

  it.each(BUILTIN_DEVICE_PLUGINS.map(plugin => [plugin.manifest.kind, plugin] as const))('derives %s home metadata from its manifest', (kind, { manifest }) => {
    expect(HOME_DEVICES[kind]).toEqual({
      id: manifest.kind,
      name: manifest.name,
      description: manifest.description,
      icon: manifest.icon,
      route: manifest.route,
      width: manifest.size.width,
      height: manifest.size.height,
    })
    expect(manifest.route).toBe(`/items/${kind}`)
  })

  it('routes reducers and validation through the plugin state machine', () => {
    let state = createDefaultDeviceState('air-conditioner')
    state = reduceDeviceState('air-conditioner', state, { type: 'toggleStatus' })
    state = reduceDeviceState('air-conditioner', state, { type: 'mode', mode: 'hot' })
    expect(state).toEqual({ status: true, mode: 'hot', temperature: 26 })
    expect(isDeviceAction('air-conditioner', { type: 'mode', mode: 'dry' })).toBe(false)
  })

  it('fails loudly when a plugin-owned kind is not installed', () => {
    unregisterDevicePlugin('air-conditioner')
    expect(() => createDefaultDeviceState('air-conditioner')).toThrow(/not installed/)
    expect(resolveDevicePluginComponent('air-conditioner', 'panel')).toBeNull()
  })

  it('resolves only the UI slots a plugin provides', () => {
    expect(resolveDevicePluginComponent('air-conditioner', 'glyph')).not.toBeNull()
    expect(resolveDevicePluginComponent('air-conditioner', 'panel')).toBe(resolveDevicePluginComponent('air-conditioner', 'panel'))
    expect(resolveDevicePluginComponent('television', 'panel')).not.toBeNull()
    expect(resolveDevicePluginComponent('fan', 'panel')).toBeNull()
  })

  it('provides a glyph and quick control for every device', () => {
    for (const plugin of BUILTIN_DEVICE_PLUGINS) {
      expect(plugin.components.glyph).toBeTypeOf('function')
      expect(plugin.components.quickControl).toBeTypeOf('function')
    }
  })

  it.each(['fan', 'robot-vacuum', 'hand-warmer', 'television'] as const)('fails loudly when the %s plugin is not installed', (kind) => {
    unregisterDevicePlugin(kind)
    expect(() => createDefaultDeviceState(kind)).toThrow(/not installed/)
  })
})

describe('device running state and tone', () => {
  it('maps air conditioner modes to cool and heat tones', () => {
    expect(airConditionerTone({ status: false, mode: 'cold', temperature: 26 })).toBe('idle')
    expect(getDeviceTone('air-conditioner', { status: true, mode: 'cold', temperature: 22 })).toBe('cool')
    expect(getDeviceTone('air-conditioner', { status: true, mode: 'hot', temperature: 28 })).toBe('heat')
  })

  it('derives running state and tone from each plugin', () => {
    const warmer = reduceDeviceState('hand-warmer', createDefaultDeviceState('hand-warmer'), { type: 'toggle' })
    expect(isDeviceRunning('hand-warmer', warmer)).toBe(true)
    expect(getDeviceTone('hand-warmer', warmer)).toBe('warm')
    const robot = reduceDeviceState('robot-vacuum', createDefaultDeviceState('robot-vacuum'), { type: 'return' })
    expect(isDeviceRunning('robot-vacuum', robot)).toBe(true)
    expect(getDeviceTone('robot-vacuum', robot)).toBe('active')
    expect(isDeviceRunning('robot-vacuum', reduceDeviceState('robot-vacuum', robot, { type: 'dock' }))).toBe(false)
    expect(getDeviceTone('fan', createDefaultDeviceState('fan'))).toBe('idle')
    expect(getDeviceTone('fan', reduceDeviceState('fan', createDefaultDeviceState('fan'), { type: 'set-speed', speed: 2 }))).toBe('active')
    const tv = reduceDeviceState('television', createDefaultDeviceState('television'), { type: 'toggle-power' })
    expect(isDeviceRunning('television', tv)).toBe(true)
    expect(getDeviceTone('television', tv)).toBe('active')
  })
})

describe('plugin state machines', () => {
  const changedAt = '2026-07-15T08:00:00.000Z'

  it('creates default states stamped with the change time', () => {
    expect(fanPlugin.state.create(changedAt)).toEqual({ power: false, speed: 1, oscillating: false, autoOffAt: null, stateChangedAt: changedAt })
    expect(robotVacuumPlugin.state.create(changedAt)).toMatchObject({ status: 'docked', mode: 'standard', battery: 86, stateChangedAt: changedAt })
    expect(handWarmerPlugin.state.create(changedAt)).toMatchObject({ power: false, level: 'medium', temperature: HAND_WARMER_TEMPERATURES.medium })
    expect(televisionPlugin.state.create(changedAt)).toMatchObject({ power: false, volume: 45, sourceUrl: DEFAULT_TELEVISION_SOURCE_URL })
  })

  it('normalizes untrusted fan and hand-warmer values', () => {
    expect(fanPlugin.state.normalize({ power: 'yes', speed: 7, oscillating: true, autoOffAt: 'nope', stateChangedAt: changedAt }))
      .toEqual({ power: false, speed: 1, oscillating: true, autoOffAt: null, stateChangedAt: changedAt })
    expect(handWarmerPlugin.state.normalize({ power: true, level: 'lava', temperature: 90, autoOffAt: null, stateChangedAt: changedAt }))
      .toEqual({ power: true, level: 'medium', temperature: 55, autoOffAt: null, stateChangedAt: changedAt })
    expect(handWarmerPlugin.state.normalize(null)).toMatchObject({ power: false, level: 'medium' })
  })

  it('restarts a finished robot route but resumes a paused one', () => {
    const finished = { ...robotVacuumPlugin.state.create(changedAt), status: 'docked' as const, progress: 1 }
    expect(robotVacuumPlugin.state.reduce(finished, { type: 'start' }, changedAt).progress).toBe(0)
    const paused = { ...finished, status: 'paused' as const, progress: 0.4 }
    expect(robotVacuumPlugin.state.reduce(paused, { type: 'resume' }, changedAt)).toMatchObject({ status: 'cleaning', progress: 0.4 })
    expect(robotVacuumPlugin.state.reduce(paused, { type: 'dock' }, changedAt)).toMatchObject({ status: 'charging', progress: 0 })
  })

  it('loads a new television source paused and keeps a powered-off set silent', () => {
    const playing = televisionPlugin.state.reduce(televisionPlugin.state.create(changedAt), { type: 'play' }, changedAt)
    const source = 'https://media.example.com/clip.webm'
    expect(televisionPlugin.state.reduce(playing, { type: 'set-source', sourceUrl: source }, changedAt)).toMatchObject({ power: true, playing: false, sourceUrl: source })
    expect(televisionPlugin.state.normalize({ power: false, playing: true, volume: 12.6, sourceUrl: 'http://insecure.example.com/a.mp4' }))
      .toMatchObject({ playing: false, volume: 13, sourceUrl: DEFAULT_TELEVISION_SOURCE_URL })
  })

  it('validates actions per device', () => {
    expect(isDeviceAction('fan', { type: 'set-speed', speed: 4 })).toBe(false)
    expect(isDeviceAction('fan', { type: 'set-timer', minutes: null })).toBe(true)
    expect(isDeviceAction('robot-vacuum', { type: 'set-mode', mode: 'turbo' })).toBe(true)
    expect(isDeviceAction('robot-vacuum', { type: 'set-mode', mode: 'mop' })).toBe(false)
    expect(isDeviceAction('hand-warmer', { type: 'set-level', level: 'high' })).toBe(true)
    expect(isDeviceAction('hand-warmer', { type: 'toggle-power' })).toBe(false)
    expect(isDeviceAction('television', { type: 'set-volume', volume: 101 })).toBe(false)
    expect(isDeviceAction('television', 'play')).toBe(false)
  })
})
