import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const auth = readFileSync(new URL('../composables/auth.ts', import.meta.url), 'utf8')
const callback = readFileSync(new URL('../plugins/sso.client.ts', import.meta.url), 'utf8')

describe('Home SSO v3 consumer', () => {
  it('uses only the explicit redirect + PKCE consumer', () => {
    expect(auth).toContain('clientId: String(config.public.ssoClientId)')
    expect(auth).toContain('scope: [\'identity:bootstrap\']')
    expect(auth).toContain('redirectUri: String(config.public.ssoRedirectUri)')
    expect(callback).toContain('adoptSsoCode(auth, authorization, {')
  })

  it('deletes the hidden iframe and shared-session adoption path', () => {
    expect(existsSync(new URL('../composables/cloudbase-bridge.ts', import.meta.url))).toBe(false)
    expect(auth).not.toContain('useCloudBaseSessionBridge')
    expect(callback).not.toContain('setSession')
    expect(callback).not.toContain('refresh_token')
  })
})
