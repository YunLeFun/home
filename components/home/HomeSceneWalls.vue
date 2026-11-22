<script setup lang="ts">
import type { ApartmentWallSide, WallMode } from '~/utils/scene3d/apartment-walls'
import { APARTMENT_WALL_SIDES } from '~/utils/scene3d/apartment-walls'

defineProps<{
  roomName: string
  visible: Record<ApartmentWallSide, boolean>
}>()

const emit = defineEmits<{ toggle: [side: ApartmentWallSide] }>()
const mode = defineModel<WallMode>('mode', { required: true })

const labels: Record<ApartmentWallSide, string> = { back: '后墙', left: '左墙', right: '右墙', front: '前墙' }
const modes = [{ value: 'auto', label: '自动' }, { value: 'manual', label: '手动' }] as const
</script>

<template>
  <details class="scene-walls">
    <summary class="scene-walls__trigger">
      <span class="i-carbon-view" aria-hidden="true" />墙面
    </summary>
    <div class="scene-walls__panel" role="group" :aria-label="`${roomName}墙面`">
      <span class="scene-walls__room">{{ roomName }}</span>
      <div class="scene-walls__modes" role="group" aria-label="墙面模式">
        <button
          v-for="item in modes"
          :key="item.value"
          class="scene-walls__mode"
          type="button"
          :aria-pressed="mode === item.value"
          @click="mode = item.value"
        >
          {{ item.label }}
        </button>
      </div>
      <button
        v-for="side in APARTMENT_WALL_SIDES"
        :key="side"
        class="scene-walls__side"
        type="button"
        :aria-pressed="visible[side]"
        :disabled="mode === 'auto'"
        @click="emit('toggle', side)"
      >
        <span :class="visible[side] ? 'i-carbon-view' : 'i-carbon-view-off'" aria-hidden="true" />{{ labels[side] }}
      </button>
    </div>
  </details>
</template>

<style scoped>
.scene-walls { position: absolute; z-index: 5; top: 12px; left: 12px; }
.scene-walls__trigger, .scene-walls__panel {
  border: 1px solid var(--brand-line);
  background: var(--brand-glass-strong);
  box-shadow: var(--shadow-sm);
  color: var(--brand-ink);
}
.scene-walls__trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  list-style: none;
}
.scene-walls__trigger::-webkit-details-marker { display: none; }
.scene-walls__panel {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
  margin-top: 5px;
  padding: 7px;
  border-radius: 13px;
}
.scene-walls__room { grid-column: 1 / -1; padding-inline: 4px; font-size: 11px; color: var(--brand-muted); }
.scene-walls__modes { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, 1fr); gap: 2px; padding: 2px; border-radius: 8px; background: var(--brand-glass-sunken); }
.scene-walls__mode { min-height: 30px; border-radius: 6px; padding-inline: 9px; color: var(--brand-muted); font-size: 12px; cursor: pointer; }
.scene-walls__mode[aria-pressed='true'] { background: var(--brand-glass-strong); box-shadow: var(--shadow-sm); color: var(--brand-ink); font-weight: 700; }
.scene-walls__side {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 32px;
  padding-inline: 9px;
  border: 1px solid var(--brand-line);
  border-radius: 8px;
  color: var(--brand-muted);
  font-size: 12px;
  cursor: pointer;
}
.scene-walls__side[aria-pressed='true'] { color: white; background: var(--brand-primary); border-color: var(--brand-primary); }
.scene-walls__side:disabled { cursor: default; }
.scene-walls__side:disabled[aria-pressed='true'] { color: var(--brand-ink); background: var(--brand-glass-sunken); border-color: var(--brand-line); }
</style>
