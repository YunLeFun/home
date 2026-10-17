<script setup lang="ts">
import type { DevicePlacement, HomeRoom } from '~/types'
import { computed, nextTick, onMounted, shallowRef, watch } from 'vue'

const props = defineProps<{
  rooms: HomeRoom[]
  placements: DevicePlacement[]
  activeRoomId: string | null
  overview: boolean
}>()

const emit = defineEmits<{
  selectOverview: []
  selectRoom: [roomId: string]
}>()

const deviceCountByRoom = computed(() => props.placements.reduce<Record<string, number>>((counts, placement) => {
  if (placement.roomId)
    counts[placement.roomId] = (counts[placement.roomId] ?? 0) + 1
  return counts
}, {}))
const placedCount = computed(() => props.placements.filter(placement => placement.roomId).length)
const activeKey = computed(() => props.overview ? 'overview' : props.activeRoomId)

const navRef = shallowRef<HTMLElement | null>(null)
const indicator = shallowRef<{ left: number, width: number } | null>(null)

// Measure the pressed tab so the pill can spring to it.
function measure() {
  const target = navRef.value?.querySelector<HTMLElement>('button[aria-pressed="true"]')
  if (!target || target.offsetWidth === 0) {
    indicator.value = null
    return
  }
  indicator.value = { left: target.offsetLeft, width: target.offsetWidth }
}

watch([activeKey, () => props.rooms], () => nextTick(measure))
onMounted(measure)
useResizeObserver(navRef, measure)
</script>

<template>
  <nav ref="navRef" class="room-tabs" aria-label="选择房间">
    <span
      v-if="indicator"
      class="room-tabs__indicator"
      :style="{ transform: `translateX(${indicator.left}px)`, width: `${indicator.width}px` }"
      aria-hidden="true"
    />
    <button class="room-tabs__overview" type="button" :aria-pressed="overview" @click="emit('selectOverview')">
      <span class="i-carbon-grid" /><span>全屋</span><small class="numeric">{{ placedCount }}</small>
    </button>
    <button
      v-for="room in rooms"
      :key="room.id"
      :aria-pressed="!overview && activeRoomId === room.id"
      type="button"
      @click="emit('selectRoom', room.id)"
    >
      <span>{{ room.shortName }}</span><small class="numeric">{{ deviceCountByRoom[room.id] ?? 0 }}</small>
    </button>
  </nav>
</template>

<style scoped>
.room-tabs {
  position: absolute;
  z-index: 9;
  top: 16px;
  left: 50%;
  display: flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--brand-line);
  border-radius: 16px;
  background: var(--brand-glass);
  box-shadow: var(--shadow-md), inset 0 1px 0 var(--brand-highlight);
  transform: translateX(-50%);
  backdrop-filter: blur(16px) saturate(1.2);
  isolation: isolate;
}

.room-tabs__indicator {
  position: absolute;
  z-index: -1;
  top: 4px;
  bottom: 4px;
  left: 0;
  border-radius: 12px;
  background: var(--brand-primary);
  box-shadow: 0 6px 16px rgba(var(--brand-focus-rgb), 0.25);
  transition: transform var(--dur-3) var(--ease-spring), width var(--dur-3) var(--ease-spring);
}

.room-tabs button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 60px;
  min-height: 32px;
  padding: 0 11px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--brand-muted);
  font-size: 11px;
  font-weight: 650;
  cursor: pointer;
  transition: color var(--dur-2) ease;
}

.room-tabs button:hover { color: var(--brand-ink); }
.room-tabs button[aria-pressed="true"] { color: var(--ylf-c-text-on-accent); }

.room-tabs small {
  display: grid;
  place-items: center;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--brand-glass-sunken);
  color: var(--brand-muted);
  font-size: 9px;
  transition: background var(--dur-2) ease, color var(--dur-2) ease;
}

.room-tabs button[aria-pressed="true"] small {
  background: color-mix(in oklab, var(--ylf-c-text-on-accent) 18%, transparent);
  color: var(--ylf-c-text-on-accent);
}

@media (max-width: 720px) {
  .room-tabs {
    position: relative;
    top: auto;
    left: auto;
    z-index: 3;
    width: fit-content;
    margin: 4px auto 10px;
    transform: none;
  }

  .room-tabs__overview { display: none !important; }
  .room-tabs button { min-width: 68px; min-height: 34px; }
}
</style>
