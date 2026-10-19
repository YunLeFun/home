<script setup lang="ts">
import type { DeviceKind } from '~/types'
import { getDevicePlugin, preloadDevicePluginComponent } from '~/devices/registry'
import { isDeviceKind } from '~/utils/device'

// Every device detail page is served by its plugin; unknown or uninstalled kinds 404.
definePageMeta({
  layout: 'home',
  validate: (route) => {
    const kind = route.params.device
    return typeof kind === 'string' && isDeviceKind(kind) && Boolean(getDevicePlugin(kind))
  },
})

const route = useRoute()
const deviceId = computed(() => route.params.device as DeviceKind)

useShareMeta(() => {
  // validate() has already rejected unknown kinds, so the plugin exists.
  const { name, description } = getDevicePlugin(deviceId.value)!.manifest
  return { title: name, description: `${description}。${name}已入住云之彼端，联网即开，不费一度电。` }
})

// Load the control before rendering so the server HTML already contains it.
await Promise.all([
  preloadDevicePluginComponent(deviceId.value, 'panel'),
  preloadDevicePluginComponent(deviceId.value, 'quickControl'),
])
</script>

<template>
  <HomeDeviceDetail :device-id="deviceId" />
</template>
