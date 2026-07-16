import { describe, expect, it } from 'vitest'
import { createDefaultDeviceState, isDeviceAction, normalizeDeviceState, reduceDeviceState } from '~/utils/device'

describe('device state reducers', () => {
  const changedAt = '2026-07-15T08:00:00.000Z'

  it('keeps air-conditioner temperature within its supported range', () => {
    let state = createDefaultDeviceState('air-conditioner', changedAt)
    state = reduceDeviceState('air-conditioner', state, { type: 'mode', mode: 'hot' }, changedAt)
    state = reduceDeviceState('air-conditioner', state, { type: 'update', payload: { temperature: 99 } }, changedAt)
    state = reduceDeviceState('air-conditioner', state, { type: 'toggleStatus' }, changedAt)

    expect(state).toEqual({ status: true, mode: 'hot', temperature: 31 })
  })

  it('controls fan power, speed, oscillation and timer', () => {
    let state = createDefaultDeviceState('fan', changedAt)
    state = reduceDeviceState('fan', state, { type: 'set-speed', speed: 3 }, changedAt)
    state = reduceDeviceState('fan', state, { type: 'toggle-oscillation' }, changedAt)
    state = reduceDeviceState('fan', state, { type: 'set-timer', minutes: 30 }, changedAt)

    expect(state).toMatchObject({ power: true, speed: 3, oscillating: true })
    expect(state.autoOffAt).toBe('2026-07-15T08:30:00.000Z')
  })

  it('keeps robot route progress as state-transition data', () => {
    const initial = createDefaultDeviceState('robot-vacuum', changedAt)
    const cleaning = reduceDeviceState('robot-vacuum', initial, { type: 'start' }, changedAt)
    const paused = reduceDeviceState('robot-vacuum', cleaning, { type: 'pause' }, changedAt)

    expect(cleaning.status).toBe('cleaning')
    expect(paused.status).toBe('paused')
    expect(paused.progress).toBe(initial.progress)
  })

  it('maps hand-warmer levels to safe target temperatures', () => {
    const initial = createDefaultDeviceState('hand-warmer', changedAt)
    const high = reduceDeviceState('hand-warmer', initial, { type: 'set-level', level: 'high' }, changedAt)

    expect(high).toMatchObject({ power: true, level: 'high', temperature: 48 })
  })

  it('normalizes remote values into supported ranges', () => {
    const state = normalizeDeviceState('robot-vacuum', { status: 'cleaning', mode: 'turbo', progress: 4, battery: -1, cleanedArea: 22, stateChangedAt: changedAt })

    expect(state.progress).toBe(1)
    expect(state.battery).toBe(0)
  })

  it('rejects unsafe timer values at the API boundary', () => {
    expect(isDeviceAction('fan', { type: 'set-timer', minutes: Number.NaN })).toBe(false)
    expect(isDeviceAction('fan', { type: 'set-timer', minutes: -1 })).toBe(false)
    expect(isDeviceAction('hand-warmer', { type: 'set-timer', minutes: 1441 })).toBe(false)
    expect(isDeviceAction('hand-warmer', { type: 'set-timer', minutes: 120 })).toBe(true)
  })
})
