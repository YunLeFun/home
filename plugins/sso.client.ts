import { adoptSsoCode, consumeSsoRedirect } from '@yunlefun/sso'

export default defineNuxtPlugin({
  name: 'sso',
  async setup() {
    const authorization = consumeSsoRedirect()
    if (!authorization?.ok)
      return

    const config = useRuntimeConfig()
    const cloudbase = useCloudBaseClient()
    const auth = await cloudbase.getAuth()
    if (!auth)
      throw new Error('CloudBase authentication is not configured')

    await adoptSsoCode(auth, authorization, {
      exchangeUrl: String(config.public.ssoExchangeUrl),
    })
    await useYunleSession().refresh()
  },
})
