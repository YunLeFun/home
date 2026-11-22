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

let pendingApp: Promise<CloudBaseApp> | null = null
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

  // v3 persists OAuth credentials under this environment-specific key. Presence
  // only hints that a session exists. The SDK still validates and renews it.
  const credentialsKey = computed(() => `credentials_${cloudbaseConfig.value.envId}`)

  function hasStoredSession() {
    try {
      return Boolean(window.localStorage.getItem(credentialsKey.value))
    }
    catch {
      return false
    }
  }

  async function getAuth(reason: 'restore' | 'sso' = 'restore') {
    if (!import.meta.client || !isConfigured.value)
      return null
    const { envId, region, accessKey } = cloudbaseConfig.value
    const configKey = `${envId}:${region}:${accessKey}`
    if (configKey !== cachedConfigKey) {
      pendingApp = null
      cachedAuth = null
      cachedDatabase = null
      cachedConfigKey = configKey
    }
    if (cachedAuth)
      return cachedAuth
    if (!pendingApp && reason === 'restore' && !hasStoredSession())
      return null
    pendingApp ??= nuxtApp.$loadCloudbaseAuth()
      .then(sdk => sdk.init({ env: envId, region, accessKey, auth: { detectSessionInUrl: false } }))
      .catch((error) => {
        pendingApp = null
        throw error
      })
    const app = await pendingApp
    cachedAuth ??= app.auth({ persistence: 'local' })
    return cachedAuth
  }

  async function getDatabase() {
    if (!await getAuth() || !pendingApp)
      return null
    if (!cachedDatabase) {
      const app = await pendingApp
      await nuxtApp.$loadCloudbaseDatabase()
      cachedDatabase ??= app.database()
    }
    return cachedDatabase
  }

  async function getSharedSession(): Promise<CloudBaseSessionResult> {
    const auth = await getAuth()
    if (!auth)
      return { session: null, error: isConfigured.value ? null : 'cloudbase_not_configured' }

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
    credentialsKey,
    isConfigured,
    getAuth,
    getDatabase,
    getSharedSession,
  }
}
