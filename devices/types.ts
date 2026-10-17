import type { Component } from 'vue'
import type { DevicePluginIcon } from './icon'
import type { AcCapabilities, DeviceActionByKind, DeviceKind, DeviceStateByKind, HomeSurfaceKind } from '~/types'

/**
 * A lazily evaluated component. Plugins never import their UI eagerly so the
 * scene, quick controls and detail panels each land in their own chunk.
 */
export type DevicePluginComponentLoader = () => Promise<Component | { default: Component }>

/** UI slots a device plugin may contribute to the home shell. */
export type DevicePluginSlot = 'glyph' | 'quickControl' | 'panel'

/** Visual tone used by the shell to tint halos, airflow and backdrops. */
export type DeviceTone = 'idle' | 'cool' | 'heat' | 'warm' | 'active'

/**
 * An external system a device can be bound to, such as a Home Assistant
 * `climate.*` entity.
 */
export interface DeviceIntegrationManifest {
  /** Stable integration identifier, e.g. `home-assistant` */
  id: string
  /** Display name shown in the integration badge */
  name: string
  /** Entity domain the integration binds to, e.g. `climate` */
  domain: string
  /** UnoCSS icon class */
  icon: string
  /** Short description of what the integration controls */
  description: string
}

/** Market category of a device plugin. */
export type DevicePluginCategory = 'climate' | 'cleaning' | 'media' | 'comfort' | 'sensor' | 'fun'

/** Static, serializable description of a device plugin. */
export interface DevicePluginManifest<K extends DeviceKind = DeviceKind> {
  /** Reverse-domain plugin id, shared with the native app's catalog */
  id: string
  kind: K
  /** Semver of the plugin contract implementation */
  version: string
  name: string
  description: string
  author: { name: string, url?: string }
  category: DevicePluginCategory
  /** Source repository of the plugin */
  homepage?: string
  /** App icon the plugin designs itself; see `devices/icon.ts` */
  appIcon: DevicePluginIcon
  /** UnoCSS icon class used where a glyph is too large */
  icon: string
  /** Detail route; defaults to `/items/<kind>` */
  route: string
  /** Footprint in SVG world units, used by placement collision checks */
  size: { width: number, height: number }
  /** Surface kinds the device may be placed on */
  surfaces: HomeSurfaceKind[]
  /** Accent colors that tint the shell when the device is focused */
  accent: { cool: string, heat: string }
  integrations: DeviceIntegrationManifest[]
}

/** Framework-independent state machine of a device plugin. */
export interface DevicePluginState<K extends DeviceKind> {
  create: (changedAt: string) => DeviceStateByKind<K>
  normalize: (value: unknown) => DeviceStateByKind<K>
  reduce: (state: DeviceStateByKind<K>, action: DeviceActionByKind<K>, changedAt: string, capabilities?: AcCapabilities) => DeviceStateByKind<K>
  isAction: (value: unknown) => value is DeviceActionByKind<K>
  /** Whether the device is doing work and should animate in the scene */
  isActive: (state: DeviceStateByKind<K>) => boolean
  /** Visual tone derived from state */
  tone: (state: DeviceStateByKind<K>) => DeviceTone
}

/**
 * A self-contained device integration: manifest, state machine and lazily
 * loaded UI slots.
 */
export interface DevicePlugin<K extends DeviceKind = DeviceKind> {
  manifest: DevicePluginManifest<K>
  state: DevicePluginState<K>
  components: Partial<Record<DevicePluginSlot, DevicePluginComponentLoader>>
}

/** Union of every concrete plugin type, used where kinds are mixed. */
export type AnyDevicePlugin = { [K in DeviceKind]: DevicePlugin<K> }[DeviceKind]
