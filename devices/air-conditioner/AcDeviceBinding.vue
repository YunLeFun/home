<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AcDeviceSnapshot, HomeAssistantBinding } from '~/types'

const props = defineProps<{ deviceId: string }>()
const runtime = import.meta.client ? useNuxtApp().$deviceBindings : undefined
const link = computed(() => runtime?.get(props.deviceId))
const { session } = useYunleSession()
const loggedIn = computed(() => session.value?.authenticated === true)
const baseUrl = ref('')
const token = ref('')
const entityId = ref('')
const entities = ref<{ entityId: string, snapshot: AcDeviceSnapshot }[]>([])
const busy = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

watch(() => link.value?.binding, (binding) => {
  baseUrl.value = binding?.baseUrl ?? ''
  entityId.value = binding?.entityId ?? ''
  entities.value = []
  token.value = ''
}, { immediate: true })
watch([baseUrl, token], () => {
  entities.value = []
  success.value = null
})
watch(() => session.value?.user?.id, () => {
  token.value = ''
  entities.value = []
  success.value = null
})

async function run(action: () => Promise<void>) {
  busy.value = true
  error.value = null
  success.value = null
  try {
    await action()
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : '操作失败，请重试'
  }
  finally {
    busy.value = false
  }
}

function test() {
  void run(async () => {
    if (!runtime)
      return
    entities.value = await runtime.testConnection(baseUrl.value, token.value)
    if (!entities.value.some(entity => entity.entityId === entityId.value))
      entityId.value = entities.value.find(entity => !entity.snapshot.capabilities.unsupportedReason)?.entityId ?? ''
    success.value = entities.value.length ? '连接成功，请选择空调实体并保存绑定' : '连接成功，但未找到空调实体'
  })
}

function bind() {
  void run(async () => {
    const binding: HomeAssistantBinding = { provider: 'home-assistant', baseUrl: baseUrl.value, entityId: entityId.value }
    await runtime?.bind(props.deviceId, binding, token.value)
    token.value = ''
    success.value = '绑定已保存到云端，令牌仅保存在此浏览器'
  })
}

function unbind() {
  void run(async () => {
    await runtime?.unbind(props.deviceId)
    success.value = '已解除云端绑定'
  })
}
</script>

<template>
  <details class="ac-binding" :open="link?.status === 'needs-token'">
    <summary><span class="i-carbon-connect" />{{ link?.binding ? '真实设备绑定设置' : '绑定真实设备' }}</summary>
    <form class="ac-binding__form" @submit.prevent="test">
      <p>连接 Home Assistant 中的空调。绑定信息随 YunLe 账号同步；长期访问令牌只保存在本机，不上传云端。</p>
      <p v-if="!loggedIn" role="status">请先登录 YunLe，再保存云端绑定。</p>
      <label>HA 地址<input v-model="baseUrl" type="url" placeholder="https://ha.example.com" required :disabled="busy" autocomplete="url"></label>
      <label>HA 长期访问令牌<input v-model="token" type="password" placeholder="仅保存在此浏览器" required :disabled="busy" autocomplete="off" :spellcheck="false"></label>
      <small>线上页面需要 HTTPS 地址及有效证书。建议为 HA 单独创建非管理员用户生成令牌。</small>
      <button type="submit" :disabled="busy || !baseUrl || !token">{{ busy ? '正在处理…' : '测试连接' }}</button>
      <label v-if="entities.length">空调实体
        <select v-model="entityId" :disabled="busy">
          <option v-for="entity in entities" :key="entity.entityId" :value="entity.entityId" :disabled="Boolean(entity.snapshot.capabilities.unsupportedReason)">
            {{ entity.snapshot.name }} · {{ entity.entityId }}{{ entity.snapshot.capabilities.unsupportedReason ? `（${entity.snapshot.capabilities.unsupportedReason}）` : '' }}
          </option>
        </select>
      </label>
      <button v-if="entities.length" type="button" :disabled="busy || !loggedIn || !entityId" @click="bind">保存绑定</button>
      <div v-if="link?.binding" class="ac-binding__actions">
        <button type="button" :disabled="busy" @click="unbind">解除绑定</button>
        <button type="button" :disabled="busy" @click="runtime?.forgetToken(link.binding.baseUrl)">删除此 HA 的本机令牌</button>
      </div>
      <p v-if="error || link?.bindingError" class="ac-binding__error" role="alert">{{ error || link?.bindingError }}</p>
      <p v-if="success" role="status">{{ success }}</p>
    </form>
  </details>
</template>

<style scoped>
.ac-binding { border: 1px solid var(--brand-outline); border-radius: 18px; background: var(--brand-surface-raised); color: var(--brand-ink); }
.ac-binding { overflow: hidden; border-color: var(--brand-line); border-radius: 20px; background: var(--brand-glass); box-shadow: var(--shadow-sm); transition: box-shadow var(--dur-2) ease; }
.ac-binding[open] { box-shadow: var(--shadow-md); }
.ac-binding summary { display: flex; align-items: center; gap: 8px; padding: 16px 20px; font-size: 13px; font-weight: 650; list-style: none; cursor: pointer; }
.ac-binding summary::-webkit-details-marker { display: none; }
.ac-binding summary::after { margin-left: auto; color: var(--brand-muted); content: '›'; font-size: 18px; transition: transform var(--dur-2) var(--ease-spring); }
.ac-binding[open] summary::after { transform: rotate(90deg); }
.ac-binding[open] .ac-binding__form { animation: rise-in var(--dur-3) var(--ease-out); }
.ac-binding__form { display: grid; gap: 12px; padding: 0 20px 20px; }
.ac-binding p, .ac-binding small { margin: 0; color: var(--brand-muted); font-size: 12px; line-height: 1.7; }
.ac-binding label { display: grid; gap: 6px; font-size: 12px; font-weight: 650; }
.ac-binding input, .ac-binding select { min-width: 0; width: 100%; min-height: 42px; padding: 9px 12px; border: 1px solid var(--brand-outline); border-radius: 10px; background: var(--brand-surface); color: var(--brand-ink); font: inherit; }
.ac-binding button { justify-self: start; transition: transform var(--dur-2) var(--ease-spring); min-height: 40px; padding: 8px 14px; border: 1px solid var(--brand-outline); border-radius: 10px; background: var(--brand-primary-soft); color: var(--brand-ink); font: inherit; font-size: 12px; cursor: pointer; }
.ac-binding button:active:not(:disabled) { transform: scale(.96); }
.ac-binding button:disabled { opacity: .5; cursor: not-allowed; }
.ac-binding__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.ac-binding .ac-binding__error { color: var(--tone-danger); }
.ac-binding :focus-visible { outline: 2px solid var(--brand-secondary); outline-offset: 3px; }
</style>
