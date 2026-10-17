<script setup lang="ts">
import { computed } from 'vue'
import type { ScenePhase } from '~/composables/scene-time'
import type { HomeTemplate } from '~/types'

const props = defineProps<{
  template: HomeTemplate
  phase: ScenePhase
  /** Room to centre on where the frame is narrower than the poster. */
  activeRoomId: string | null
  /** Shown because 3D cannot run here, not just while it starts. */
  fallback?: boolean
}>()

// Posters are exported from the 3D diorama by `pnpm scene:posters`.
const variant = computed(() => props.phase === 'night' ? 'night' : 'day')
const source = (width: number) => `/scene/${props.template.id}-${variant.value}-${width}.webp`
const focus = computed(() => {
  const room = props.template.rooms.find(item => item.id === props.activeRoomId)
  return room ? (room.x + room.width / 2) / props.template.width : 0.5
})
</script>

<template>
  <figure class="home-poster home-sky" :data-phase="phase" :data-fallback="fallback">
    <img
      :src="source(1600)"
      :srcset="`${source(800)} 800w, ${source(1600)} 1600w`"
      sizes="(max-width: 720px) 200vw, min(100vw, 1600px)"
      :style="{ objectPosition: `${(focus * 100).toFixed(1)}% 50%` }"
      :alt="`${template.name}立体家园预览`"
      fetchpriority="high"
      decoding="async"
    >
    <figcaption v-if="fallback">
      <span class="i-carbon-image" />
      当前浏览器无法显示 3D，这是家园预览；用下方设备卡片控制和摆放设备
    </figcaption>
  </figure>
</template>

<style scoped>
.home-poster {
  position: relative;
  overflow: hidden;
  width: min(100%, calc((100dvh - 222px) * 2));
  margin: 0 auto;
  aspect-ratio: 2 / 1;
  border: 1px solid var(--brand-line);
  border-radius: var(--ylf-radius-xl);
  box-shadow: var(--shadow-lg), inset 0 1px var(--brand-highlight);
}

.home-poster img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
}

.home-poster figcaption {
  position: absolute;
  bottom: 12px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 7px;
  max-width: calc(100% - 24px);
  padding: 7px 12px;
  border: 1px solid var(--brand-line);
  border-radius: 999px;
  background: var(--brand-glass-strong);
  box-shadow: var(--shadow-sm);
  color: var(--brand-ink);
  font-size: 11px;
  font-weight: 650;
  translate: -50% 0;
  backdrop-filter: blur(12px);
}

.home-poster figcaption > span { flex: none; font-size: 13px; }

@media (max-width: 720px) {
  .home-poster { width: 100%; aspect-ratio: 1 / 1; border-radius: 24px; }
  .home-poster figcaption { border-radius: 14px; }
}

@media (min-width: 721px) and (max-height: 850px) {
  .home-poster { width: min(100%, calc((100dvh - 222px) * 2)); }
}
</style>
