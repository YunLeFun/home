import { describe, expect, it, vi } from 'vitest'
import { createCloudBaseRestDatabase } from '~/server/utils/cloudbase-database'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('CloudBase REST database adapter', () => {
  it('queries with bounded pagination and decodes strict EJSON', async () => {
    const requests: Array<{ init?: RequestInit, url: string }> = []
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), init })
      return jsonResponse({
      list: [{
        _id: { $oid: 'home-1' },
        revision: { $numberInt: '2' },
        updatedAt: { $numberLong: '1736929200000' },
      }],
      })
    })
    const database = createCloudBaseRestDatabase({ envId: 'cloud1-test', apiKey: 'server-key' }, fetcher)

    const result = await database.collection('home layouts').where({ ownerId: 'user-1' }).limit(5).get()

    expect(result.data).toEqual([{ _id: 'home-1', revision: 2, updatedAt: 1736929200000 }])
    const request = requests[0]!
    expect(request.url).toContain('/collections/home%20layouts/documents')
    expect(new URL(request.url).searchParams.get('query')).toBe('{"ownerId":"user-1"}')
    expect(new URL(request.url).searchParams.get('limit')).toBe('5')
    expect(new Headers(request.init?.headers).get('authorization')).toBe('Bearer server-key')
  })

  it('commits writes and keeps immutable ownership fields out of updates', async () => {
    const responses = [
      jsonResponse({ transactionId: 'txn-1' }, 201),
      jsonResponse({ list: [{ _id: 'device-1' }] }),
      jsonResponse({ updated: 1 }),
      new Response(null, { status: 204 }),
    ]
    const requests: Array<{ init?: RequestInit, url: string }> = []
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), init })
      return responses.shift()!
    })
    const database = createCloudBaseRestDatabase({ envId: 'cloud1-test', apiKey: 'server-key' }, fetcher)

    const result = await database.runTransaction(async (transaction) => {
      const collection = transaction.collection('devices')
      const current = await collection.where({ ownerId: 'user-1' }).limit(1).get()
      await collection.doc('device-1').update({
        _id: 'device-1',
        _openid: 'user-1',
        ownerId: 'user-1',
        updatedAt: 42,
      })
      return current.data?.length
    })

    expect(result).toBe(1)
    const update = requests[2]!
    expect(update.url).toContain('/collections/devices/documents/device-1')
    expect(JSON.parse(String(update.init?.body))).toEqual({
      data: { $set: { ownerId: 'user-1', updatedAt: 42 } },
      transactionId: 'txn-1',
    })
    expect(requests[3]?.url).toContain('/transactions/txn-1/commit')
  })

  it('rolls back and retries database transaction conflicts', async () => {
    const responses = [
      jsonResponse({ transactionId: 'txn-1' }, 201),
      jsonResponse({ code: 'DATABASE_TRANSACTION_CONFLICT', message: 'retry' }, 503),
      new Response(null, { status: 204 }),
      jsonResponse({ transactionId: 'txn-2' }, 201),
      jsonResponse({ list: [] }),
      new Response(null, { status: 204 }),
    ]
    const requests: string[] = []
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      requests.push(String(input))
      return responses.shift()!
    })
    const database = createCloudBaseRestDatabase({ envId: 'cloud1-test', apiKey: 'server-key' }, fetcher)
    let attempts = 0

    const result = await database.runTransaction(async (transaction) => {
      attempts += 1
      return await transaction.collection('homes').where({ ownerId: 'user-1' }).limit(1).get()
    })

    expect(attempts).toBe(2)
    expect(result.data).toEqual([])
    expect(requests[2]).toContain('/transactions/txn-1/rollback')
    expect(requests[5]).toContain('/transactions/txn-2/commit')
  })

  it('maps network failures to a retryable service error', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('socket closed')
    })
    const database = createCloudBaseRestDatabase({ envId: 'cloud1-test', apiKey: 'server-key' }, fetcher)

    await expect(database.collection('homes').where({ ownerId: 'user-1' }).get()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      statusCode: 503,
      statusMessage: 'CloudBase database request failed',
    })
  })
})
