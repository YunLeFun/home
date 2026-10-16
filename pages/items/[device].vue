<script setup lang="ts">
import type { DeviceKind } from '~/types'
import { getDevicePlugin } from '~/devices/registry'
import { isDeviceKind } from '~/utils/device'

// Static pages under /items still serve legacy built-ins; this route serves plugin devices.
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
