import { afterEach, describe, expect, it } from 'vitest'
import { HOME_DEVICES } from '~/constants/home'
import {
  airConditionerPlugin,
  airConditionerTone,
} from '~/devices/air-conditioner'
import {
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
  it('installs the air conditioner as a built-in plugin', () => {
    expect(listDevicePlugins().map(plugin => plugin.manifest.kind)).toContain('air-conditioner')
    expect(getDevicePlugin('air-conditioner')).toBe(airConditionerPlugin)
    expect(getDevicePlugin('fan')).toBeUndefined()
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

  it('derives home metadata from the plugin manifest', () => {
    const { manifest } = airConditionerPlugin
    expect(HOME_DEVICES['air-conditioner']).toMatchObject({
      id: manifest.kind,
      name: manifest.name,
      route: manifest.route,
      width: manifest.size.width,
      height: manifest.size.height,
    })
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
    expect(resolveDevicePluginComponent('television', 'panel')).toBeNull()
  })
})

describe('device running state and tone', () => {
  it('maps air conditioner modes to cool and heat tones', () => {
    expect(airConditionerTone({ status: false, mode: 'cold', temperature: 26 })).toBe('idle')
    expect(getDeviceTone('air-conditioner', { status: true, mode: 'cold', temperature: 22 })).toBe('cool')
    expect(getDeviceTone('air-conditioner', { status: true, mode: 'hot', temperature: 28 })).toBe('heat')
  })

  it('keeps legacy devices on built-in rules', () => {
    const warmer = reduceDeviceState('hand-warmer', createDefaultDeviceState('hand-warmer'), { type: 'toggle' })
    expect(isDeviceRunning('hand-warmer', warmer)).toBe(true)
    expect(getDeviceTone('hand-warmer', warmer)).toBe('warm')
    const robot = reduceDeviceState('robot-vacuum', createDefaultDeviceState('robot-vacuum'), { type: 'return' })
    expect(isDeviceRunning('robot-vacuum', robot)).toBe(true)
    expect(getDeviceTone('fan', createDefaultDeviceState('fan'))).toBe('idle')
  })
})
