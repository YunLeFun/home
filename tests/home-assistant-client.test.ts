import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ERR_INVALID_AUTH } from 'home-assistant-js-websocket'
import { createHaConnectionPool } from '~/utils/home-assistant-client'
import { FakeHaWebSocket } from './helpers/ha-fixture'

describe('official HA WebSocket client connection pool', () => {
  let pool: ReturnType<typeof createHaConnectionPool>
  beforeEach(() => {
    vi.useFakeTimers()
    FakeHaWebSocket.reset()
    vi.stubGlobal('WebSocket', FakeHaWebSocket)
    pool = createHaConnectionPool()
  })
  afterEach(() => {
    pool.close()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('authenticates, shares one connection, subscribes and calls entity services', async () => {
    const [first, second] = await Promise.all([pool.acquire('https://ha.example.com', 'token'), pool.acquire('https://ha.example.com', 'token')])
    await vi.advanceTimersByTimeAsync(0)
    expect(FakeHaWebSocket.instances).toHaveLength(1)
    expect(FakeHaWebSocket.instances[0]?.url).toBe('wss://ha.example.com/api/websocket')
    const listener = vi.fn()
    first.subscribe(listener)
    expect(listener.mock.lastCall?.[0]['climate.living_room'].state).toBe('cool')
    await first.execute('climate.living_room', { service: 'set_temperature', data: { temperature: 24 } })
    expect(FakeHaWebSocket.calls[0]?.service_data.temperature).toBe(24)
    first.release()
    expect(FakeHaWebSocket.instances[0]?.readyState).toBe(1)
    second.release()
    expect(FakeHaWebSocket.instances[0]?.readyState).toBe(3)
  })

  it('restores subscriptions after disconnect without replaying offline commands', async () => {
    const lease = await pool.acquire('http://localhost:8123', 'token')
    await vi.advanceTimersByTimeAsync(0)
    const listener = vi.fn()
    lease.subscribe(listener)
    FakeHaWebSocket.instances[0]?.close()
    await expect(async () => lease.execute('climate.living_room', { service: 'set_hvac_mode', data: { hvac_mode: 'off' } })).rejects.toThrow('排队')
    await vi.advanceTimersByTimeAsync(10000)
    expect(FakeHaWebSocket.instances.length).toBeGreaterThan(1)
    expect(listener.mock.lastCall?.[0]['climate.living_room'].state).toBe('cool')
    expect(FakeHaWebSocket.calls).toHaveLength(0)
    lease.release()
  })

  it('stops on invalid authentication and closes late connections after cancellation', async () => {
    FakeHaWebSocket.invalidAuth = true
    await expect(pool.acquire('https://ha.example.com', 'bad')).rejects.toBe(ERR_INVALID_AUTH)
    await vi.advanceTimersByTimeAsync(10000)
    expect(FakeHaWebSocket.instances).toHaveLength(1)
    FakeHaWebSocket.invalidAuth = false
    const connecting = pool.acquire('https://other.example.com', 'token')
    pool.close()
    await expect(connecting).rejects.toThrow('取消')
    expect(FakeHaWebSocket.instances.at(-1)?.readyState).toBe(3)
  })
})
