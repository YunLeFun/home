import cloudbaseSdk from '@cloudbase/js-sdk'

export default defineNuxtPlugin(() => ({
  provide: {
    cloudbaseSdk,
  },
}))
