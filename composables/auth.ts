import { computed, shallowRef } from 'vue'
import { useCloudBaseClient } from './cloudbase'
import { useCloudBaseSessionBridge } from './cloudbase-bridge'
import type { CloudBaseSharedSession, YunleSession, YunleSessionReason } from '~/types'
import { createYunleSessionFromCloudBase } from '~/utils/cloudbase-session'

function withReason(session: YunleSession, reason: YunleSessionReason): YunleSession {
  return {
    ...session,
    authenticated: false,
    user: null,
    reason,
  }
}

export function useYunleSession() {
  const session = useState<YunleSession | null>('yunle-session', () => null)
  const pending = shallowRef(false)
  const error = shallowRef<string | null>(null)
  const isAuthenticated = computed(() => session.value?.authenticated === true)
  const cloudbase = useCloudBaseClient()
  const bridge = useCloudBaseSessionBridge()

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
      loginUrl: serverSession.loginUrl,
      logoutUrl: serverSession.logoutUrl,
      authOrigin: serverSession.authOrigin,
      appsOrigin: serverSession.appsOrigin,
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

      const bridgeSession = await bridge.requestSession()
      if (bridgeSession.session) {
        session.value = createSession(serverSession, bridgeSession.session)
        return
      }

      if (bridgeSession.error === 'cloudbase_bridge_unavailable' || bridgeSession.error === 'cloudbase_bridge_denied') {
        session.value = withReason(serverSession, bridgeSession.error)
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

  return {
    session,
    pending,
    error,
    isAuthenticated,
    refresh,
  }
}
