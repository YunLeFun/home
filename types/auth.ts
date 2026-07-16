export interface YunleSessionUser {
  id: string
  name?: string
  avatarUrl?: string
}

export type YunleSessionProvider = 'cloudbase'

export type YunleSessionReason =
  | 'cloudbase_not_configured'
  | 'missing_cloudbase_session'
  | 'cloudbase_bridge_unavailable'
  | 'cloudbase_bridge_denied'

export interface YunleSession {
  authenticated: boolean
  provider: YunleSessionProvider
  user: YunleSessionUser | null
  reason?: YunleSessionReason
  loginUrl: string
  logoutUrl: string
  authOrigin: string
  appsOrigin: string
  cloudbase: CloudBasePublicConfig
}

export interface CloudBasePublicConfig {
  configured: boolean
  siteOrigin: string
  envId: string
  region: string
  accessKey: string
  sessionBridgeOrigin: string
  sessionBridgePath: string
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

export type YunleSsoResultReason = 'invalid_request' | 'not_authenticated'

export interface YunleSsoResultMessage {
  type: 'ylf:sso-result'
  ok: boolean
  nonce: string
  reason?: YunleSsoResultReason
  session?: unknown
}
