import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CloudSyncRecord } from '~/composables/cloud-sync'
import { createDeviceBindingRuntime } from '~/utils/device-bindings'
import { haTokenStorageKey } from '~/utils/home-assistant'
import { climate, FakeHaWebSocket, MemoryStorage } from './helpers/ha-fixture'

const binding = { provider: 'home-assistant', baseUrl: 'https://ha.example.com', entityId: 'climate.living_room' } as const
type RuntimeOptions = Parameters<typeof createDeviceBindingRuntime>[0]

function repository() {
  const records = new Map<string, CloudSyncRecord<unknown>>()
  const key = (options: Parameters<RuntimeOptions['read']>[0]) => `${options.ownerId}:${options.collection}:${options.keyValue}`
  const read: RuntimeOptions['read'] = async <T>(options: Parameters<RuntimeOptions['read']>[0]) => records.get(key(options)) as CloudSyncRecord<T> ?? null
  const writes: unknown[] = []
  const write: RuntimeOptions['write'] = async <T>(options: Parameters<RuntimeOptions['read']>[0], state: T, changedAt: string) => {
    const remote = await read<T>(options)
    if (remote && Date.parse(remote.changedAt) > Date.parse(changedAt))
      return remote
    writes.push(JSON.parse(JSON.stringify(state)))
    records.set(key(options), { id: key(options), state: JSON.parse(JSON.stringify(state)), changedAt })
    return null
  }
  return { read, write, records, writes }
}

describe('account-scoped device binding runtime', () => {
  const runtimes: ReturnType<typeof createDeviceBindingRuntime>[] = []
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeHaWebSocket)
    FakeHaWebSocket.reset()
  })
  afterEach(() => {
    runtimes.splice(0).forEach(runtime => runtime.dispose())
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function setup(repo = repository(), storage = new MemoryStorage(), syncStates = true) {
    const runtime = createDeviceBindingRuntime({ storage, securePage: true, statesCollection: 'states', bindingsCollection: 'bindings', syncStates, read: repo.read, write: repo.write })
    runtimes.push(runtime)
    runtime.setOwner('alice')
    const view = runtime.get('air-conditioner')
    return { runtime, view, repo, storage }
  }

  it('stores only whitelisted binding data in cloud and never publishes optimistic state', async () => {
    const { runtime, view, repo, storage } = setup()
    await vi.advanceTimersByTimeAsync(0)
    await runtime.bind('air-conditioner', { ...binding, token: 'must-not-upload' }, 'local-secret')
    await vi.advanceTimersByTimeAsync(0)
    expect(view.status).toBe('online')
    expect(storage.getItem(haTokenStorageKey('alice', binding.baseUrl))).toBe('local-secret')
    expect(JSON.stringify(repo.writes)).not.toMatch(/local-secret|must-not-upload/)
    const before = repo.writes.length
    runtime.request('air-conditioner', { status: true, mode: 'cold', temperature: 24 }, { temperature: 24 }, true)
    await vi.advanceTimersByTimeAsync(600)
    expect(view.state?.temperature).toBe(24)
    expect(repo.writes.length).toBe(before)
    FakeHaWebSocket.entities = [climate('cool', 24, '2026-10-15T10:01:00Z')]
    FakeHaWebSocket.instances.at(-1)?.push()
    await vi.advanceTimersByTimeAsync(0)
    expect(repo.writes.length).toBe(before + 1)
    expect(view.pending).toBe(false)
  })

  it('loads cloud bindings without tokens on a new browser and isolates switched accounts', async () => {
    const first = setup()
    await vi.advanceTimersByTimeAsync(0)
    await first.runtime.bind('air-conditioner', binding, 'local-secret')
    await vi.advanceTimersByTimeAsync(0)
    const second = setup(first.repo)
    await vi.advanceTimersByTimeAsync(0)
    expect(second.view.status).toBe('needs-token')
    expect(second.view.binding).toEqual(binding)
    first.runtime.setOwner('bob')
    await vi.advanceTimersByTimeAsync(0)
    expect(first.view.binding).toBeNull()
    expect(first.view.state).toBeNull()
    expect(first.storage.getItem(haTokenStorageKey('bob', binding.baseUrl))).toBeNull()
    expect(FakeHaWebSocket.instances.at(-1)?.readyState).toBe(3)
  })

  it('applies unbinding tombstones instead of pushing an old cached binding', async () => {
    const first = setup()
    await vi.advanceTimersByTimeAsync(0)
    await first.runtime.bind('air-conditioner', binding, 'token')
    await vi.advanceTimersByTimeAsync(0)
    const staleStorage = new MemoryStorage()
    for (let i = 0; i < first.storage.length; i++) {
      const key = first.storage.key(i)!
      staleStorage.setItem(key, first.storage.getItem(key)!)
    }
    await first.runtime.unbind('air-conditioner')
    const before = first.repo.writes.length
    const second = setup(first.repo, staleStorage)
    await vi.advanceTimersByTimeAsync(0)
    expect(second.view.binding).toBeNull()
    expect(second.view.status).toBe('unbound')
    expect(first.repo.writes.length).toBe(before)
    expect(first.repo.writes.at(-1)).toEqual({ binding: null })
  })

  it('cancels pending operations when unbound and never replays them after reconnect', async () => {
    const { runtime, view } = setup()
    await vi.advanceTimersByTimeAsync(0)
    await runtime.bind('air-conditioner', binding, 'token')
    await vi.advanceTimersByTimeAsync(0)
    runtime.request('air-conditioner', { status: true, mode: 'cold', temperature: 24 }, { temperature: 24 }, true)
    await runtime.unbind('air-conditioner')
    await vi.advanceTimersByTimeAsync(10000)
    expect(view.pending).toBe(false)
    expect(FakeHaWebSocket.calls).toHaveLength(0)
  })

  it('does not save a binding into an account switched during connection testing', async () => {
    const { runtime, repo, storage } = setup()
    await vi.advanceTimersByTimeAsync(0)
    const saving = runtime.bind('air-conditioner', binding, 'alice-token')
    runtime.setOwner('bob')
    await expect(saving).rejects.toThrow()
    expect(repo.writes).toHaveLength(0)
    expect(storage.getItem(haTokenStorageKey('bob', binding.baseUrl))).toBeNull()
  })

  it('keeps binding synchronization while respecting the device-state sync opt-out', async () => {
    const { runtime, repo, view } = setup(repository(), new MemoryStorage(), false)
    await vi.advanceTimersByTimeAsync(0)
    await runtime.bind('air-conditioner', binding, 'token')
    await vi.advanceTimersByTimeAsync(0)
    FakeHaWebSocket.entities = [climate('cool', 24, '2026-10-15T10:01:00Z')]
    FakeHaWebSocket.instances.at(-1)?.push()
    await vi.advanceTimersByTimeAsync(0)
    expect(view.state?.temperature).toBe(24)
    expect(repo.writes).toEqual([{ binding }])
  })
})
