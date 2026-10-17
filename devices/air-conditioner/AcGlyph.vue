<script setup lang="ts">
import type { DeviceGlyphProps } from '../types'
import { AcGlyph } from '@yunlefun-home/air-conditioner/controls'
import { computed } from 'vue'

const props = withDefaults(defineProps<DeviceGlyphProps>(), {
  active: false,
  tone: 'idle',
  title: '',
})

// The shell's tone vocabulary is wider than the air conditioner's.
const acTone = computed(() => props.tone === 'cool' || props.tone === 'heat' ? props.tone : 'idle')
</script>

<template>
  <AcGlyph class="device-glyph" :active="active" :tone="acTone" :title="title" data-vector-device="air-conditioner" />
</template>
