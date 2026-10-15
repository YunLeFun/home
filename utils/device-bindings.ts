import { reactive } from 'vue'
import type { CloudSyncRecord } from '~/composables/cloud-sync'
import type { AcDeviceLink, AcDeviceSnapshot, AirConditionerState, DeviceBinding } from '~/types'
import { createAcController } from './ac-controller'
import { isUnknownRecord } from './cloud-sync'
import { createHaConnectionPool, haErrorMessage } from './home-assistant-client'
import type { HaLease } from './home-assistant-client'
import { climateToAcState, haBindingKey, haTokenStorageKey, nextSnapshotTimestamp, normalizeDeviceBinding, normalizeHaBaseUrl } from './home-assistant'

interface RecordOptions {
  collection: string
  keyField: 'deviceId'
  keyValue: string
  ownerId: string
}

interface BindingRecord { binding: DeviceBinding | null }
interface ReportedState extends AirConditionerState {
  homeAssistant: { bindingKey: string, reportedAt: string }
}

interface RuntimeOptions {
  storage: Storage
  securePage: boolean
  bindingsCollection: string
  statesCollection: string
  syncStates?: boolean
  read: <T>(options: RecordOptions) => Promise<CloudSyncRecord<T> | null>
  write: <T>(options: RecordOptions, state: T, changedAt: string, current?: CloudSyncRecord<T> | null) => Promise<CloudSyncRecord<T> | null>
}

interface DeviceEntry {
  view: AcDeviceLink
  bindingChangedAt: string | null
  generation: number
  lease?: HaLease
  controller?: ReturnType<typeof createAcController>
  writes: Promise<void>
}

function message(error: unknown) {
  return error instanceof Error ? error.message : '绑定信息同步失败，请重试'
}

export function createDeviceBindingRuntime(options: RuntimeOptions) {
  const entries = new Map<string, DeviceEntry>()
  const pool = createHaConnectionPool()
  let ownerId: string | null = null
  let ownerGeneration = 0

  function recordOptions(deviceId: string, collection: string, owner: string): RecordOptions {
    return { collection, keyField: 'deviceId', keyValue: deviceId, ownerId: owner }
  }

  function cacheKey(deviceId: string) {
    return `yun-home:binding:${encodeURIComponent(ownerId ?? '')}:${deviceId}`
  }

  function stop(entry: DeviceEntry) {
    entry.generation += 1
    entry.controller?.dispose()
    entry.controller = undefined
    entry.lease?.release()
    entry.lease = undefined
    entry.view.pending = false
    entry.view.ready = false
  }

  function persist(deviceId: string, entry: DeviceEntry) {
    options.storage.setItem(cacheKey(deviceId), JSON.stringify({ binding: entry.view.binding, changedAt: entry.bindingChangedAt }))
  }

  function saveReported(deviceId: string, entry: DeviceEntry, snapshot: AcDeviceSnapshot) {
    const owner = ownerId
    const binding = entry.view.binding
    const generation = entry.generation
    if (!owner || !binding || !snapshot.available || options.syncStates === false)
      return
    const key = haBindingKey(binding)
    entry.writes = entry.writes.then(async () => {
      if (ownerId !== owner || generation !== entry.generation)
        return
      const record = recordOptions(deviceId, options.statesCollection, owner)
      const remote = await options.read<ReportedState>(record)
      if (ownerId !== owner || generation !== entry.generation)
        return
      const source = remote?.state?.homeAssistant
      if (source?.bindingKey === key && Date.parse(source.reportedAt) >= Date.parse(snapshot.reportedAt))
        return
      const state: ReportedState = { ...snapshot.state, homeAssistant: { bindingKey: key, reportedAt: snapshot.reportedAt } }
      await options.write(record, state, nextSnapshotTimestamp(null, remote?.changedAt ?? null), remote)
      if (generation === entry.generation)
        entry.view.bindingError = null
    }).catch((error: unknown) => {
      if (generation === entry.generation)
        entry.view.bindingError = `设备已更新，云端快照保存失败：${message(error)}`
    })
  }

  async function connect(deviceId: string, entry: DeviceEntry) {
    stop(entry)
    entry.view.error = null
    entry.view.snapshot = null
    entry.view.mode = null
    entry.view.state = null
    const owner = ownerId
    const binding = entry.view.binding
    const generation = entry.generation
    if (!owner || !binding) {
      entry.view.status = 'unbound'
      return
    }
    const token = options.storage.getItem(haTokenStorageKey(owner, binding.baseUrl))
    if (!token) {
      entry.view.status = 'needs-token'
      return
    }
    entry.view.status = 'connecting'
    try {
      normalizeHaBaseUrl(binding.baseUrl, options.securePage)
      const lease = await pool.acquire(binding.baseUrl, token)
      if (generation !== entry.generation) {
        lease.release()
        return
      }
      entry.lease = lease
      lease.subscribe((entities, invalidAuth) => {
        if (generation !== entry.generation)
          return
        if (!entities) {
          entry.controller?.dispose()
          entry.controller = undefined
          entry.view.ready = false
          entry.view.pending = false
          entry.view.status = invalidAuth ? 'needs-token' : entry.view.snapshot ? 'offline' : 'connecting'
          entry.view.error = invalidAuth ? 'HA 令牌无效或已撤销，请重新输入' : null
          return
        }
        const entity = entities[binding.entityId]
        if (!entity) {
          entry.controller?.cancel()
          entry.view.status = 'error'
          entry.view.ready = false
          entry.view.error = 'HA 中已找不到这个实体，请重新绑定'
          return
        }
        if (entry.view.snapshot?.reportedAt === entity.last_updated && entry.view.ready)
          return
        const snapshot = climateToAcState(entity, entry.view.snapshot?.state)
        entry.view.snapshot = snapshot
        entry.view.ready = snapshot.available && !snapshot.capabilities.unsupportedReason
        entry.view.status = snapshot.available ? 'online' : 'offline'
        entry.view.error = snapshot.capabilities.unsupportedReason
        if (!entry.controller) {
          entry.controller = createAcController({
            execute: command => lease.execute(binding.entityId, command),
            read: async () => climateToAcState(await lease.read(binding.entityId), entry.view.snapshot?.state),
            render(state, pending, error, rawMode) {
              entry.view.state = state
              entry.view.mode = rawMode
              entry.view.pending = pending
              entry.view.error = error ?? entry.view.snapshot?.capabilities.unsupportedReason ?? null
            },
            report(reported) {
              entry.view.snapshot = reported
              entry.view.ready = reported.available && !reported.capabilities.unsupportedReason
              entry.view.status = reported.available ? 'online' : 'offline'
              saveReported(deviceId, entry, reported)
            },
          })
        }
        if (!snapshot.available)
          entry.controller.cancel('真实设备暂不可用')
        entry.controller.receive(snapshot)
      })
    }
    catch (error) {
      if (generation === entry.generation) {
        entry.view.status = 'error'
        entry.view.error = haErrorMessage(error)
      }
    }
  }

  function adopt(deviceId: string, entry: DeviceEntry, value: unknown, changedAt: string | null) {
    const binding = normalizeDeviceBinding(value)
    const changed = JSON.stringify(binding) !== JSON.stringify(entry.view.binding)
    entry.bindingChangedAt = changedAt
    entry.view.binding = binding
    persist(deviceId, entry)
    if (changed || (binding && !entry.lease))
      void connect(deviceId, entry)
  }

  async function refresh(deviceId: string) {
    const entry = entries.get(deviceId)
    const owner = ownerId
    const generation = ownerGeneration
    const bindingVersion = entry?.bindingChangedAt
    if (!entry || !owner)
      return
    try {
      const remote = await options.read<BindingRecord>(recordOptions(deviceId, options.bindingsCollection, owner))
      if (ownerId !== owner || generation !== ownerGeneration || bindingVersion !== entry.bindingChangedAt)
        return
      // Cached bindings are never pushed: an old browser must not resurrect an unbinding.
      if (remote)
        adopt(deviceId, entry, remote.state?.binding, remote.changedAt)
      else
        adopt(deviceId, entry, null, null)
      entry.view.bindingError = null
      entry.view.bindingLoaded = true
    }
    catch (error) {
      if (ownerId === owner && generation === ownerGeneration)
        entry.view.bindingError = message(error)
    }
  }

  function hydrate(deviceId: string, entry: DeviceEntry) {
    entry.bindingChangedAt = null
    entry.view.bindingLoaded = !ownerId
    if (ownerId) {
      try {
        const cached: unknown = JSON.parse(options.storage.getItem(cacheKey(deviceId)) ?? 'null')
        if (isUnknownRecord(cached)) {
          entry.view.binding = normalizeDeviceBinding(cached.binding)
          entry.view.bindingLoaded = Boolean(entry.view.binding)
          entry.bindingChangedAt = typeof cached.changedAt === 'string' ? cached.changedAt : null
        }
      }
      catch {
        options.storage.removeItem(cacheKey(deviceId))
      }
    }
    void connect(deviceId, entry)
    void refresh(deviceId)
  }

  function get(deviceId: string) {
    let entry = entries.get(deviceId)
    if (!entry) {
      entry = {
        view: reactive<AcDeviceLink>({ binding: null, status: 'unbound', error: null, bindingError: null, bindingLoaded: false, state: null, snapshot: null, mode: null, pending: false, ready: false }),
        bindingChangedAt: null, generation: 0, writes: Promise.resolve(),
      }
      entries.set(deviceId, entry)
      hydrate(deviceId, entry)
    }
    return entry.view
  }

  async function setBinding(deviceId: string, binding: DeviceBinding | null, token?: string) {
    const entry = entries.get(deviceId)
    const owner = ownerId
    const generation = ownerGeneration
    if (!owner || !entry)
      throw new Error('请先登录 YunLe，再保存设备绑定')
    const record = recordOptions(deviceId, options.bindingsCollection, owner)
    const remote = await options.read<BindingRecord>(record)
    if (owner !== ownerId || generation !== ownerGeneration)
      throw new Error('登录账号已变化，请重试')
    const changedAt = nextSnapshotTimestamp(entry.bindingChangedAt, remote?.changedAt ?? null)
    const winner = await options.write(record, { binding }, changedAt, remote)
    if (owner !== ownerId || generation !== ownerGeneration)
      throw new Error('登录账号已变化，请重试')
    if (winner) {
      adopt(deviceId, entry, winner.state.binding, winner.changedAt)
      throw new Error('绑定信息已在其他页面更新，请重试')
    }
    if (binding && token) {
      options.storage.setItem(haTokenStorageKey(owner, binding.baseUrl), token.trim())
      for (const other of entries.values()) {
        if (other.view.binding?.baseUrl === binding.baseUrl)
          stop(other)
      }
    }
    adopt(deviceId, entry, binding, changedAt)
    entry.view.bindingLoaded = true
    for (const [id, other] of entries) {
      if (id !== deviceId && binding && other.view.binding?.baseUrl === binding.baseUrl && !other.lease)
        void connect(id, other)
    }
  }

  return {
    get,
    refresh,
    setOwner(owner: string | null) {
      if (owner === ownerId)
        return
      ownerGeneration += 1
      for (const entry of entries.values()) {
        stop(entry)
        Object.assign(entry.view, { binding: null, state: null, snapshot: null, mode: null, error: null, bindingError: null })
      }
      pool.close()
      ownerId = owner
      for (const [id, entry] of entries)
        hydrate(id, entry)
    },
    request(deviceId: string, target: AirConditionerState, fields: Partial<AirConditionerState>, temperatureOnly: boolean) {
      const entry = entries.get(deviceId)
      if (!entry?.view.ready) {
        if (entry)
          entry.view.error = '真实设备未连接，操作未发送'
        return
      }
      entry.controller?.request(target, fields, temperatureOnly)
    },
    async testConnection(baseUrl: string, token: string) {
      const url = normalizeHaBaseUrl(baseUrl, options.securePage)
      if (!token.trim())
        throw new Error('请输入 HA 长期访问令牌')
      const lease = await pool.acquire(url, token.trim()).catch((error: unknown) => { throw new Error(haErrorMessage(error)) })
      try {
        return (await lease.list()).filter(entity => entity.entity_id.startsWith('climate.')).map(entity => ({ entityId: entity.entity_id, snapshot: climateToAcState(entity) }))
      }
      finally {
        lease.release()
      }
    },
    async bind(deviceId: string, value: unknown, token: string) {
      const owner = ownerId
      const generation = ownerGeneration
      if (!owner)
        throw new Error('请先登录 YunLe，再保存设备绑定')
      const binding = normalizeDeviceBinding(value)
      if (!binding)
        throw new Error('设备绑定信息无效')
      const entities = await this.testConnection(binding.baseUrl, token)
      const entity = entities.find(entity => entity.entityId === binding.entityId)
      if (!entity || entity.snapshot.capabilities.unsupportedReason)
        throw new Error(entity?.snapshot.capabilities.unsupportedReason ?? '请选择有效的空调实体')
      if (ownerId !== owner || generation !== ownerGeneration)
        throw new Error('登录账号已变化，请重试')
      await setBinding(deviceId, binding, token)
    },
    unbind: (deviceId: string) => setBinding(deviceId, null),
    forgetToken(baseUrl: string) {
      if (!ownerId)
        return
      options.storage.removeItem(haTokenStorageKey(ownerId, baseUrl))
      for (const [id, entry] of entries) {
        if (entry.view.binding?.baseUrl === baseUrl)
          void connect(id, entry)
      }
    },
    refreshAll() {
      for (const id of entries.keys())
        void refresh(id)
    },
    dispose() {
      ownerGeneration += 1
      for (const entry of entries.values())
        stop(entry)
      pool.close()
    },
  }
}
