import {
  callService,
  createConnection,
  createLongLivedTokenAuth,
  ERR_INVALID_AUTH,
  getStates,
  subscribeEntities,
} from 'home-assistant-js-websocket'
import type { Connection, HassEntities } from 'home-assistant-js-websocket'
import type { AcCommand, HomeAssistantEntity } from './home-assistant'

export function haErrorMessage(error: unknown) {
  return error === ERR_INVALID_AUTH ? 'HA 令牌无效或已撤销，请重新输入' : '无法连接 HA，请检查地址、证书及网络'
}

export async function withHaTimeout<T>(promise: Promise<T>, milliseconds = 10000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([promise, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('HA 请求超时')), milliseconds)
    })])
  }
  finally {
    clearTimeout(timer)
  }
}

export interface HaLease {
  list: () => Promise<HomeAssistantEntity[]>
  read: (entityId: string) => Promise<HomeAssistantEntity>
  execute: (entityId: string, command: AcCommand) => Promise<unknown>
  subscribe: (listener: (entities: HassEntities | null, invalidAuth: boolean) => void) => () => void
  release: () => void
}

interface PoolEntry {
  token: string
  refs: number
  closed: boolean
  fresh: boolean
  connection?: Connection
  entities: HassEntities | null
  listeners: Set<(entities: HassEntities | null, invalidAuth: boolean) => void>
  unsubscribe?: () => void
  heartbeat?: ReturnType<typeof setInterval>
  promise: Promise<Connection>
}

export function createHaConnectionPool() {
  const entries = new Map<string, PoolEntry>()

  function publish(entry: PoolEntry, invalidAuth = false) {
    for (const listener of entry.listeners)
      listener(entry.fresh ? entry.entities : null, invalidAuth)
  }

  function close(baseUrl: string, entry: PoolEntry) {
    entry.closed = true
    entry.unsubscribe?.()
    clearInterval(entry.heartbeat)
    entry.connection?.close()
    entry.listeners.clear()
    if (entries.get(baseUrl) === entry)
      entries.delete(baseUrl)
  }

  async function acquire(baseUrl: string, token: string): Promise<HaLease> {
    let entry = entries.get(baseUrl)
    if (entry && entry.token !== token) {
      entry.fresh = false
      publish(entry)
      close(baseUrl, entry)
      entry = undefined
    }
    if (!entry) {
      const created: PoolEntry = {
        token, refs: 0, closed: false, fresh: false, entities: null, listeners: new Set(),
        promise: createConnection({ auth: createLongLivedTokenAuth(baseUrl, token), setupRetry: 0, connectTimeout: 8000 }),
      }
      entry = created
      entries.set(baseUrl, created)
      created.promise = created.promise.then((connection) => {
        if (created.closed) {
          connection.close()
          throw new Error('连接已取消')
        }
        created.connection = connection
        connection.addEventListener('disconnected', () => {
          created.fresh = false
          publish(created)
        })
        connection.addEventListener('reconnect-error', (_connection, code: unknown) => {
          if (code === ERR_INVALID_AUTH) {
            created.fresh = false
            publish(created, true)
            close(baseUrl, created)
          }
        })
        created.unsubscribe = subscribeEntities(connection, (entities) => {
          if (created.closed || !connection.connected)
            return
          created.entities = entities
          created.fresh = true
          publish(created)
        })
        created.heartbeat = setInterval(() => {
          if (connection.connected)
            void withHaTimeout(connection.ping(), 5000).catch(() => connection.reconnect(true))
        }, 30000)
        return connection
      })
    }
    const current = entry
    current.refs += 1
    let connection: Connection
    try {
      connection = await withHaTimeout(current.promise)
    }
    catch (error) {
      current.refs -= 1
      if (!current.refs)
        close(baseUrl, current)
      throw error
    }
    let released = false
    const ownedListeners = new Set<(entities: HassEntities | null, invalidAuth: boolean) => void>()
    const assertConnected = () => {
      if (released || current.closed || !connection.connected || !current.fresh)
        throw new Error('设备连接尚未就绪，操作不会排队重放')
    }
    return {
      async list() {
        // A fresh read also makes the connection test independent of subscription timing.
        return await withHaTimeout(getStates(connection))
      },
      async read(entityId) {
        assertConnected()
        const entities = await withHaTimeout(getStates(connection))
        const entity = entities.find(entity => entity.entity_id === entityId)
        if (!entity)
          throw new Error('HA 中已找不到这个实体')
        return entity
      },
      execute(entityId, command) {
        assertConnected()
        // Keep this check and call synchronous: the official client queues calls made during reconnect.
        return withHaTimeout(callService(connection, 'climate', command.service, command.data, { entity_id: entityId }))
      },
      subscribe(listener) {
        ownedListeners.add(listener)
        current.listeners.add(listener)
        listener(current.fresh ? current.entities : null, false)
        return () => {
          ownedListeners.delete(listener)
          current.listeners.delete(listener)
        }
      },
      release() {
        if (released)
          return
        released = true
        for (const listener of ownedListeners)
          current.listeners.delete(listener)
        ownedListeners.clear()
        current.refs -= 1
        if (!current.refs)
          close(baseUrl, current)
      },
    }
  }

  return {
    acquire,
    close() {
      for (const [baseUrl, entry] of entries)
        close(baseUrl, entry)
    },
  }
}
