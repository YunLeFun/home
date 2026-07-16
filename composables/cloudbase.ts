import { computed } from 'vue'
import type cloudbaseSdk from '@cloudbase/js-sdk'
import type { CloudBasePublicConfig, CloudBaseSharedSession } from '~/types'
import { toCloudBaseSharedSession } from '~/utils/cloudbase-session'

type CloudBaseSdk = typeof cloudbaseSdk
type CloudBaseApp = ReturnType<CloudBaseSdk['init']>
type CloudBaseAuth = ReturnType<CloudBaseApp['auth']>

interface CloudBaseSessionResult {
  session: CloudBaseSharedSession | null
  error: string | null
}

let cachedApp: CloudBaseApp | null = null
let cachedAuth: CloudBaseAuth | null = null
let cachedConfigKey = ''

function getPublicString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

async function loadCloudBaseSdk(): Promise<CloudBaseSdk> {
  const module = await import('@cloudbase/js-sdk')
  return module.default
}

export function useCloudBaseClient() {
  const config = useRuntimeConfig()
  const cloudbaseConfig = computed<CloudBasePublicConfig>(() => {
    const envId = getPublicString(config.public.cloudbaseEnvId)
    const accessKey = getPublicString(config.public.cloudbaseAccessKey)

    return {
      configured: Boolean(envId && accessKey),
      siteOrigin: getPublicString(config.public.siteOrigin, 'https://home.yunle.fun').replace(/\/+$/, ''),
      envId,
      region: getPublicString(config.public.cloudbaseRegion, 'ap-shanghai'),
      accessKey,
      sessionBridgeOrigin: getPublicString(config.public.cloudbaseSessionBridgeOrigin, 'https://www.yunle.fun').replace(/\/+$/, ''),
      sessionBridgePath: getPublicString(config.public.cloudbaseSessionBridgePath, '/auth/sso'),
    }
  })

  const isConfigured = computed(() => cloudbaseConfig.value.configured)

  async function getAuth() {
    if (typeof window === 'undefined' || !isConfigured.value)
      return null

    const activeConfig = cloudbaseConfig.value
    const configKey = `${activeConfig.envId}:${activeConfig.region}:${activeConfig.accessKey}`
    if (cachedAuth && cachedConfigKey === configKey)
      return cachedAuth

    const sdk = await loadCloudBaseSdk()
    cachedApp = sdk.init({
      env: activeConfig.envId,
      region: activeConfig.region,
      accessKey: activeConfig.accessKey,
      auth: {
        detectSessionInUrl: true,
      },
    })
    cachedAuth = cachedApp.auth({ persistence: 'local' })
    cachedConfigKey = configKey

    return cachedAuth
  }

  async function getSharedSession(): Promise<CloudBaseSessionResult> {
    const auth = await getAuth()
    if (!auth)
      return { session: null, error: isConfigured.value ? 'cloudbase_client_unavailable' : 'cloudbase_not_configured' }

    const result = await auth.getSession()
    if (result.error)
      return { session: null, error: result.error.message }

    const session = toCloudBaseSharedSession(result.data.session)
    if (session?.user?.is_anonymous)
      return { session: null, error: 'anonymous_session_ignored' }

    return { session, error: null }
  }

  async function setSharedSession(session: CloudBaseSharedSession): Promise<CloudBaseSessionResult> {
    const auth = await getAuth()
    if (!auth)
      return { session: null, error: isConfigured.value ? 'cloudbase_client_unavailable' : 'cloudbase_not_configured' }

    const result = await auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
    if (result.error)
      return { session: null, error: result.error.message }

    return {
      session: toCloudBaseSharedSession(result.data.session),
      error: null,
    }
  }

  return {
    config: cloudbaseConfig,
    isConfigured,
    getAuth,
    getSharedSession,
    setSharedSession,
  }
}
