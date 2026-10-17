import { fileURLToPath } from 'node:url'
import { pwa } from './config/pwa'
import { appDescription } from './constants/index'

export default defineNuxtConfig({
  compatibilityDate: '2026-07-16',
  srcDir: '.',
  // Session worktrees under .claude/ contain full checkouts with node_modules.
  ignore: ['.claude/**'],

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
        ignored: ['**/.claude/**'],
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
      siteOrigin: 'https://home.yunle.fun',
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
