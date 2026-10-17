<script setup lang="ts">
import type { DevicePluginCategory, DeviceTone } from '~/devices/types'
import type { DeviceKind, HomeSurfaceKind } from '~/types'
import { computed, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { HOME_DEVICE_ORDER } from '~/constants/home'
import { getDevicePlugin } from '~/devices/registry'

const library = usePluginLibrary()

const CATEGORY_LABELS: Record<DevicePluginCategory, string> = {
  climate: '冷暖',
  cleaning: '清洁',
  media: '影音',
  comfort: '舒适',
  sensor: '传感',
  fun: '趣味',
}
const SURFACE_LABELS: Record<HomeSurfaceKind, string> = { wall: '墙面', floor: '地面', tabletop: '桌面' }
// Tone each plugin shows in its running preview.
const PREVIEW_TONES: Record<DeviceKind, DeviceTone[]> = {
  'air-conditioner': ['cool', 'heat'],
  'fan': ['active'],
  'television': ['active'],
  'robot-vacuum': ['active'],
  'hand-warmer': ['warm'],
}

const plugins = computed(() => HOME_DEVICE_ORDER.map((kind) => {
  const manifest = getDevicePlugin(kind)!.manifest
  return { kind, manifest, installed: library.isInstalled(kind) }
}))

type Filter = 'all' | 'installed' | DevicePluginCategory
const filter = shallowRef<Filter>('all')
const query = shallowRef('')
const filters = computed(() => {
  const categories = [...new Set(plugins.value.map(plugin => plugin.manifest.category))]
  return [
    { id: 'all' as Filter, label: '全部' },
    { id: 'installed' as Filter, label: '已安装' },
    ...categories.map(category => ({ id: category as Filter, label: CATEGORY_LABELS[category] })),
  ]
})
const visible = computed(() => {
  const text = query.value.trim().toLowerCase()
  return plugins.value.filter((plugin) => {
    if (filter.value === 'installed' && !plugin.installed)
      return false
    if (filter.value !== 'all' && filter.value !== 'installed' && plugin.manifest.category !== filter.value)
      return false
    if (!text)
      return true
    const { name, description, author, id } = plugin.manifest
    return [name, description, author.name, id].some(value => value.toLowerCase().includes(text))
  })
})
const installedCount = computed(() => plugins.value.filter(plugin => plugin.installed).length)

// The bundle hero plays every icon's motion while hovered.
const suiteHovered = shallowRef(false)
const hoveredCard = shallowRef<DeviceKind | null>(null)

// Detail sheet
const detailKind = shallowRef<DeviceKind | null>(null)
const detail = computed(() => plugins.value.find(plugin => plugin.kind === detailKind.value) ?? null)
const previewRunning = shallowRef(true)
const previewTone = shallowRef<DeviceTone>('active')
const notice = shallowRef<string | null>(null)
let noticeTimer: ReturnType<typeof setTimeout> | undefined

watch(detailKind, (kind) => {
  previewRunning.value = true
  previewTone.value = kind ? PREVIEW_TONES[kind][0]! : 'active'
})

function showNotice(message: string) {
  notice.value = message
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    notice.value = null
  }, 2400)
}

function toggleInstall(kind: DeviceKind) {
  const name = getDevicePlugin(kind)!.manifest.name
  if (library.isInstalled(kind)) {
    library.uninstall(kind)
    showNotice(`已卸载${name}，重新安装会回到原来的位置`)
  }
  else {
    library.install(kind)
    showNotice(`${name}已安装，回到家园即可看到`)
  }
}

function restoreSuite() {
  library.installAll()
  showNotice('云家电已全部安装')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape')
    detailKind.value = null
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(noticeTimer)
})

const ICON_SAMPLE = `export const icon = definePluginIcon({
  background: ['#e0f7ec', '#a7dfc3'],
  shapes: [
    { type: 'circle', cx: 32, cy: 25, r: 17, fill: 'surface' },
    { type: 'group', motion: 'spin', origin: [32, 25],
      children: [/* 扇叶 path */] },
    { type: 'circle', cx: 32, cy: 25, r: 2, fill: 'tone' },
  ],
})`
</script>

<template>
  <div class="market">
    <div class="market__ambient" aria-hidden="true">
      <span /><span />
    </div>

    <header class="market__top">
      <NuxtLink to="/" class="market__back">
        <span class="i-carbon-arrow-left" />回到家园
      </NuxtLink>
    </header>

    <main class="market__main">
      <section class="market__intro">
        <h1>家电市场</h1>
        <p>为家园挑选智能家电。每个插件自带图标与动效，安装后就能摆进房间。</p>
      </section>

      <section
        class="market-suite"
        aria-labelledby="suite-title"
        @pointerenter="suiteHovered = true"
        @pointerleave="suiteHovered = false"
      >
        <div class="market-suite__icons" aria-hidden="true">
          <PluginIcon
            v-for="(plugin, index) in plugins"
            :key="plugin.kind"
            :icon="plugin.manifest.appIcon"
            :size="64"
            :active="suiteHovered"
            :tone="PREVIEW_TONES[plugin.kind][0]"
            :style="{ '--i': index, '--n': plugins.length }"
          />
        </div>
        <div class="market-suite__copy">
          <span class="market__badge"><span class="i-carbon-checkmark-filled" />默认已安装</span>
          <h2 id="suite-title">云家电</h2>
          <p>云乐坊官方家电套装：空调、风扇、电视、扫地机器人与暖手宝。开箱即用，也可以单独卸载。</p>
          <div class="market-suite__meta">
            <span>{{ installedCount }} / {{ plugins.length }} 已安装</span>
            <button v-if="installedCount < plugins.length" type="button" class="market__button is-primary" @click="restoreSuite">
              <span class="i-carbon-download" />全部安装
            </button>
          </div>
        </div>
      </section>

      <section class="market__toolbar" aria-label="筛选插件">
        <label class="market__search">
          <span class="i-carbon-search" />
          <span class="sr-only">搜索插件</span>
          <input v-model="query" type="search" placeholder="搜索插件、作者">
        </label>
        <div class="market__filters" role="group" aria-label="分类">
          <button
            v-for="item in filters"
            :key="item.id"
            type="button"
            :aria-pressed="filter === item.id"
            @click="filter = item.id"
          >
            {{ item.label }}
          </button>
        </div>
      </section>

      <TransitionGroup v-if="visible.length" tag="ul" name="market-card" class="market__grid" appear>
        <li v-for="(plugin, index) in visible" :key="plugin.kind" :style="{ '--stagger': index }">
          <article
            class="market-card"
            :data-installed="plugin.installed"
            @pointerenter="hoveredCard = plugin.kind"
            @pointerleave="hoveredCard = null"
          >
            <button type="button" class="market-card__open" :aria-label="`查看${plugin.manifest.name}详情`" @click="detailKind = plugin.kind" />
            <PluginIcon
              :icon="plugin.manifest.appIcon"
              :size="60"
              :active="hoveredCard === plugin.kind"
              :tone="PREVIEW_TONES[plugin.kind][0]"
            />
            <div class="market-card__copy">
              <h3>{{ plugin.manifest.name }}</h3>
              <p class="market-card__author">
                {{ plugin.manifest.author.name }}<span class="market__tag">官方</span>
              </p>
              <p class="market-card__description">
                {{ plugin.manifest.description }}
              </p>
            </div>
            <div class="market-card__footer">
              <span class="market__chip">{{ CATEGORY_LABELS[plugin.manifest.category] }}</span>
              <button
                type="button"
                class="market__button"
                :class="{ 'is-primary': !plugin.installed }"
                @click="toggleInstall(plugin.kind)"
              >
                <template v-if="plugin.installed">
                  <span class="i-carbon-checkmark" />已安装
                </template>
                <template v-else>
                  <span class="i-carbon-download" />安装
                </template>
              </button>
            </div>
          </article>
        </li>
      </TransitionGroup>
      <p v-else class="market__empty">
        没有找到匹配的插件
      </p>

      <section class="market-dev" aria-labelledby="dev-title">
        <div>
          <h2 id="dev-title">
            <span class="i-carbon-paint-brush" />为你的插件设计图标
          </h2>
          <p>
            图标是一份声明式矢量数据：64 × 64 画布、两色渐变底板，加上路径、圆形等基础图形。
            颜色可以使用 <code>tone</code>、<code>surface</code> 等主题色，图形可以声明
            <code>spin</code>、<code>flow</code>、<code>pulse</code> 等动效，设备运行时由家园统一播放。
            图标不含脚本与外部资源，第三方插件也能安全展示。
          </p>
        </div>
        <pre><code>{{ ICON_SAMPLE }}</code></pre>
      </section>
    </main>

    <Transition name="market-sheet">
      <div v-if="detail" class="market-sheet" role="presentation" @click.self="detailKind = null">
        <article class="market-sheet__panel" role="dialog" aria-modal="true" :aria-label="`${detail.manifest.name}详情`">
          <button type="button" class="market-sheet__close" aria-label="关闭" @click="detailKind = null">
            <span class="i-carbon-close" />
          </button>
          <div class="market-sheet__hero">
            <PluginIcon
              :icon="detail.manifest.appIcon"
              :size="104"
              :active="previewRunning"
              :tone="previewRunning ? previewTone : 'idle'"
              :label="`${detail.manifest.name}图标`"
            />
            <div class="market-sheet__preview" role="group" aria-label="图标预览">
              <button type="button" :aria-pressed="!previewRunning" @click="previewRunning = false">
                待机
              </button>
              <button
                v-for="tone in PREVIEW_TONES[detail.kind]"
                :key="tone"
                type="button"
                :aria-pressed="previewRunning && previewTone === tone"
                @click="previewRunning = true; previewTone = tone"
              >
                {{ tone === 'cool' ? '制冷' : tone === 'heat' ? '制热' : '运行' }}
              </button>
            </div>
          </div>
          <h2>{{ detail.manifest.name }}</h2>
          <p class="market-sheet__lead">
            {{ detail.manifest.description }}
          </p>
          <dl class="market-sheet__facts">
            <div><dt>作者</dt><dd>{{ detail.manifest.author.name }}</dd></div>
            <div><dt>版本</dt><dd>{{ detail.manifest.version }}</dd></div>
            <div><dt>分类</dt><dd>{{ CATEGORY_LABELS[detail.manifest.category] }}</dd></div>
            <div><dt>摆放</dt><dd>{{ detail.manifest.surfaces.map(surface => SURFACE_LABELS[surface]).join('、') }}</dd></div>
            <div><dt>标识</dt><dd><code>{{ detail.manifest.id }}</code></dd></div>
            <div v-if="detail.manifest.integrations.length">
              <dt>集成</dt><dd>{{ detail.manifest.integrations.map(item => item.name).join('、') }}</dd>
            </div>
          </dl>
          <p class="market-sheet__note">
            <span class="i-carbon-security" />官方插件随家园一起构建与审核，不需要额外权限。
          </p>
          <div class="market-sheet__actions">
            <a v-if="detail.manifest.homepage" class="market__button" :href="detail.manifest.homepage" target="_blank" rel="noopener noreferrer">
              <span class="i-carbon-logo-github" />源码
            </a>
            <NuxtLink v-if="detail.installed" class="market__button" :to="detail.manifest.route">
              <span class="i-carbon-launch" />打开设备
            </NuxtLink>
            <button type="button" class="market__button" :class="detail.installed ? 'is-danger' : 'is-primary'" @click="toggleInstall(detail.kind)">
              <template v-if="detail.installed">
                <span class="i-carbon-trash-can" />卸载
              </template>
              <template v-else>
                <span class="i-carbon-download" />安装
              </template>
            </button>
          </div>
        </article>
      </div>
    </Transition>

    <Transition name="market-notice">
      <div v-if="notice" class="market__notice" role="status">
        {{ notice }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.market { position: relative; isolation: isolate; min-height: 100dvh; overflow-x: hidden; color: var(--brand-ink); }
.market__ambient { position: absolute; z-index: -1; inset: 0; overflow: hidden; pointer-events: none; }
.market__ambient span { position: absolute; width: 44vmax; height: 44vmax; border-radius: 50%; filter: blur(70px); animation: ambient-drift 30s ease-in-out infinite; }
.market__ambient span:nth-child(1) { top: -20vmax; left: -12vmax; background: var(--ambient-a); }
.market__ambient span:nth-child(2) { top: 10vmax; right: -18vmax; background: var(--ambient-b); animation-delay: -12s; }

.market__top { display: flex; align-items: center; max-width: 1080px; margin: 0 auto; padding: 18px 24px 0; }
.market__back { display: inline-flex; align-items: center; gap: 7px; padding: 8px 12px; border: 1px solid var(--brand-outline); border-radius: 12px; background: var(--brand-glass); color: var(--brand-ink); font-size: 12px; font-weight: 650; text-decoration: none; backdrop-filter: blur(12px); transition: transform var(--dur-3) var(--ease-spring); }
.market__back:hover { transform: translateX(-2px); }

.market__main { display: grid; gap: 22px; max-width: 1080px; margin: 0 auto; padding: 18px 24px 64px; }
.market__intro h1 { margin: 0; font-size: clamp(26px, 4vw, 36px); letter-spacing: -0.03em; }
.market__intro p { margin: 6px 0 0; color: var(--brand-muted); font-size: 13px; }

.market-suite { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); align-items: center; gap: 28px; padding: 26px 30px; border: 1px solid var(--brand-line); border-radius: var(--ylf-radius-xl); background: linear-gradient(135deg, color-mix(in oklab, var(--brand-glass-strong) 92%, #cfe4fb), var(--brand-glass)); box-shadow: var(--shadow-lg), inset 0 1px 0 var(--brand-highlight); backdrop-filter: blur(20px); animation: rise-in var(--dur-4) var(--ease-out) backwards; }
.market-suite__icons { position: relative; display: flex; justify-content: center; min-height: 120px; }
.market-suite__icons .plugin-icon { margin-inline: -6px; transform: translateY(calc((var(--i) - (var(--n) - 1) / 2) * (var(--i) - (var(--n) - 1) / 2) * 4px)) rotate(calc((var(--i) - (var(--n) - 1) / 2) * 7deg)); transition: transform var(--dur-4) var(--ease-spring), box-shadow var(--dur-3) ease; animation: suite-pop var(--dur-4) var(--ease-spring) calc(120ms + var(--i) * 70ms) backwards; }
.market-suite:hover .market-suite__icons .plugin-icon { margin-inline: -2px; transform: translateY(-4px) rotate(0deg); }
.market-suite__copy h2 { margin: 8px 0 4px; font-size: 24px; letter-spacing: -0.02em; }
.market-suite__copy p { margin: 0; color: var(--brand-muted); font-size: 12px; line-height: 1.7; }
.market-suite__meta { display: flex; align-items: center; gap: 12px; margin-top: 14px; color: var(--brand-muted); font-size: 11px; font-weight: 650; }

.market__badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px; background: var(--tone-active-soft); color: var(--tone-active); font-size: 10px; font-weight: 700; }

.market__toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.market__search { display: flex; flex: 1 1 220px; align-items: center; gap: 8px; min-height: 40px; padding: 0 13px; border: 1px solid var(--brand-outline); border-radius: 13px; background: var(--brand-glass); color: var(--brand-muted); backdrop-filter: blur(12px); }
.market__search:focus-within { border-color: var(--brand-primary); }
.market__search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--brand-ink); font: inherit; font-size: 13px; }
.market__filters { display: flex; flex-wrap: wrap; gap: 6px; }
.market__filters button { min-height: 34px; padding: 0 13px; border: 1px solid var(--brand-outline); border-radius: 999px; background: var(--brand-glass); color: var(--brand-muted); font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; transition: background var(--dur-2) ease, color var(--dur-2) ease, transform var(--dur-2) var(--ease-spring); }
.market__filters button:active { transform: scale(0.95); }
.market__filters button[aria-pressed="true"] { border-color: var(--brand-primary); background: var(--brand-primary); color: var(--ylf-c-text-on-accent); }

.market__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(232px, 1fr)); gap: 14px; margin: 0; padding: 0; list-style: none; }
.market-card { position: relative; display: grid; grid-template-rows: auto 1fr auto; gap: 12px; height: 100%; padding: 18px; border: 1px solid var(--brand-line); border-radius: 22px; background: var(--brand-glass-strong); box-shadow: var(--shadow-sm), inset 0 1px 0 var(--brand-highlight); transition: transform var(--dur-3) var(--ease-spring), box-shadow var(--dur-3) ease; backdrop-filter: blur(16px); }
.market-card:hover { box-shadow: var(--shadow-lg), inset 0 1px 0 var(--brand-highlight); transform: translateY(-3px); }
.market-card .plugin-icon { transition: transform var(--dur-3) var(--ease-spring), box-shadow var(--dur-3) ease; }
.market-card:hover .plugin-icon { transform: rotate(-5deg) scale(1.05); }
.market-card__open { position: absolute; inset: 0; z-index: 0; border: 0; border-radius: inherit; background: transparent; cursor: pointer; }
.market-card__open:focus-visible { outline: 2px solid var(--brand-primary); outline-offset: 2px; }
.market-card > :not(.market-card__open) { position: relative; z-index: 1; pointer-events: none; }
.market-card__footer button { pointer-events: auto; }
.market-card__copy h3 { margin: 0; font-size: 15px; letter-spacing: -0.01em; }
.market-card__author { display: flex; align-items: center; gap: 6px; margin: 3px 0 0; color: var(--brand-muted); font-size: 11px; }
.market-card__description { margin: 8px 0 0; color: var(--brand-muted); font-size: 12px; line-height: 1.6; }
.market-card__footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.market__tag { padding: 1px 6px; border-radius: 6px; background: color-mix(in oklab, var(--brand-primary) 14%, transparent); color: var(--brand-primary); font-size: 9px; font-weight: 700; }
.market__chip { padding: 3px 9px; border-radius: 999px; background: var(--brand-glass-sunken); color: var(--brand-muted); font-size: 10px; font-weight: 650; }
.market__empty { margin: 30px 0; color: var(--brand-muted); font-size: 13px; text-align: center; }

.market__button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 0 13px; border: 1px solid var(--brand-outline); border-radius: 11px; background: var(--brand-glass); color: var(--brand-ink); font: inherit; font-size: 12px; font-weight: 700; text-decoration: none; cursor: pointer; transition: transform var(--dur-2) var(--ease-spring), background var(--dur-2) ease, color var(--dur-2) ease; }
.market__button:active { transform: scale(0.95); }
.market__button.is-primary { border-color: var(--brand-primary); background: var(--brand-primary); box-shadow: 0 8px 18px rgba(var(--brand-focus-rgb), 0.24); color: var(--ylf-c-text-on-accent); }
.market__button.is-danger { border-color: color-mix(in oklab, var(--tone-danger) 40%, transparent); color: var(--tone-danger); }

.market-dev { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 22px; align-items: center; padding: 22px 26px; border: 1px dashed var(--brand-line-strong); border-radius: var(--ylf-radius-xl); background: var(--brand-glass); }
.market-dev h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font-size: 16px; }
.market-dev p { margin: 0; color: var(--brand-muted); font-size: 12px; line-height: 1.8; }
.market-dev code { padding: 1px 5px; border-radius: 5px; background: var(--brand-glass-sunken); font-size: 11px; }
.market-dev pre { overflow-x: auto; margin: 0; padding: 14px 16px; border-radius: 14px; background: #1d2433; color: #dbe7f6; font-size: 11px; line-height: 1.6; }
.market-dev pre code { padding: 0; background: none; }

.market-sheet { position: fixed; z-index: 60; inset: 0; display: grid; justify-items: end; background: rgba(15, 23, 42, 0.28); backdrop-filter: blur(4px); }
.market-sheet__panel { position: relative; display: flex; flex-direction: column; gap: 14px; width: min(420px, 100%); height: 100%; overflow-y: auto; padding: 28px 26px; border-left: 1px solid var(--brand-line); background: var(--brand-glass-strong); box-shadow: var(--shadow-lg); backdrop-filter: blur(24px); }
.market-sheet__close { position: absolute; top: 16px; right: 16px; display: grid; place-items: center; width: 34px; height: 34px; border: 0; border-radius: 11px; background: var(--brand-glass-sunken); color: var(--brand-muted); cursor: pointer; }
.market-sheet__hero { display: grid; justify-items: center; gap: 14px; padding: 22px 0 6px; }
.market-sheet__hero .plugin-icon { animation: suite-pop var(--dur-4) var(--ease-spring) 80ms backwards; }
.market-sheet__preview { display: flex; padding: 3px; border-radius: 12px; background: var(--brand-glass-sunken); }
.market-sheet__preview button { min-height: 30px; padding: 0 12px; border: 0; border-radius: 9px; background: transparent; color: var(--brand-muted); font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; transition: background var(--dur-2) ease, color var(--dur-2) ease; }
.market-sheet__preview button[aria-pressed="true"] { background: var(--brand-glass-strong); box-shadow: var(--shadow-sm); color: var(--brand-ink); }
.market-sheet__panel h2 { margin: 4px 0 0; font-size: 22px; letter-spacing: -0.02em; text-align: center; }
.market-sheet__lead { margin: 0; color: var(--brand-muted); font-size: 13px; text-align: center; }
.market-sheet__facts { display: grid; gap: 0; margin: 6px 0 0; border: 1px solid var(--brand-line); border-radius: 16px; background: var(--brand-glass); }
.market-sheet__facts div { display: flex; justify-content: space-between; gap: 12px; padding: 10px 14px; font-size: 12px; }
.market-sheet__facts div + div { border-top: 1px solid var(--brand-line); }
.market-sheet__facts dt { color: var(--brand-muted); }
.market-sheet__facts dd { margin: 0; font-weight: 650; text-align: right; }
.market-sheet__facts code { font-size: 11px; }
.market-sheet__note { display: flex; align-items: flex-start; gap: 7px; margin: 0; color: var(--brand-muted); font-size: 11px; line-height: 1.6; }
.market-sheet__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: auto; padding-top: 8px; }

.market__notice { position: fixed; z-index: 70; bottom: 26px; left: 50%; padding: 10px 16px; border-radius: 999px; background: color-mix(in oklab, var(--brand-primary) 92%, transparent); box-shadow: var(--shadow-md); color: var(--ylf-c-text-on-accent); font-size: 12px; font-weight: 650; transform: translateX(-50%); white-space: nowrap; }

.market-card-enter-active { transition: opacity var(--dur-3) ease calc(var(--stagger) * 40ms), transform var(--dur-4) var(--ease-spring) calc(var(--stagger) * 40ms); }
.market-card-leave-active { transition: opacity var(--dur-2) ease, transform var(--dur-2) ease; }
.market-card-enter-from, .market-card-leave-to { opacity: 0; transform: translateY(12px) scale(0.97); }
.market-card-move { transition: transform var(--dur-3) var(--ease-spring); }
.market-sheet-enter-active, .market-sheet-leave-active { transition: opacity var(--dur-3) ease; }
.market-sheet-enter-active .market-sheet__panel { transition: transform var(--dur-4) var(--ease-spring); }
.market-sheet-leave-active .market-sheet__panel { transition: transform var(--dur-2) var(--ease-out); }
.market-sheet-enter-from, .market-sheet-leave-to { opacity: 0; }
.market-sheet-enter-from .market-sheet__panel, .market-sheet-leave-to .market-sheet__panel { transform: translateX(40px); }
.market-notice-enter-active, .market-notice-leave-active { transition: opacity var(--dur-2) ease, transform var(--dur-3) var(--ease-spring); }
.market-notice-enter-from, .market-notice-leave-to { opacity: 0; transform: translate(-50%, 12px) scale(0.94); }

@keyframes suite-pop { from { opacity: 0; transform: translateY(16px) scale(0.6); } }

@media (max-width: 720px) {
  .market__top { padding: 12px 14px 0; }
  .market__main { gap: 18px; padding: 12px 14px 48px; }
  .market-suite { grid-template-columns: 1fr; gap: 18px; padding: 22px 18px; }
  .market-suite__icons .plugin-icon { --pi-size: 52px !important; }
  .market-dev { grid-template-columns: 1fr; padding: 18px; }
  .market-sheet { align-items: end; justify-items: stretch; }
  .market-sheet__panel { width: 100%; height: auto; max-height: 88dvh; border-left: 0; border-radius: 26px 26px 0 0; }
  .market-sheet-enter-from .market-sheet__panel, .market-sheet-leave-to .market-sheet__panel { transform: translateY(40px); }
}

@media (prefers-reduced-motion: reduce) {
  .market__ambient span, .market-suite, .market-suite__icons .plugin-icon, .market-sheet__hero .plugin-icon { animation: none; }
}
</style>
