import type { AnyDevicePlugin } from './types'
import { airConditionerPlugin } from './air-conditioner'
import { getDevicePlugin, registerDevicePlugin, unregisterDevicePlugin } from './registry'

export * from './registry'
export type * from './types'

/** Plugins shipped with Home. New device integrations are appended here. */
export const BUILTIN_DEVICE_PLUGINS: AnyDevicePlugin[] = [
  airConditionerPlugin,
]

/**
 * Register every built-in plugin. Safe to call more than once; built-ins own
 * their kinds, so a stale copy left by HMR module re-evaluation is replaced.
 */
export function installBuiltinDevicePlugins(): void {
  for (const plugin of BUILTIN_DEVICE_PLUGINS) {
    const existing = getDevicePlugin(plugin.manifest.kind)
    if (existing && existing !== plugin)
      unregisterDevicePlugin(plugin.manifest.kind)
    registerDevicePlugin(plugin)
  }
}
