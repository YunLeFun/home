<script setup lang="ts">
import { computed, onMounted } from 'vue'
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
  if (props.syncStatus === 'conflict')
    return '已合并更新'
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
    <NuxtLink class="home-brand" to="/" aria-label="Yun Home 首页">
      <span class="home-brand__mark"><span class="i-carbon-home" /></span>
      <span><strong>Yun Home</strong><small>云之彼端的家园</small></span>
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
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
.home-topbar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 18px; min-height: 76px; padding: 12px 24px; }
.home-brand { display: inline-flex; align-items: center; justify-self: start; gap: 11px; color: #27334d; text-decoration: none; }
.home-brand__mark { display: grid; place-items: center; width: 42px; height: 42px; border: 1px solid rgba(151, 170, 217, 0.48); border-radius: 14px; background: linear-gradient(145deg, #ffffff, #e9efff); box-shadow: 0 7px 18px rgba(83, 105, 163, 0.16); color: #6f83d7; font-size: 20px; }
.home-brand > span:last-child { display: grid; gap: 1px; }
.home-brand strong { font-size: 17px; letter-spacing: -0.02em; }
.home-brand small { color: #8590a7; font-size: 10px; }
.home-template-select { position: relative; display: flex; align-items: center; gap: 8px; min-width: 178px; padding: 9px 12px; border: 1px solid rgba(164, 180, 218, 0.6); border-radius: 13px; background: rgba(255, 255, 255, 0.78); box-shadow: 0 7px 22px rgba(74, 91, 135, 0.09); color: #60709c; }
.home-template-select select { width: 100%; border: 0; outline: 0; appearance: none; background: transparent; color: #34415f; font: inherit; font-size: 13px; font-weight: 650; cursor: pointer; }
.home-template-select > span:last-child { font-size: 12px; pointer-events: none; }
.home-topbar__actions { display: flex; align-items: center; justify-self: end; gap: 10px; }
.home-sync { display: inline-flex; align-items: center; gap: 7px; color: #74809a; font-size: 12px; font-weight: 600; white-space: nowrap; }
.home-sync__dot { width: 7px; height: 7px; border-radius: 50%; background: #9aa6bc; box-shadow: 0 0 0 4px rgba(154, 166, 188, 0.12); }
.home-sync[data-status="synced"] .home-sync__dot { background: #61cda8; box-shadow: 0 0 0 4px rgba(97, 205, 168, 0.14); }
.home-sync[data-status="syncing"] .home-sync__dot { background: #7598ec; animation: sync-pulse 1s ease-in-out infinite; }
.home-sync[data-status="error"] .home-sync__dot { background: #e68a96; }
.home-history { display: flex; overflow: hidden; border: 1px solid rgba(164, 180, 218, 0.5); border-radius: 11px; background: rgba(255, 255, 255, 0.72); }
.home-history button { display: grid; place-items: center; width: 34px; height: 34px; border: 0; background: transparent; color: #60709c; cursor: pointer; }
.home-history button + button { border-left: 1px solid rgba(164, 180, 218, 0.38); }
.home-history button:disabled { cursor: default; opacity: 0.32; }
.home-edit-button { display: inline-flex; align-items: center; gap: 7px; min-height: 38px; padding: 0 14px; border: 1px solid rgba(132, 151, 207, 0.62); border-radius: 12px; background: rgba(255, 255, 255, 0.78); color: #52638f; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
.home-edit-button.is-active { border-color: #7c93e5; background: #7488d7; color: white; box-shadow: 0 8px 20px rgba(94, 116, 196, 0.26); }
.home-avatar { display: grid; place-items: center; width: 38px; height: 38px; border: 2px solid white; border-radius: 50%; background: linear-gradient(145deg, #9cb0ed, #ad98d8); box-shadow: 0 5px 14px rgba(82, 95, 142, 0.22); color: white; font-size: 12px; font-weight: 800; text-decoration: none; }
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
