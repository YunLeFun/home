import type { H3Event } from 'h3'
import type { CloudBasePublicConfig, YunleSession } from '~/types'

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function buildAuthUrl(origin: string, path: string, redirectTo: string) {
  const url = new URL(path, origin)
  url.searchParams.set('redirect', redirectTo)
  return url.toString()
}

function getRedirectTo(event: H3Event) {
  const redirect = getQuery(event).redirect
  return typeof redirect === 'string' ? redirect : getRequestURL(event).toString()
}

export function getYunleSession(event: H3Event): YunleSession {
  const config = useRuntimeConfig()
  const authOrigin = trimTrailingSlash(String(config.public.yunleAuthOrigin))
  const appsOrigin = trimTrailingSlash(String(config.public.yunleAppsOrigin))
  const redirectTo = getRedirectTo(event)
  const cloudbase = getCloudBasePublicConfig()

  return {
    authenticated: false,
    provider: 'cloudbase',
    user: null,
    reason: cloudbase.configured ? 'missing_cloudbase_session' : 'cloudbase_not_configured',
    loginUrl: buildAuthUrl(authOrigin, '/login', redirectTo),
    logoutUrl: buildAuthUrl(authOrigin, '/logout', appsOrigin),
    authOrigin,
    appsOrigin,
    cloudbase,
  }
}

export function getCloudBasePublicConfig(): CloudBasePublicConfig {
  const config = useRuntimeConfig()
  const envId = String(config.public.cloudbaseEnvId)
  const accessKey = String(config.public.cloudbaseAccessKey)

  return {
    configured: Boolean(envId && accessKey),
    siteOrigin: trimTrailingSlash(String(config.public.siteOrigin)),
    envId,
    region: String(config.public.cloudbaseRegion),
    accessKey,
    sessionBridgeOrigin: trimTrailingSlash(String(config.public.cloudbaseSessionBridgeOrigin)),
    sessionBridgePath: String(config.public.cloudbaseSessionBridgePath),
  }
}
