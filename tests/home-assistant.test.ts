import { describe, expect, it } from 'vitest'
import { reduceDeviceState } from '~/utils/device'
import { clampAcTemperature, climateToAcState, DEFAULT_AC_CAPABILITIES, haTokenStorageKey, nextSnapshotTimestamp, normalizeDeviceBinding, normalizeHaBaseUrl, planAcCommands } from '~/utils/home-assistant'
import { climate } from './helpers/ha-fixture'

describe('HA climate mapping and capability-aware actions', () => {
  it('keeps unavailable and unknown entities off and preserves raw modes', () => {
    expect(climateToAcState(climate('unavailable')).available).toBe(false)
    expect(climateToAcState(climate('unknown')).state.status).toBe(false)
    expect(climateToAcState(climate('dry')).rawMode).toBe('dry')
    expect(climateToAcState(climate('heat')).state.mode).toBe('hot')
    expect(climateToAcState(climate('off'), { status: true, mode: 'hot', temperature: 26 }).state.mode).toBe('hot')
  })

  it('handles missing setpoints and rejects unsupported temperature units', () => {
    expect(climateToAcState(climate('fan_only', null)).targetTemperature).toBeNull()
    const entity = climate()
    entity.attributes.temperature_unit = '°F'
    expect(climateToAcState(entity).capabilities.unsupportedReason).toContain('摄氏度')
  })

  it('applies entity limits and fractional steps beyond the virtual range', () => {
    const snapshot = climateToAcState(climate('cool', 31.5))
    const next = reduceDeviceState('air-conditioner', snapshot.state, { type: 'increment' }, undefined, snapshot.capabilities)
    expect(next.temperature).toBe(32)
    expect(clampAcTemperature(99, snapshot.capabilities)).toBe(32)
    expect(clampAcTemperature(24.3, snapshot.capabilities)).toBe(24.5)
  })
})

describe('HA command planning', () => {
  it('sends the selected temperature when powering on after editing while off', () => {
    const previous = climateToAcState(climate('off'))
    expect(planAcCommands(previous, { status: true, mode: 'hot', temperature: 24 }, { status: true })).toEqual([
      { service: 'set_hvac_mode', data: { hvac_mode: 'heat' } },
      { service: 'set_temperature', data: { temperature: 24 } },
    ])
    expect(planAcCommands(previous, { status: false, mode: 'hot', temperature: 24 }, { temperature: 24 })).toEqual([])
  })

  it('changes temperature in dry mode without switching to cooling', () => {
    const snapshot = climateToAcState(climate('dry'))
    const target = { ...snapshot.state, temperature: 24 }
    expect(planAcCommands(snapshot, target, { temperature: 24 })).toEqual([{ service: 'set_temperature', data: { temperature: 24 } }])
    expect(planAcCommands(snapshot, snapshot.state, { mode: 'cold' })[0]).toEqual({ service: 'set_hvac_mode', data: { hvac_mode: 'cool' } })
  })

  it('sends only off when powering down and rejects unsupported modes', () => {
    const snapshot = climateToAcState(climate())
    expect(planAcCommands(snapshot, { ...snapshot.state, status: false }, { status: false })).toEqual([{ service: 'set_hvac_mode', data: { hvac_mode: 'off' } }])
    snapshot.capabilities.hvacModes = ['off', 'cool']
    expect(() => planAcCommands(snapshot, { ...snapshot.state, mode: 'hot' }, { mode: 'hot' })).toThrow('不支持')
    snapshot.capabilities = { ...DEFAULT_AC_CAPABILITIES, supportsTemperature: false }
    expect(planAcCommands(snapshot, { ...snapshot.state, temperature: 23 }, { temperature: 23 })).toEqual([])
  })
})

describe('binding and credential boundaries', () => {
  it('normalizes URLs and whitelists binding fields without copying tokens', () => {
    expect(normalizeDeviceBinding({ provider: 'home-assistant', baseUrl: 'HTTPS://HA.EXAMPLE.COM:443/', entityId: 'climate.living_room', token: 'secret' })).toEqual({
      provider: 'home-assistant', baseUrl: 'https://ha.example.com', entityId: 'climate.living_room',
    })
    for (const baseUrl of ['https://user:password@ha.example.com', 'https://ha.example.com/path', 'https://ha.example.com?token=x', 'ws://ha.example.com', 'javascript:alert(1)'])
      expect(normalizeDeviceBinding({ provider: 'home-assistant', baseUrl, entityId: 'climate.test' })).toBeNull()
    expect(normalizeDeviceBinding({ provider: 'home-assistant', baseUrl: 'http://localhost:8123', entityId: 'light.test' })).toBeNull()
    expect(() => normalizeHaBaseUrl('http://localhost:8123', true)).toThrow('WSS')
  })

  it('isolates tokens by account and normalized host', () => {
    expect(haTokenStorageKey('alice', 'https://HA.EXAMPLE.COM/')).toBe(haTokenStorageKey('alice', 'https://ha.example.com'))
    expect(haTokenStorageKey('alice', 'https://ha.example.com')).not.toBe(haTokenStorageKey('bob', 'https://ha.example.com'))
  })

  it('advances cloud snapshot versions even when a remote clock is ahead', () => {
    expect(nextSnapshotTimestamp(null, '2026-10-16T00:00:00.000Z', Date.parse('2026-10-15T00:00:00.000Z'))).toBe('2026-10-16T00:00:00.001Z')
  })
})
