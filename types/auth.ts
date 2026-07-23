export interface YunleSessionUser {
  id: string
  name?: string
  avatarUrl?: string
}

export type YunleSessionProvider = 'cloudbase'

export type YunleSessionReason =
  | 'cloudbase_not_configured'
  | 'missing_cloudbase_session'

export interface YunleSession {
  authenticated: boolean
  provider: YunleSessionProvider
  user: YunleSessionUser | null
  reason?: YunleSessionReason
  logoutUrl: string
  authOrigin: string
  cloudbase: CloudBasePublicConfig
}

export interface CloudBasePublicConfig {
  configured: boolean
  siteOrigin: string
  envId: string
  region: string
  accessKey: string
}

export interface CloudBaseSharedUser {
  id?: string
  email?: string | null
  phone?: string | null
  is_anonymous?: boolean
  user_metadata?: Record<string, unknown>
}

export interface CloudBaseSharedSession {
  access_token: string
  refresh_token: string
  expires_in?: number
  token_type?: string
  user?: CloudBaseSharedUser
}
