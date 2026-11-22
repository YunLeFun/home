import { watch } from 'vue'
import { createDeviceBindingRuntime } from '~/utils/device-bindings'
import { toCloudBaseSharedSession } from '~/utils/cloudbase-session'

export default defineNuxtPlugin<{ deviceBindings: ReturnType<typeof createDeviceBindingRuntime> }>({
  name: 'device-bindings',
  dependsOn: ['sso'],
  async setup() {
    const config = useRuntimeConfig()
    const cloudSync = useCloudSync()
    const { session } = useYunleSession()
    const runtime = createDeviceBindingRuntime({
      storage: localStorage,
      securePage: location.protocol === 'https:',
      bindingsCollection: String(config.public.cloudbaseDeviceBindingsCollection),
      statesCollection: String(config.public.cloudbaseDeviceStatesCollection),
      syncStates: config.public.deviceSyncEnabled === true,
      read: cloudSync.readRecord,
      write: cloudSync.writeRecord,
    })
    const cloudbase = useCloudBaseClient()
    const unwatch = watch(() => session.value?.user?.id ?? null, owner => runtime.setOwner(owner), { immediate: true })
    let unsubscribe: (() => void) | undefined
    let restoring: Promise<void> | null = null
    async function restoreSession() {
      const auth = await cloudbase.getAuth()
      if (!auth)
        return
      if (!unsubscribe) {
        const { data } = auth.onAuthStateChange((_event: unknown, nextSession: unknown) => {
          const next = toCloudBaseSharedSession(nextSession)
          runtime.setOwner(next?.user?.is_anonymous ? null : next?.user?.id ?? null)
        })
        unsubscribe = () => data.subscription.unsubscribe()
      }
      const active = await cloudbase.getSharedSession()
      runtime.setOwner(active.session?.user?.id ?? null)
    }
    function restore() {
      restoring ??= restoreSession().catch(() => {
        // Retry on focus or reconnection. A CDN outage must not disable local controls.
      }).finally(() => { restoring = null })
      return restoring
    }
    await restore()
    const refresh = async () => {
      await restore()
      runtime.refreshAll()
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === cloudbase.credentialsKey.value || event.key === null)
        void refresh()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    const dispose = () => {
      unwatch()
      unsubscribe?.()
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      runtime.dispose()
    }
    if (import.meta.hot)
      import.meta.hot.dispose(dispose)
    return { provide: { deviceBindings: runtime } }
  },
})
