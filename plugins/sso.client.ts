import { adoptSsoCode, consumeSsoRedirect } from '@yunlefun/sso'

export default defineNuxtPlugin({
  name: 'sso',
  dependsOn: ['cloudbase'],
  async setup() {
    const authorization = consumeSsoRedirect()
    if (!authorization?.ok)
      return

    const config = useRuntimeConfig()
    const cloudbase = useCloudBaseClient()
    const notice = useState<string | null>('sso-notice', () => null)
    const account = useYunleSession()
    try {
      const auth = await cloudbase.getAuth('sso')
      if (!auth)
        throw new Error('CloudBase authentication is not configured')
      await adoptSsoCode(auth, authorization, {
        exchangeUrl: String(config.public.ssoExchangeUrl),
      })
      await account.refresh()
    }
    catch {
      notice.value = '登录未完成，可重新登录。本地家电仍可使用。'
    }
  },
})
