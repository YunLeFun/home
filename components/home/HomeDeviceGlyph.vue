<script setup lang="ts">
import type { DeviceTone } from '~/devices/types'
import type { DeviceKind } from '~/types'
import { computed } from 'vue'
import { resolveDevicePluginComponent } from '~/devices/registry'

const props = withDefaults(defineProps<{
  deviceId: DeviceKind
  active?: boolean
  tone?: DeviceTone
  title?: string
  /** Motion speed multiplier from the plugin's state, e.g. fan blade speed */
  speed?: number
  /** The device's state, for plugin-specific details such as oscillation */
  state?: unknown
}>(), {
  active: false,
  tone: 'idle',
  title: '',
  speed: 1,
  state: undefined,
})

const glyph = computed(() => resolveDevicePluginComponent(props.deviceId, 'glyph'))
</script>

<template>
  <component :is="glyph" v-if="glyph" :active="active" :tone="tone" :title="title" :speed="speed" :state="state" />
</template>
