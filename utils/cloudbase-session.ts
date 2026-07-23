import type {
  CloudBasePublicConfig,
  CloudBaseSharedSession,
  CloudBaseSharedUser,
  YunleSession,
} from '~/types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function getString(value: unknown) {
  if (typeof value !== 'string' || value.length === 0)
    return undefined

  return value
}

function getBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

function getNumber(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value))
    return undefined

  return value
}

export function parseOriginList(value: string | undefined, fallback: string[] = []) {
  if (!value)
    return fallback

  return value
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
}

export function isCloudBaseSharedSession(value: unknown): value is CloudBaseSharedSession {
  if (!isRecord(value))
    return false

  return typeof value.access_token === 'string' && typeof value.refresh_token === 'string'
}

export function toCloudBaseSharedUser(value: unknown): CloudBaseSharedUser | undefined {
  if (!isRecord(value))
    return undefined

  const userMetadata = isRecord(value.user_metadata) ? value.user_metadata : undefined

  return {
    id: getString(value.id),
    email: getString(value.email) ?? null,
    phone: getString(value.phone) ?? null,
    is_anonymous: getBoolean(value.is_anonymous),
    user_metadata: userMetadata,
  }
}

export function toCloudBaseSharedSession(value: unknown): CloudBaseSharedSession | null {
  if (!isRecord(value))
    return null

  const accessToken = getString(value.access_token)
  const refreshToken = getString(value.refresh_token)
  if (!accessToken || !refreshToken)
    return null

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: getNumber(value.expires_in),
    token_type: getString(value.token_type),
    user: toCloudBaseSharedUser(value.user),
  }
}

export function createYunleSessionFromCloudBase(options: {
  session: CloudBaseSharedSession
  cloudbase: CloudBasePublicConfig
  logoutUrl: string
  authOrigin: string
}): YunleSession {
  const metadata = options.session.user?.user_metadata
  const metadataName = metadata ? getString(metadata.name) ?? getString(metadata.nickName) ?? getString(metadata.username) : undefined
  const metadataAvatar = metadata ? getString(metadata.picture) ?? getString(metadata.avatarUrl) : undefined
  const metadataUid = metadata ? getString(metadata.uid) : undefined
  const userId = options.session.user?.id ?? metadataUid ?? 'cloudbase-user'

  return {
    authenticated: true,
    provider: 'cloudbase',
    user: {
      id: userId,
      name: metadataName,
      avatarUrl: metadataAvatar,
    },
    logoutUrl: options.logoutUrl,
    authOrigin: options.authOrigin,
    cloudbase: options.cloudbase,
  }
}
