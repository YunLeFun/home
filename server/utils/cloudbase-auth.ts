import type { H3Event } from 'h3'

export interface VerifiedCloudBaseUser {
  id: string
  email?: string | null
  phone?: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function readString(value: unknown) {
  if (typeof value !== 'string' || value.length === 0)
    return undefined

  return value
}

function readNullableString(value: unknown) {
  return value === null ? null : readString(value)
}

function getStatusCode(error: unknown) {
  if (!isRecord(error))
    return undefined
  const statusCode = Number(error.statusCode ?? error.status)
  return Number.isFinite(statusCode) ? statusCode : undefined
}

function readBearerToken(event: H3Event) {
  const authorization = getHeader(event, 'authorization')
  if (!authorization)
    return null

  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim())
  return match?.[1] ?? null
}

function toVerifiedCloudBaseUser(value: unknown): VerifiedCloudBaseUser | null {
  if (!isRecord(value))
    return null

  const id = readString(value.id) ?? readString(value.uid) ?? readString(value.sub)
  if (!id)
    return null

  return {
    id,
    email: readNullableString(value.email),
    phone: readNullableString(value.phone),
  }
}

export async function requireCloudBaseUser(event: H3Event): Promise<VerifiedCloudBaseUser> {
  const cloudbase = getCloudBasePublicConfig()
  if (!cloudbase.envId) {
    throw createError({
      statusCode: 503,
      statusMessage: 'CloudBase environment is not configured',
    })
  }

  const token = readBearerToken(event)
  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'CloudBase access token is required',
    })
  }

  try {
    const profile = await $fetch<unknown>(`https://${cloudbase.envId}.api.tcloudbasegateway.com/auth/v1/user/me`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(10_000),
    })
    const user = toVerifiedCloudBaseUser(profile)
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'CloudBase access token is invalid',
      })
    }

    return user
  }
  catch (error) {
    const statusCode = getStatusCode(error)
    if (statusCode === 401 || statusCode === 403)
      throw error

    throw createError({
      statusCode: 503,
      statusMessage: 'CloudBase authentication service is unavailable',
    })
  }
}
