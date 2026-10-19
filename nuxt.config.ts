import { fileURLToPath } from 'node:url'
import { pwa } from './config/pwa'
import { appDescription, appName, appTagline } from './constants/index'

const siteOrigin = (process.env.NUXT_PUBLIC_SITE_ORIGIN || 'https://home.yunle.fun').replace(/\/+$/, '')
// Pages override the title and description with useShareMeta; the card is shared.
const shareDescription = `${appTagline}。${appDescription}，空调、风扇、电视、扫地机器人与暖手宝都在云上。`

export default defineNuxtConfig({
  compatibilityDate: '2026-07-16',
  srcDir: '.',
  // srcDir is the repository root, so keep the watcher out of non-web trees:
  // session worktrees and Swift build output hold tens of thousands of files,
  // and past macOS's 10240-descriptor limit every child spawn fails with EBADF.
  ignore: ['.claude/**', '.build/**', '.edgeone/**', 'apps/**', 'packages/**', 'infra/**', 'docs/**', 'dist/**'],

  modules: [
    '@vueuse/nuxt',
    '@unocss/nuxt',
    '@pinia/nuxt',
    '@nuxtjs/color-mode',
    '@vite-pwa/nuxt',
    '@nuxt/eslint',
  ],

  css: [
    '@unocss/reset/tailwind.css',
    // YunLeFun Design tokens; Home's palette in css-vars.css builds on them.
    '@yunlefun/ui/css',
    '~/styles/css-vars.css',
    '~/styles/index.scss',
    '~/styles/controls.scss',
    '@yunlefun-home/air-conditioner/controls.css',
  ],

  vite: {
    server: {
      watch: {
        ignored: ['**/.claude/**', '**/.build/**', '**/apps/**', '**/packages/**'],
      },
    },
    resolve: {
      alias: [{
        // Keep the renderer's relative font URL out of Nuxt's root assets alias.
        find: /^\.?\/?assets\/fonts\/digital-7-mono\.ttf$/,
        replacement: fileURLToPath(new URL('./assets/fonts/digital-7-mono.ttf', import.meta.resolve('@yunlefun-home/air-conditioner/style.css'))),
      }],
    },
  },

  runtimeConfig: {
    public: {
      siteOrigin,
      deviceSyncEnabled: true,
      homeSyncEnabled: true,
      ssoClientId: 'home-web',
      ssoOrigin: 'https://www.yunle.fun',
      ssoExchangeUrl: 'https://api.yunle.fun/sso-ticket',
      ssoRedirectUri: 'https://home.yunle.fun/',
      cloudbaseEnvId: '',
      cloudbaseRegion: 'ap-shanghai',
      cloudbaseAccessKey: '',
      cloudbaseDeviceStatesCollection: 'home_device_states',
      cloudbaseDeviceBindingsCollection: 'home_device_bindings',
      cloudbaseHomeLayoutsCollection: 'home_layouts',
    },
  },

  colorMode: {
    classSuffix: '',
  },

  nitro: {
    preset: 'cloudflare-module',
    esbuild: {
      options: {
        target: 'esnext',
      },
    },
    prerender: {
      crawlLinks: false,
      routes: ['/'],
      ignore: ['/hi'],
    },
  },

  routeRules: {
    '/api/**': {
      headers: {
        'cache-control': 'no-store',
      },
    },
  },

  app: {
    head: {
      htmlAttrs: {
        lang: 'zh-CN',
      },
      viewport: 'width=device-width,initial-scale=1',
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/brand-mark.svg' },
        { rel: 'icon', type: 'image/png', href: '/favicon-32x32.png', sizes: '32x32' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: appDescription },
        { name: 'theme-color', content: '#eef5ff' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        // Link previews; crawlers need absolute image URLs.
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: appName },
        { property: 'og:locale', content: 'zh_CN' },
        { property: 'og:title', content: appName },
        { property: 'og:description', content: shareDescription },
        { property: 'og:image', content: `${siteOrigin}/og-image.jpg` },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: `${appName}：${appTagline}` },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: appName },
        { name: 'twitter:description', content: shareDescription },
        { name: 'twitter:image', content: `${siteOrigin}/og-image.jpg` },
      ],
    },
  },

  experimental: {
    // Morph the device glyph between the quick control and the detail page.
    viewTransition: true,
  },

  pwa,

  devtools: {
    enabled: process.env.NODE_ENV !== 'production',
  },
})
