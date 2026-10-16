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
}>(), {
  active: false,
  tone: 'idle',
  title: '',
})

const glyph = computed(() => resolveDevicePluginComponent(props.deviceId, 'glyph'))
</script>

<template>
  <component :is="glyph" v-if="glyph" :active="active" :tone="tone" :title="title" />
</template>
