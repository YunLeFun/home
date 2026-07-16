import { pwa } from './config/pwa'
import { appDescription } from './constants/index'

export default defineNuxtConfig({
  compatibilityDate: '2026-07-16',
  srcDir: '.',

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
    '~/styles/css-vars.css',
    '~/styles/index.scss',
  ],

  runtimeConfig: {
    cloudbaseApiKey: '',
    cloudbaseAllowMemoryFallback: process.env.NODE_ENV !== 'production',
    cloudbaseDeviceStatesCollection: 'home_device_states',
    cloudbaseHomeLayoutsCollection: 'home_layouts',
    public: {
      siteOrigin: 'https://home.yunle.fun',
      deviceSyncEnabled: false,
      homeSyncEnabled: false,
      yunleAuthOrigin: 'https://www.yunle.fun',
      yunleAppsOrigin: 'https://apps.yunle.fun',
      cloudbaseEnvId: '',
      cloudbaseRegion: 'ap-shanghai',
      cloudbaseAccessKey: '',
      cloudbaseSessionBridgeOrigin: 'https://www.yunle.fun',
      cloudbaseSessionBridgePath: '/auth/sso',
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
        { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
        { rel: 'icon', type: 'image/svg+xml', href: '/home-4-line.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: appDescription },
        { name: 'theme-color', content: '#f4f7fd' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      ],
    },
  },

  pwa,

  devtools: {
    enabled: process.env.NODE_ENV !== 'production',
  },
})
