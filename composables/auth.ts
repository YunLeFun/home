import { computed, shallowRef } from 'vue'
import { startSsoRedirect } from '@yunlefun/sso'
import { useCloudBaseClient } from './cloudbase'
import type { CloudBaseSharedSession, YunleSession } from '~/types'
import { createYunleSessionFromCloudBase } from '~/utils/cloudbase-session'

export function useYunleSession() {
  const session = useState<YunleSession | null>('yunle-session', () => null)
  const pending = shallowRef(false)
  const error = shallowRef<string | null>(null)
  const isAuthenticated = computed(() => session.value?.authenticated === true)
  const cloudbase = useCloudBaseClient()

  async function fetchServerSession() {
    const redirect = typeof window === 'undefined' ? undefined : window.location.href

    return await $fetch<YunleSession>('/api/auth/session', {
      credentials: 'include',
      query: redirect ? { redirect } : undefined,
    })
  }

  function createSession(serverSession: YunleSession, cloudbaseSession: CloudBaseSharedSession) {
    return createYunleSessionFromCloudBase({
      session: cloudbaseSession,
      cloudbase: serverSession.cloudbase,
      logoutUrl: serverSession.logoutUrl,
      authOrigin: serverSession.authOrigin,
    })
  }

  async function refresh() {
    pending.value = true
    error.value = null

    try {
      const serverSession = await fetchServerSession()
      const localSession = await cloudbase.getSharedSession()
      if (localSession.session) {
        session.value = createSession(serverSession, localSession.session)
        return
      }

      session.value = serverSession
    }
    catch (err) {
      const hasMessage = err && typeof err === 'object' && 'message' in err
      error.value = hasMessage ? String((err as { message?: unknown }).message) : 'Unable to load YunLe session'
    }
    finally {
      pending.value = false
    }
  }

  async function login() {
    const config = useRuntimeConfig()
    pending.value = true
    error.value = null
    try {
      await startSsoRedirect({
        clientId: String(config.public.ssoClientId),
        scope: ['identity:bootstrap'],
        redirectUri: String(config.public.ssoRedirectUri),
        ssoOrigin: String(config.public.ssoOrigin),
      })
    }
    catch (cause) {
      pending.value = false
      error.value = cause instanceof Error ? cause.message : 'Unable to start YunLe SSO'
      throw cause
    }
  }

  return {
    session,
    pending,
    error,
    isAuthenticated,
    login,
    refresh,
  }
}
