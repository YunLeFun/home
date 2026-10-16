<script setup lang="ts">
import type { DeviceKind } from '~/types'
import { getDevicePlugin } from '~/devices/registry'
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
</script>

<template>
  <HomeDeviceDetail :device-id="deviceId" />
</template>
