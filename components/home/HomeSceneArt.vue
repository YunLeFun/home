<script setup lang="ts">
import type { HomeTemplateId } from '~/types'
import HomeSceneCloudApartment from './HomeSceneCloudApartment.vue'
import HomeSceneComfortSuite from './HomeSceneComfortSuite.vue'
import HomeSceneStudio from './HomeSceneStudio.vue'
import SceneDefs from './scene/SceneDefs.vue'

defineProps<{ templateId: HomeTemplateId }>()

// Lighting follows local time of day; dark mode always shows night.
const { phase } = useSceneTime()
</script>

<template>
  <g class="scene-art" data-layer="editable-scene-art" :data-phase="phase">
    <SceneDefs />
    <HomeSceneCloudApartment v-if="templateId === 'cloud-apartment'" />
    <HomeSceneStudio v-else-if="templateId === 'studio'" />
    <HomeSceneComfortSuite v-else />
  </g>
</template>

<style scoped>
.scene-art :deep(.scene-room-label) {
  fill: var(--sc-ink);
  font-family: inherit;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.32em;
  opacity: 0.62;
}

.scene-art[data-phase="night"] :deep(.scene-room-label) {
  fill: #e8e2d4;
}
</style>
