<script setup lang="ts">
import { computed } from 'vue'
import type { DevicePlacement, HomeRoom } from '~/types'

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
</script>

<template>
  <nav class="room-tabs" aria-label="选择房间">
    <button class="room-tabs__overview" :class="{ active: overview }" type="button" :aria-pressed="overview" @click="emit('selectOverview')">
      <span class="i-carbon-grid" /><span>全屋</span><small>{{ placedCount }}</small>
    </button>
    <button
      v-for="room in rooms"
      :key="room.id"
      :class="{ active: !overview && activeRoomId === room.id }"
      :aria-pressed="!overview && activeRoomId === room.id"
      type="button"
      @click="emit('selectRoom', room.id)"
    >
      <span>{{ room.shortName }}</span><small>{{ deviceCountByRoom[room.id] ?? 0 }}</small>
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
  border: 1px solid rgba(255, 255, 255, 0.82);
  border-radius: 14px;
  background: rgba(244, 247, 253, 0.86);
  box-shadow: 0 8px 24px rgba(63, 79, 120, 0.14);
  transform: translateX(-50%);
  backdrop-filter: blur(15px);
}

.room-tabs button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 60px;
  min-height: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #78849c;
  font: inherit;
  font-size: 10px;
  font-weight: 650;
  cursor: pointer;
}

.room-tabs button.active {
  background: white;
  box-shadow: 0 4px 12px rgba(72, 89, 132, 0.12);
  color: #5d72b4;
}

.room-tabs small {
  display: grid;
  place-items: center;
  min-width: 17px;
  height: 17px;
  border-radius: 999px;
  background: rgba(127, 145, 190, 0.12);
  color: #8793ad;
  font-size: 8px;
}

.room-tabs button.active small {
  background: rgba(102, 127, 205, 0.13);
  color: #6377b6;
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
