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

export function getYunleSession(_event: H3Event): YunleSession {
  const config = useRuntimeConfig()
  const authOrigin = trimTrailingSlash(String(config.public.ssoOrigin))
  const siteOrigin = trimTrailingSlash(String(config.public.siteOrigin))
  const cloudbase = getCloudBasePublicConfig()

  return {
    authenticated: false,
    provider: 'cloudbase',
    user: null,
    reason: cloudbase.configured ? 'missing_cloudbase_session' : 'cloudbase_not_configured',
    logoutUrl: buildAuthUrl(authOrigin, '/logout', siteOrigin),
    authOrigin,
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
  }
}
