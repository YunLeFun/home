import type { DeviceKind } from '~/types'
import { computed, onMounted } from 'vue'
import { HOME_DEVICE_ORDER } from '~/constants/home'

const STORAGE_KEY = 'yun-home:plugins:removed'

function readRemoved(): DeviceKind[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(value) ? HOME_DEVICE_ORDER.filter(kind => value.includes(kind)) : []
  }
  catch {
    return []
  }
}

/**
 * Which device plugins are installed. The 云家电 bundle ships preinstalled;
 * uninstalling hides a device everywhere but keeps its state and placement,
 * so reinstalling puts it back where it was. Stored on this browser.
 */
export function usePluginLibrary() {
  const removed = useState<DeviceKind[]>('plugin-library-removed', () => [])
  const loaded = useState('plugin-library-loaded', () => false)

  onMounted(() => {
    if (loaded.value)
      return
    removed.value = readRemoved()
    loaded.value = true
  })

  function save(next: DeviceKind[]) {
    removed.value = next
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    }
    catch {
      // Storage can be unavailable in private windows; the change still applies to this visit.
    }
  }

  const installed = computed(() => HOME_DEVICE_ORDER.filter(kind => !removed.value.includes(kind)))

  return {
    installed,
    isInstalled: (kind: DeviceKind) => !removed.value.includes(kind),
    install: (kind: DeviceKind) => save(removed.value.filter(item => item !== kind)),
    uninstall: (kind: DeviceKind) => save([...new Set([...removed.value, kind])]),
    installAll: () => save([]),
  }
}
