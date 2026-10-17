<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { appName } from '~/constants'
import { HOME_TEMPLATES } from '~/constants/home'
import type { HomeSyncStatus, HomeTemplateId } from '~/types'

const props = defineProps<{
  templateId: HomeTemplateId
  syncStatus: HomeSyncStatus
  syncEnabled: boolean
  editMode: boolean
  canUndo: boolean
  canRedo: boolean
}>()

const emit = defineEmits<{
  changeTemplate: [templateId: HomeTemplateId]
  toggleEdit: []
  undo: []
  redo: []
}>()

const { session, pending, login, refresh } = useYunleSession()
const templateOptions = Object.values(HOME_TEMPLATES)
const syncLabel = computed(() => {
  if (!props.syncEnabled)
    return '本地家园'
  if (props.syncStatus === 'syncing')
    return '同步中'
  if (props.syncStatus === 'synced')
    return '云端已同步'
  if (props.syncStatus === 'unauthorized')
    return '游客模式'
  if (props.syncStatus === 'error')
    return '等待重连'
  return '本地已保存'
})

const userInitial = computed(() => {
  const name = session.value?.user?.name || '游客'
  return name.slice(0, 1).toUpperCase()
})

onMounted(refresh)
</script>

<template>
  <header class="home-topbar">
    <NuxtLink class="home-brand" to="/" :aria-label="`${appName}首页`">
      <img class="home-brand__mark" src="/brand-mark.svg" alt="">
      <span><strong>{{ appName }}</strong><small>可编辑智能家园</small></span>
    </NuxtLink>

    <label class="home-template-select">
      <span class="i-carbon-home-services" />
      <span class="sr-only">选择家园模板</span>
      <select :value="templateId" @change="emit('changeTemplate', ($event.target as HTMLSelectElement).value as HomeTemplateId)">
        <option v-for="template in templateOptions" :key="template.id" :value="template.id">
          {{ template.name }}
        </option>
      </select>
      <span class="i-carbon-chevron-down" />
    </label>

    <div class="home-topbar__actions">
      <span class="home-sync" :data-status="syncStatus" role="status" aria-live="polite" aria-atomic="true">
        <span class="home-sync__dot" />{{ syncLabel }}
      </span>
      <div v-if="editMode" class="home-history">
        <button type="button" title="撤销" aria-label="撤销" :disabled="!canUndo" @click="emit('undo')">
          <span class="i-carbon-undo" />
        </button>
        <button type="button" title="重做" aria-label="重做" :disabled="!canRedo" @click="emit('redo')">
          <span class="i-carbon-redo" />
        </button>
      </div>
      <button class="home-edit-button" :class="{ 'is-active': editMode }" type="button" :aria-pressed="editMode" @click="emit('toggleEdit')">
        <span v-if="editMode" class="i-carbon-checkmark" />
        <span v-else class="i-carbon-edit" />
        {{ editMode ? '完成摆放' : '编辑家园' }}
      </button>
      <button
        v-if="!session?.authenticated"
        class="home-avatar"
        :class="{ 'is-pending': pending }"
        type="button"
        :disabled="pending"
        title="登录 YunLe"
        aria-label="登录 YunLe"
        @click="login"
      >{{ userInitial }}</button>
      <span v-else class="home-avatar" :title="session.user?.name || 'YunLe 用户'">{{ userInitial }}</span>
    </div>
  </header>
</template>

<style scoped>
.home-topbar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 18px; min-height: 76px; padding: 12px 24px; }
.home-brand { display: inline-flex; align-items: center; justify-self: start; gap: 11px; color: var(--brand-ink); text-decoration: none; }
.home-brand__mark { display: block; width: 42px; height: 42px; filter: drop-shadow(0 7px 9px rgba(30, 64, 115, 0.18)); transition: transform var(--dur-3) var(--ease-spring); }
.home-brand:hover .home-brand__mark { transform: translateY(-2px) rotate(-6deg); }
.home-brand > span:last-child { display: grid; gap: 1px; }
.home-brand strong { font-size: 17px; letter-spacing: -0.02em; }
.home-brand small { color: var(--brand-muted); font-size: 10px; }
.home-template-select { position: relative; display: flex; align-items: center; gap: 8px; min-width: 178px; padding: 9px 12px; border: 1px solid var(--brand-outline); border-radius: 14px; background: var(--brand-glass); box-shadow: var(--shadow-sm), inset 0 1px 0 var(--brand-highlight); color: var(--brand-muted); backdrop-filter: blur(14px); transition: box-shadow var(--dur-2) ease, transform var(--dur-3) var(--ease-spring); }
.home-template-select:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
.home-template-select select { width: 100%; border: 0; outline: 0; appearance: none; background: transparent; color: var(--brand-ink); font: inherit; font-size: 13px; font-weight: 650; cursor: pointer; }
.home-template-select > span:last-child { font-size: 12px; pointer-events: none; }
.home-topbar__actions { display: flex; align-items: center; justify-self: end; gap: 10px; }
.home-sync { display: inline-flex; align-items: center; gap: 7px; color: var(--brand-muted); font-size: 12px; font-weight: 600; white-space: nowrap; }
.home-sync__dot { width: 7px; height: 7px; border-radius: 50%; background: #9ca49f; box-shadow: 0 0 0 4px rgba(105, 113, 109, 0.12); }
.home-sync[data-status="synced"] .home-sync__dot { background: var(--tone-active); box-shadow: 0 0 0 4px var(--tone-active-soft); }
.home-sync[data-status="syncing"] .home-sync__dot { background: var(--brand-warm); animation: sync-pulse 1s ease-in-out infinite; }
.home-sync[data-status="error"] .home-sync__dot { background: var(--tone-danger); }
.home-history { display: flex; overflow: hidden; border: 1px solid var(--brand-outline); border-radius: 11px; background: var(--brand-glass); animation: rise-in var(--dur-2) var(--ease-out); }
.home-history button { display: grid; place-items: center; width: 34px; height: 34px; border: 0; background: transparent; color: var(--brand-muted); cursor: pointer; }
.home-history button + button { border-left: 1px solid var(--brand-outline); }
.home-history button:disabled { cursor: default; opacity: 0.32; }
.home-edit-button { display: inline-flex; align-items: center; gap: 7px; min-height: 38px; padding: 0 14px; border: 1px solid var(--brand-outline); border-radius: 12px; background: var(--brand-glass); color: var(--brand-ink); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; transition: transform var(--dur-3) var(--ease-spring), background var(--dur-2) ease, color var(--dur-2) ease, box-shadow var(--dur-2) ease; }
.home-edit-button:hover { transform: translateY(-1px); }
.home-edit-button:active { transform: scale(0.96); }
.home-edit-button.is-active { border-color: var(--brand-primary); background: var(--brand-primary); color: var(--ylf-c-text-on-accent); box-shadow: 0 8px 20px rgba(var(--brand-focus-rgb), 0.28); }
.home-avatar { display: grid; place-items: center; width: 38px; height: 38px; border: 2px solid var(--brand-surface); border-radius: 50%; background: linear-gradient(145deg, var(--ylf-c-brand-hover), var(--brand-primary)); box-shadow: var(--ylf-glow-brand); color: var(--ylf-c-text-on-accent); font-size: 12px; font-weight: 800; text-decoration: none; cursor: pointer; transition: transform var(--dur-3) var(--ease-spring); }
.home-avatar:hover { transform: scale(1.06); }
.home-avatar.is-pending { opacity: 0.65; }
@keyframes sync-pulse { 50% { opacity: 0.35; transform: scale(0.78); } }
@media (max-width: 840px) {
  .home-topbar { grid-template-columns: 1fr auto; min-height: 68px; padding: 10px 14px; }
  .home-template-select { grid-row: 2; grid-column: 1 / -1; width: 100%; }
  .home-brand small, .home-sync, .home-avatar { display: none; }
  .home-edit-button { padding: 0 11px; }
}
@media (max-width: 420px) { .home-edit-button { width: 38px; padding: 0; justify-content: center; font-size: 0; } .home-edit-button span { font-size: 16px; } .home-brand__mark { width: 38px; height: 38px; } }
</style>
