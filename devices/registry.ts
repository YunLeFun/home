import type { Component } from 'vue'
import type { AnyDevicePlugin, DevicePlugin, DevicePluginSlot } from './types'
import type { DeviceKind } from '~/types'
import { defineAsyncComponent, markRaw } from 'vue'

/**
 * Identity helper that gives plugin authors full type inference.
 *
 * @param plugin - The plugin definition
 * @returns The same plugin, typed by its device kind
 *
 * @example
 * ```ts
 * export const fanPlugin = defineDevicePlugin({
 *   manifest: { kind: 'fan', ... },
 *   state: { ... },
 *   components: { quickControl: () => import('./FanQuickControl.vue') },
 * })
 * ```
 */
export function defineDevicePlugin<K extends DeviceKind>(plugin: DevicePlugin<K>): DevicePlugin<K> {
  return plugin
}

const plugins = new Map<DeviceKind, AnyDevicePlugin>()
const asyncComponents = new Map<string, Component>()

/**
 * Register a device plugin. Registering the same plugin object twice is a
 * no-op so HMR and SSR re-entry stay safe.
 *
 * @param plugin - The plugin to register
 * @throws {Error} If a different plugin already owns the device kind
 */
export function registerDevicePlugin(plugin: AnyDevicePlugin): void {
  const existing = plugins.get(plugin.manifest.kind)
  if (existing && existing !== plugin)
    throw new Error(`Device plugin "${plugin.manifest.kind}" is already registered`)
  plugins.set(plugin.manifest.kind, plugin)
}

/**
 * Remove a device plugin and its cached components.
 *
 * @param kind - The device kind to unregister
 */
export function unregisterDevicePlugin(kind: DeviceKind): void {
  plugins.delete(kind)
  for (const key of asyncComponents.keys()) {
    if (key.startsWith(`${kind}:`))
      asyncComponents.delete(key)
  }
}

/**
 * Look up the plugin that owns a device kind.
 *
 * @param kind - The device kind
 * @returns The plugin, or `undefined` when the kind is still a legacy built-in
 */
export function getDevicePlugin<K extends DeviceKind>(kind: K): DevicePlugin<K> | undefined {
  return plugins.get(kind) as unknown as DevicePlugin<K> | undefined
}

/** @returns Every registered plugin in registration order */
export function listDevicePlugins(): AnyDevicePlugin[] {
  return [...plugins.values()]
}

/**
 * Resolve a plugin UI slot as a cached async component.
 *
 * @param kind - The device kind
 * @param slot - The UI slot to resolve
 * @returns An async component, or `null` when the plugin does not provide the slot
 */
export function resolveDevicePluginComponent(kind: DeviceKind, slot: DevicePluginSlot): Component | null {
  const loader = plugins.get(kind)?.components[slot]
  if (!loader)
    return null
  const key = `${kind}:${slot}`
  let component = asyncComponents.get(key)
  if (!component) {
    component = markRaw(defineAsyncComponent({ loader, delay: 120 }))
    asyncComponents.set(key, component)
  }
  return component
}

/**
 * Warm the module cache for a UI slot of every plugin, so the first render
 * resolves within a microtask instead of waiting on the network.
 *
 * @param slot - The UI slot to preload
 */
export async function preloadDevicePluginComponents(slot: DevicePluginSlot): Promise<void> {
  await Promise.all(listDevicePlugins().map(plugin => plugin.components[slot]?.()))
}
