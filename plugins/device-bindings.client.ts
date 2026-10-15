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
    const auth = await cloudbase.getAuth()
    const active = await cloudbase.getSharedSession()
    runtime.setOwner(active.session?.user?.id ?? null)
    const subscription = auth?.onAuthStateChange((_event: unknown, nextSession: unknown) => {
      const next = toCloudBaseSharedSession(nextSession)
      runtime.setOwner(next?.user?.is_anonymous ? null : next?.user?.id ?? null)
    }).data.subscription
    const refresh = () => runtime.refreshAll()
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    const dispose = () => {
      unwatch()
      subscription?.unsubscribe()
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      runtime.dispose()
    }
    if (import.meta.hot)
      import.meta.hot.dispose(dispose)
    return { provide: { deviceBindings: runtime } }
  },
})
