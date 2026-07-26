import { computed } from 'vue'
import type cloudbaseSdk from '@cloudbase/js-sdk'
import type { CloudBasePublicConfig, CloudBaseSharedSession } from '~/types'
import { toCloudBaseSharedSession } from '~/utils/cloudbase-session'

type CloudBaseSdk = typeof cloudbaseSdk
type CloudBaseApp = ReturnType<CloudBaseSdk['init']>
type CloudBaseAuth = ReturnType<CloudBaseApp['auth']>
type CloudBaseDatabase = ReturnType<CloudBaseApp['database']>

interface CloudBaseSessionResult {
  session: CloudBaseSharedSession | null
  error: string | null
}

let cachedAuth: CloudBaseAuth | null = null
let cachedDatabase: CloudBaseDatabase | null = null
let cachedConfigKey = ''

function getPublicString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

export function useCloudBaseClient() {
  const config = useRuntimeConfig()
  const nuxtApp = useNuxtApp()
  const cloudbaseConfig = computed<CloudBasePublicConfig>(() => {
    const envId = getPublicString(config.public.cloudbaseEnvId)
    const accessKey = getPublicString(config.public.cloudbaseAccessKey)

    return {
      configured: Boolean(envId && accessKey),
      siteOrigin: getPublicString(config.public.siteOrigin, 'https://home.yunle.fun').replace(/\/+$/, ''),
      envId,
      region: getPublicString(config.public.cloudbaseRegion, 'ap-shanghai'),
      accessKey,
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

    const sdk = nuxtApp.$cloudbaseSdk as CloudBaseSdk | undefined
    if (!sdk)
      return null

    const app = sdk.init({
      env: activeConfig.envId,
      region: activeConfig.region,
      accessKey: activeConfig.accessKey,
      auth: {
        detectSessionInUrl: false,
      },
    })
    cachedAuth = app.auth({ persistence: 'local' })
    cachedDatabase = app.database()
    cachedConfigKey = configKey

    return cachedAuth
  }

  async function getDatabase() {
    const auth = await getAuth()
    if (!auth || !cachedDatabase)
      return null

    return cachedDatabase
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

  return {
    config: cloudbaseConfig,
    isConfigured,
    getAuth,
    getDatabase,
    getSharedSession,
  }
}
