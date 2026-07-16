interface CloudBaseQueryResponse {
  list?: unknown[]
}

interface CloudBaseTransactionResponse {
  transactionId?: string
}

interface CloudBaseErrorResponse {
  code?: string
  message?: string
  request_id?: string
}

interface CloudBaseRestConfig {
  envId: string
  apiKey: string
  timeoutMs?: number
}

interface CloudBaseRequestOptions {
  body?: Record<string, unknown>
  method?: 'GET' | 'PATCH' | 'POST'
  query?: Record<string, string | number | undefined>
}

interface CloudBaseFetch {
  (input: string | URL | Request, init?: RequestInit): Promise<Response>
}

export interface CloudBaseDatabase {
  collection: (name: string) => CloudBaseCollection
  runTransaction: <T>(callback: (transaction: CloudBaseTransaction) => Promise<T>) => Promise<T>
}

export interface CloudBaseTransaction {
  collection: (name: string) => CloudBaseCollection
}

export interface CloudBaseCollection {
  where: (query: Record<string, unknown>) => CloudBaseQuery
  doc: (id: string) => CloudBaseDocument
  add: (data: Record<string, unknown>) => Promise<unknown>
}

interface CloudBaseQuery {
  limit: (count: number) => CloudBaseQuery
  get: () => Promise<{ data?: unknown[] }>
}

interface CloudBaseDocument {
  update: (data: Record<string, unknown>) => Promise<unknown>
}

class CloudBaseHttpError extends Error {
  readonly statusCode: number
  readonly statusMessage = 'CloudBase database request failed'

  constructor(
    message: string,
    readonly status: number,
    readonly code = '',
    readonly requestId = '',
  ) {
    super(message)
    this.name = 'CloudBaseHttpError'
    this.statusCode = status >= 500 ? 503 : 502
  }
}

const DEFAULT_DATABASE_PATH = '/v1/database/instances/(default)/databases/(default)'
const TRANSACTION_CONFLICT_CODE = 'DATABASE_TRANSACTION_CONFLICT'
const MAX_TRANSACTION_ATTEMPTS = 3

let cachedDatabase: { key: string, database: CloudBaseDatabase } | null = null

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function getCloudBaseServerConfig(): CloudBaseRestConfig {
  const config = useRuntimeConfig()
  return {
    envId: readString(config.public.cloudbaseEnvId),
    apiKey: readString(config.cloudbaseApiKey),
  }
}

function assertValidEnvId(envId: string) {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(envId))
    throw new Error('CloudBase environment ID is invalid')
}

function decodeExtendedJson(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(decodeExtendedJson)
  if (value === null || typeof value !== 'object')
    return value

  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  if (keys.length === 1) {
    if (typeof record.$oid === 'string')
      return record.$oid
    if (typeof record.$numberInt === 'string' || typeof record.$numberLong === 'string') {
      const number = Number(record.$numberInt ?? record.$numberLong)
      return Number.isSafeInteger(number) ? number : String(record.$numberInt ?? record.$numberLong)
    }
    if (typeof record.$numberDouble === 'string')
      return Number(record.$numberDouble)
    if (typeof record.$numberDecimal === 'string')
      return record.$numberDecimal
    if (typeof record.$date === 'string')
      return record.$date
    if (record.$date && typeof record.$date === 'object') {
      const milliseconds = decodeExtendedJson(record.$date)
      const timestamp = typeof milliseconds === 'number' ? milliseconds : Number(milliseconds)
      if (Number.isFinite(timestamp))
        return new Date(timestamp).toISOString()
    }
  }

  return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, decodeExtendedJson(child)]))
}

function withoutImmutableFields(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([key]) => key !== '_id' && key !== '_openid'))
}

function isTransactionConflict(error: unknown) {
  return error instanceof CloudBaseHttpError && error.code === TRANSACTION_CONFLICT_CODE
}

function parseResponseBody(text: string): unknown {
  if (!text)
    return {}
  try {
    return decodeExtendedJson(JSON.parse(text))
  }
  catch {
    return {}
  }
}

class CloudBaseRestDatabase implements CloudBaseDatabase {
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor(
    private readonly config: CloudBaseRestConfig,
    private readonly fetcher: CloudBaseFetch,
  ) {
    assertValidEnvId(config.envId)
    this.baseUrl = `https://${config.envId}.api.tcloudbasegateway.com${DEFAULT_DATABASE_PATH}`
    this.timeoutMs = config.timeoutMs ?? 15_000
  }

  collection(name: string) {
    return this.createCollection(name)
  }

  async runTransaction<T>(callback: (transaction: CloudBaseTransaction) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      const started = await this.request<CloudBaseTransactionResponse>('/transactions', { method: 'POST' })
      if (!started.transactionId)
        throw new Error('CloudBase did not return a transaction ID')

      const transactionId = started.transactionId
      try {
        const value = await callback({
          collection: name => this.createCollection(name, transactionId),
        })
        await this.request(`/transactions/${encodeURIComponent(transactionId)}/commit`, { method: 'POST' })
        return value
      }
      catch (error) {
        await this.request(`/transactions/${encodeURIComponent(transactionId)}/rollback`, { method: 'POST' }).catch(() => undefined)
        if (!isTransactionConflict(error) || attempt === MAX_TRANSACTION_ATTEMPTS - 1)
          throw error
      }
    }

    throw new Error('CloudBase transaction retry limit reached')
  }

  private createCollection(name: string, transactionId?: string): CloudBaseCollection {
    if (!name)
      throw new Error('CloudBase collection name is required')
    const collectionPath = `/collections/${encodeURIComponent(name)}/documents`

    return {
      add: data => this.request(collectionPath, {
        method: 'POST',
        body: {
          data: [data],
          ...(transactionId ? { transactionId } : {}),
        },
      }),
      doc: id => ({
        update: data => this.request(`${collectionPath}/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: {
            data: { $set: withoutImmutableFields(data) },
            ...(transactionId ? { transactionId } : {}),
          },
        }),
      }),
      where: query => this.createQuery(collectionPath, query, transactionId),
    }
  }

  private createQuery(collectionPath: string, query: Record<string, unknown>, transactionId?: string): CloudBaseQuery {
    let limit = 100
    const cloudBaseQuery: CloudBaseQuery = {
      limit: (count) => {
        limit = Math.min(Math.max(Math.trunc(count), 1), 1000)
        return cloudBaseQuery
      },
      get: async () => {
        const response = await this.request<CloudBaseQueryResponse>(collectionPath, {
          query: {
            query: JSON.stringify(query),
            limit,
            transactionId,
          },
        })
        return { data: Array.isArray(response.list) ? response.list : [] }
      },
    }
    return cloudBaseQuery
  }

  private async request<T = Record<string, unknown>>(path: string, options: CloudBaseRequestOptions = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined)
        url.searchParams.set(key, String(value))
    }

    let response: Response
    try {
      response = await this.fetcher(url, {
        method: options.method ?? 'GET',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${this.config.apiKey}`,
          'content-type': 'application/json',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    }
    catch {
      throw new CloudBaseHttpError('CloudBase database service is unavailable', 503, 'NETWORK_ERROR')
    }

    const payload = parseResponseBody(await response.text())
    if (!response.ok) {
      const error = payload && typeof payload === 'object' ? payload as CloudBaseErrorResponse : {}
      throw new CloudBaseHttpError(
        error.message || `CloudBase request failed with status ${response.status}`,
        response.status,
        error.code,
        error.request_id,
      )
    }
    return payload as T
  }
}

export function createCloudBaseRestDatabase(config: CloudBaseRestConfig, fetcher: CloudBaseFetch = fetch) {
  if (!config.apiKey)
    throw new Error('CloudBase API key is required')
  return new CloudBaseRestDatabase(config, fetcher)
}

export function isCloudBaseServerConfigured() {
  const config = getCloudBaseServerConfig()
  return Boolean(config.envId && config.apiKey)
}

export async function getCloudBaseDatabase(): Promise<CloudBaseDatabase> {
  const config = getCloudBaseServerConfig()
  const key = `${config.envId}:${config.apiKey}`
  if (cachedDatabase?.key !== key)
    cachedDatabase = { key, database: createCloudBaseRestDatabase(config) }
  return cachedDatabase.database
}
