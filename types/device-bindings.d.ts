import type { createDeviceBindingRuntime } from '~/utils/device-bindings'

declare module '#app' {
  interface NuxtApp {
    $deviceBindings?: ReturnType<typeof createDeviceBindingRuntime>
  }
}

export {}
