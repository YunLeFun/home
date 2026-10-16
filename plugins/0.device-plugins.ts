import { installBuiltinDevicePlugins, preloadDevicePluginComponents } from '~/devices'

export default defineNuxtPlugin({
  name: 'device-plugins',
  enforce: 'pre',
  async setup() {
    installBuiltinDevicePlugins()
    // Glyphs render in the scene on first paint; warm them before hydration.
    await preloadDevicePluginComponents('glyph')
  },
})
