import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AirConditionerState } from '~/types'
import { createAcController } from '~/utils/ac-controller'
import { climateToAcState } from '~/utils/home-assistant'
import { climate } from './helpers/ha-fixture'

function setup(mode = 'cool') {
  const execute = vi.fn().mockResolvedValue(undefined)
  const read = vi.fn().mockResolvedValue(climateToAcState(climate(mode)))
  const render = vi.fn()
  const report = vi.fn()
  const controller = createAcController({ execute, read, render, report })
  controller.receive(climateToAcState(climate(mode)))
  return { controller, execute, read, render, report }
}

describe('AC intent coordination', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('debounces temperature changes against the confirmed state', async () => {
    const { controller, execute, render, report } = setup()
    const target: AirConditionerState = { status: true, mode: 'cold', temperature: 25 }
    controller.request(target, { temperature: 25 }, true)
    await vi.advanceTimersByTimeAsync(400)
    controller.request({ ...target, temperature: 24 }, { temperature: 24 }, true)
    controller.receive(climateToAcState(climate('cool', 26, '2026-10-15T10:00:01Z')))
    expect(render.mock.lastCall?.[0].temperature).toBe(24)
    await vi.advanceTimersByTimeAsync(599)
    expect(execute).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(execute).toHaveBeenCalledExactlyOnceWith({ service: 'set_temperature', data: { temperature: 24 } })
    controller.receive(climateToAcState(climate('cool', 24, '2026-10-15T10:00:02Z')))
    expect(render.mock.lastCall?.[1]).toBe(false)
    expect(report.mock.calls.every(([snapshot]) => snapshot.state.temperature !== 25)).toBe(true)
    controller.dispose()
  })

  it('keeps off-state settings through HA updates and sends them on power-on', async () => {
    const { controller, execute, render } = setup('off')
    controller.request({ status: false, mode: 'hot', temperature: 24 }, { mode: 'hot', temperature: 24 }, true)
    controller.receive(climateToAcState(climate('off', 26, '2026-10-15T10:00:01Z')))
    expect(render.mock.lastCall?.[0]).toEqual({ status: false, mode: 'hot', temperature: 24 })
    expect(execute).not.toHaveBeenCalled()
    controller.request({ status: true, mode: 'hot', temperature: 24 }, { status: true }, false)
    await vi.advanceTimersByTimeAsync(0)
    expect(execute.mock.calls.map(([command]) => command)).toEqual([
      { service: 'set_hvac_mode', data: { hvac_mode: 'heat' } },
      { service: 'set_temperature', data: { temperature: 24 } },
    ])
    controller.dispose()
  })

  it('does not let an older failed command roll back a later intent', async () => {
    const { controller, execute, render } = setup()
    let rejectFirst: (error: Error) => void = () => undefined
    execute.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject }))
    controller.request({ status: true, mode: 'hot', temperature: 26 }, { mode: 'hot' }, false)
    controller.request({ status: true, mode: 'cold', temperature: 23 }, { mode: 'cold', temperature: 23 }, true)
    rejectFirst(new Error('failed'))
    await vi.advanceTimersByTimeAsync(600)
    expect(render.mock.lastCall?.[0].temperature).toBe(23)
    expect(render.mock.lastCall?.[2]).toBeNull()
    expect(execute.mock.lastCall?.[0]).toEqual({ service: 'set_temperature', data: { temperature: 23 } })
    controller.dispose()
  })

  it('explicitly turns off after a superseded on command even before HA reports on', async () => {
    const { controller, execute } = setup('off')
    let finish: () => void = () => undefined
    execute.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve }))
    controller.request({ status: true, mode: 'cold', temperature: 26 }, { status: true }, false)
    controller.request({ status: false, mode: 'cold', temperature: 26 }, { status: false }, false)
    finish()
    await vi.advanceTimersByTimeAsync(0)
    expect(execute.mock.calls.map(([command]) => command)).toEqual([
      { service: 'set_hvac_mode', data: { hvac_mode: 'cool' } },
      { service: 'set_hvac_mode', data: { hvac_mode: 'off' } },
    ])
    controller.dispose()
  })

  it('preserves dry mode while a temperature change is pending', async () => {
    const { controller, render } = setup('dry')
    controller.request({ status: true, mode: 'cold', temperature: 24 }, { temperature: 24 }, true)
    expect(render.mock.lastCall?.[3]).toBe('dry')
    controller.dispose()
  })

  it('rereads partial service failures instead of restoring an outdated mode', async () => {
    const { controller, execute, read, render } = setup('off')
    execute.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('temperature failed'))
    read.mockResolvedValue(climateToAcState(climate('heat', 26, '2026-10-15T10:00:05Z')))
    controller.request({ status: true, mode: 'hot', temperature: 24 }, { status: true }, false)
    await vi.advanceTimersByTimeAsync(0)
    expect(render.mock.lastCall?.[0]).toEqual({ status: true, mode: 'hot', temperature: 26 })
    expect(render.mock.lastCall?.[2]).toContain('失败')
    controller.dispose()
  })

  it('reads again after the confirmation deadline and reports uncertainty', async () => {
    const { controller, read, render } = setup()
    controller.request({ status: true, mode: 'cold', temperature: 23 }, { temperature: 23 }, true)
    await vi.advanceTimersByTimeAsync(5600)
    expect(read).toHaveBeenCalledOnce()
    expect(render.mock.lastCall?.[0].temperature).toBe(26)
    expect(render.mock.lastCall?.[2]).toContain('未确认')
    controller.dispose()
  })

  it('rolls back a failed latest command and never sends external updates or cancelled work', async () => {
    const { controller, execute, render } = setup()
    execute.mockRejectedValueOnce(new Error('failed'))
    controller.request({ status: true, mode: 'cold', temperature: 23 }, { temperature: 23 }, true)
    await vi.advanceTimersByTimeAsync(600)
    expect(render.mock.lastCall?.[0].temperature).toBe(26)
    expect(render.mock.lastCall?.[2]).toContain('失败')
    controller.request({ status: true, mode: 'cold', temperature: 22 }, { temperature: 22 }, true)
    controller.cancel()
    controller.receive(climateToAcState(climate('heat', 25, '2026-10-15T10:00:03Z')))
    await vi.advanceTimersByTimeAsync(10000)
    expect(execute).toHaveBeenCalledOnce()
    expect(render.mock.lastCall?.[0].mode).toBe('hot')
    controller.dispose()
  })
})
