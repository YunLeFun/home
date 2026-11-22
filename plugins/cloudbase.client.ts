import type sdk from '@cloudbase/js-sdk'

type CloudBaseSdk = typeof sdk
type CloudModule = 'cloudbase' | 'cloudbase.auth' | 'cloudbase.database'

const scripts = new Map<CloudModule, Promise<void>>()

function loadScript(name: CloudModule) {
  const existing = scripts.get(name)
  if (existing)
    return existing
  const pending = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://static.cloudbase.net/cloudbase-js-sdk/${import.meta.env.CLOUDBASE_SDK_VERSION}/${name}.js`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      script.remove()
      reject(new Error('云服务加载失败，请重试'))
    }
    document.head.append(script)
  }).catch((error) => {
    scripts.delete(name)
    throw error
  })
  scripts.set(name, pending)
  return pending
}

export default defineNuxtPlugin({
  name: 'cloudbase',
  setup() {
    return {
      provide: {
        async loadCloudbaseAuth(): Promise<CloudBaseSdk> {
          if (import.meta.dev)
            return (await import('@cloudbase/js-sdk')).default
          await loadScript('cloudbase')
          await loadScript('cloudbase.auth')
          return (window as Window & { cloudbase: CloudBaseSdk }).cloudbase
        },
        async loadCloudbaseDatabase() {
          if (!import.meta.dev)
            await loadScript('cloudbase.database')
        },
      },
    }
  },
})
