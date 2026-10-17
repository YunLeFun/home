import { installBuiltinDevicePlugins, preloadDevicePluginComponents } from '~/devices'

export default defineNuxtPlugin({
  name: 'device-plugins',
  enforce: 'pre',
  async setup() {
    installBuiltinDevicePlugins()
    // Glyphs render on the device detail page's first paint; warm them before hydration.
    await preloadDevicePluginComponents('glyph')
  },
})
