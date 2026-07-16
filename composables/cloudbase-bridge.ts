import { useCloudBaseClient } from './cloudbase'
import type { CloudBaseSharedSession } from '~/types'
import { isYunleSsoResultMessage, toCloudBaseSharedSession } from '~/utils/cloudbase-session'

interface RequestBridgeSessionOptions {
  timeoutMs?: number
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    return crypto.randomUUID()

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function useCloudBaseSessionBridge() {
  const cloudbase = useCloudBaseClient()

  async function requestSession(options: RequestBridgeSessionOptions = {}) {
    if (typeof window === 'undefined' || !cloudbase.isConfigured.value)
      return { session: null, error: 'cloudbase_not_configured' }

    const activeConfig = cloudbase.config.value
    const bridgeUrl = new URL(activeConfig.sessionBridgePath, activeConfig.sessionBridgeOrigin)
    const bridgeOrigin = bridgeUrl.origin
    const timeoutMs = options.timeoutMs ?? 5000
    const nonce = createRequestId()
    const targetOrigin = window.location.origin
    bridgeUrl.searchParams.set('mode', 'silent')
    bridgeUrl.searchParams.set('targetOrigin', targetOrigin)
    bridgeUrl.searchParams.set('nonce', nonce)

    return await new Promise<{ session: CloudBaseSharedSession | null; error: string | null }>((resolve) => {
      const iframe = document.createElement('iframe')
      let settled = false

      function cleanup() {
        window.removeEventListener('message', handleMessage)
        iframe.remove()
      }

      function complete(result: { session: CloudBaseSharedSession | null; error: string | null }) {
        if (settled)
          return

        settled = true
        cleanup()
        resolve(result)
      }

      async function handleMessage(event: MessageEvent<unknown>) {
        if (event.origin !== bridgeOrigin)
          return

        if (!isYunleSsoResultMessage(event.data) || event.data.nonce !== nonce)
          return

        if (!event.data.ok) {
          complete({
            session: null,
            error: event.data.reason === 'invalid_request' ? 'cloudbase_bridge_denied' : 'missing_cloudbase_session',
          })
          return
        }

        const sharedSession = toCloudBaseSharedSession(event.data.session)
        if (!sharedSession) {
          complete({ session: null, error: 'missing_cloudbase_session' })
          return
        }

        const result = await cloudbase.setSharedSession(sharedSession)
        complete({
          session: result.session,
          error: result.error,
        })
      }

      window.addEventListener('message', handleMessage)
      iframe.hidden = true
      iframe.src = bridgeUrl.toString()
      document.body.appendChild(iframe)

      window.setTimeout(() => {
        complete({ session: null, error: 'cloudbase_bridge_unavailable' })
      }, timeoutMs)
    })
  }

  return {
    requestSession,
  }
}
