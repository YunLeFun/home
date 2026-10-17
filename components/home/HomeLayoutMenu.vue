<script setup lang="ts">
import { nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import { HOME_TEMPLATES } from '~/constants/home'
import type { SavedHomeLayout } from '~/types'
import { MAX_LAYOUT_NAME, MAX_SAVED_LAYOUTS } from '~/utils/home'

const props = defineProps<{
  layouts: readonly SavedHomeLayout[]
  /** The saved layout the home matches right now. */
  activeLayoutId: string | null
}>()

const emit = defineEmits<{
  save: [name: string]
  apply: [id: string]
  overwrite: [id: string]
  rename: [id: string, name: string]
  remove: [id: string]
}>()

const root = useTemplateRef<HTMLElement>('root')
const open = shallowRef(false)
const draft = shallowRef('')
const renaming = shallowRef<string | null>(null)
const renameDraft = shallowRef('')
/** An action waiting for a second click: deleting or overwriting a layout. */
const pending = shallowRef<{ id: string, action: 'remove' | 'overwrite' } | null>(null)

onClickOutside(root, () => {
  open.value = false
})

watch(open, (value) => {
  if (!value) {
    renaming.value = null
    pending.value = null
  }
})

function defaultName() {
  return `布局 ${props.layouts.length + 1}`
}

function save() {
  emit('save', draft.value.trim() || defaultName())
  draft.value = ''
}

async function startRename(layout: SavedHomeLayout) {
  renaming.value = layout.id
  renameDraft.value = layout.name
  pending.value = null
  await nextTick()
  root.value?.querySelector<HTMLInputElement>('.layout-menu__rename')?.select()
}

function finishRename(id: string) {
  if (renaming.value !== id)
    return
  if (renameDraft.value.trim())
    emit('rename', id, renameDraft.value)
  renaming.value = null
}

function confirm(id: string, action: 'remove' | 'overwrite') {
  if (pending.value?.id !== id || pending.value.action !== action) {
    pending.value = { id, action }
    return
  }
  pending.value = null
  if (action === 'remove')
    emit('remove', id)
  else
    emit('overwrite', id)
}

function apply(id: string) {
  emit('apply', id)
  open.value = false
}

function savedDate(layout: SavedHomeLayout) {
  const date = new Date(layout.savedAt)
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <div ref="root" class="layout-menu" @keydown.esc="open = false">
    <button
      type="button"
      class="layout-menu__toggle"
      :class="{ 'is-open': open }"
      :aria-expanded="open"
      aria-haspopup="dialog"
      title="我的布局"
      @click="open = !open"
    >
      <span class="i-carbon-bookmark" /><span class="layout-menu__label">布局</span>
    </button>
    <Transition name="layout-menu">
      <div v-if="open" class="layout-menu__panel" role="dialog" aria-label="我的布局">
        <form class="layout-menu__save" @submit.prevent="save">
          <input
            v-model="draft"
            type="text"
            :maxlength="MAX_LAYOUT_NAME"
            :placeholder="defaultName()"
            aria-label="新布局名称"
            :disabled="layouts.length >= MAX_SAVED_LAYOUTS"
          >
          <button type="submit" :disabled="layouts.length >= MAX_SAVED_LAYOUTS">
            <span class="i-carbon-save" />保存当前
          </button>
        </form>
        <p v-if="layouts.length >= MAX_SAVED_LAYOUTS" class="layout-menu__note">
          最多保存 {{ MAX_SAVED_LAYOUTS }} 套布局，先删掉一套再保存
        </p>
        <p v-if="!layouts.length" class="layout-menu__empty">
          把当前的家具和设备摆放存成一套布局，随时切换回来。
        </p>
        <ul v-else class="layout-menu__list">
          <li v-for="layout in layouts" :key="layout.id" :data-active="layout.id === activeLayoutId">
            <input
              v-if="renaming === layout.id"
              v-model="renameDraft"
              class="layout-menu__rename"
              type="text"
              :maxlength="MAX_LAYOUT_NAME"
              aria-label="布局名称"
              @keydown.enter.prevent="finishRename(layout.id)"
              @keydown.esc.stop="renaming = null"
              @blur="finishRename(layout.id)"
            >
            <button v-else type="button" class="layout-menu__apply" :title="`切换到「${layout.name}」`" @click="apply(layout.id)">
              <strong>{{ layout.name }}</strong>
              <small>
                {{ HOME_TEMPLATES[layout.templateId].name }} · {{ savedDate(layout) }}
                <em v-if="layout.id === activeLayoutId">当前</em>
              </small>
            </button>
            <div class="layout-menu__actions">
              <button type="button" title="重命名" aria-label="重命名" @click="startRename(layout)">
                <span class="i-carbon-edit" />
              </button>
              <button
                type="button"
                :class="{ 'is-confirm': pending?.id === layout.id && pending.action === 'overwrite' }"
                :title="pending?.id === layout.id && pending.action === 'overwrite' ? '再点一次，用当前摆放覆盖' : '用当前摆放覆盖'"
                aria-label="用当前摆放覆盖"
                @click="confirm(layout.id, 'overwrite')"
              >
                <span class="i-carbon-save" />
              </button>
              <button
                type="button"
                :class="{ 'is-confirm': pending?.id === layout.id && pending.action === 'remove' }"
                :title="pending?.id === layout.id && pending.action === 'remove' ? '再点一次删除' : '删除'"
                aria-label="删除"
                @click="confirm(layout.id, 'remove')"
              >
                <span class="i-carbon-trash-can" />
              </button>
            </div>
            <p v-if="pending?.id === layout.id" class="layout-menu__confirm">
              {{ pending.action === 'remove' ? '再点一次删除这套布局' : '再点一次，用当前摆放覆盖这套布局' }}
            </p>
          </li>
        </ul>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.layout-menu { position: relative; }
.layout-menu__toggle { display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 0 12px; border: 1px solid var(--brand-outline); border-radius: 12px; background: var(--brand-glass); color: var(--brand-ink); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; transition: transform var(--dur-3) var(--ease-spring); }
.layout-menu__toggle:hover { transform: translateY(-1px); }
.layout-menu__toggle:active { transform: scale(0.96); }
.layout-menu__toggle.is-open { border-color: var(--brand-primary); }
.layout-menu__panel { position: absolute; z-index: 40; top: calc(100% + 8px); right: 0; display: grid; gap: 10px; width: min(320px, calc(100vw - 28px)); padding: 12px; border: 1px solid var(--brand-line); border-radius: 18px; background: var(--brand-glass-strong); box-shadow: var(--shadow-lg); color: var(--brand-ink); backdrop-filter: blur(16px); }
.layout-menu__save { display: flex; gap: 6px; }
.layout-menu__save input, .layout-menu__rename { flex: 1; min-width: 0; min-height: 34px; padding: 0 10px; border: 1px solid var(--brand-outline); border-radius: 10px; background: var(--brand-glass); color: var(--brand-ink); font: inherit; font-size: 12px; }
.layout-menu__save input:focus, .layout-menu__rename:focus { border-color: var(--brand-primary); outline: none; }
.layout-menu__save button { display: inline-flex; align-items: center; gap: 5px; min-height: 34px; padding: 0 12px; border: 0; border-radius: 10px; background: var(--brand-primary); color: var(--ylf-c-text-on-accent); font: inherit; font-size: 12px; font-weight: 700; white-space: nowrap; cursor: pointer; }
.layout-menu__save button:disabled, .layout-menu__save input:disabled { cursor: default; opacity: 0.45; }
.layout-menu__empty, .layout-menu__note { margin: 0; color: var(--brand-muted); font-size: 11px; line-height: 1.6; }
.layout-menu__list { display: grid; gap: 4px; max-height: min(360px, 60dvh); margin: 0; padding: 0; overflow-y: auto; list-style: none; }
.layout-menu__list li { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 4px; padding: 4px; border-radius: 12px; }
.layout-menu__list li[data-active="true"] { background: rgba(var(--brand-focus-rgb), 0.1); }
.layout-menu__apply { display: grid; gap: 2px; min-width: 0; padding: 6px 8px; border: 0; border-radius: 10px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.layout-menu__apply:hover, .layout-menu__apply:focus-visible { background: var(--brand-glass-sunken); outline: none; }
.layout-menu__apply strong { overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.layout-menu__apply small { color: var(--brand-muted); font-size: 10px; }
.layout-menu__apply em { margin-left: 4px; color: var(--brand-primary); font-style: normal; font-weight: 700; }
.layout-menu__actions { display: flex; }
.layout-menu__actions button { display: grid; place-items: center; width: 30px; height: 30px; border: 0; border-radius: 9px; background: transparent; color: var(--brand-muted); cursor: pointer; }
.layout-menu__actions button:hover, .layout-menu__actions button:focus-visible { background: var(--brand-glass-sunken); color: var(--brand-ink); outline: none; }
.layout-menu__actions button.is-confirm { background: color-mix(in oklab, var(--tone-danger) 14%, transparent); color: var(--tone-danger); }
.layout-menu__confirm { grid-column: 1 / -1; margin: 0 8px 4px; color: var(--tone-danger); font-size: 10px; }
.layout-menu-enter-active { transition: opacity var(--dur-2) ease, translate var(--dur-3) var(--ease-spring); }
.layout-menu-leave-active { transition: opacity var(--dur-1) ease; }
.layout-menu-enter-from, .layout-menu-leave-to { opacity: 0; translate: 0 -6px; }
@media (max-width: 840px) {
  .layout-menu__label { display: none; }
  .layout-menu__toggle { width: 38px; padding: 0; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) {
  .layout-menu-enter-active, .layout-menu-leave-active { transition: none; }
}
</style>
