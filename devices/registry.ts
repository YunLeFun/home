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
// Modules already loaded render directly: the Worker's SSR does not wait for
// async wrappers, so only these match between server HTML and hydration.
const loadedComponents = new Map<string, Component>()

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
  for (const cache of [asyncComponents, loadedComponents]) {
    for (const key of cache.keys()) {
      if (key.startsWith(`${kind}:`))
        cache.delete(key)
    }
  }
}

/**
 * Look up the plugin that owns a device kind.
 *
 * @param kind - The device kind
 * @returns The plugin, or `undefined` when none is registered for the kind
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
  const loaded = loadedComponents.get(key)
  if (loaded)
    return loaded
  let component = asyncComponents.get(key)
  if (!component) {
    component = markRaw(defineAsyncComponent({ loader, delay: 120 }))
    asyncComponents.set(key, component)
  }
  return component
}

/**
 * Load one plugin UI slot so later renders use the component directly. Await
 * it before rendering a slot that must match between SSR and hydration.
 *
 * @param kind - The device kind
 * @param slot - The UI slot to load
 */
export async function preloadDevicePluginComponent(kind: DeviceKind, slot: DevicePluginSlot): Promise<void> {
  const loader = plugins.get(kind)?.components[slot]
  if (!loader)
    return
  const module = await loader()
  loadedComponents.set(`${kind}:${slot}`, markRaw((module as { default?: Component }).default ?? module))
}

/**
 * Load a UI slot of every plugin, so the first render uses the components
 * directly instead of waiting on the network.
 *
 * @param slot - The UI slot to preload
 */
export async function preloadDevicePluginComponents(slot: DevicePluginSlot): Promise<void> {
  await Promise.all(listDevicePlugins().map(plugin => preloadDevicePluginComponent(plugin.manifest.kind, slot)))
}
