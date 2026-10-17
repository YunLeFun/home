import type { ModuleOptions } from '@vite-pwa/nuxt'
import { appDescription, appName } from '../constants/index'

const scope = '/'

export const pwa: ModuleOptions = {
  registerType: 'autoUpdate',
  scope,
  base: scope,
  manifest: {
    id: scope,
    scope,
    name: appName,
    short_name: appName,
    description: appDescription,
    lang: 'zh-CN',
    background_color: '#eef5ff',
    theme_color: '#eef5ff',
    icons: [
      {
        src: 'pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: 'maskable-icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,txt,png,ico,svg}'],
    navigateFallback: null,
    cleanupOutdatedCaches: true,
  },
  registerWebManifestInRouteRules: true,
  writePlugin: true,
  devOptions: {
    enabled: process.env.VITE_PLUGIN_PWA === 'true',
  },
}
