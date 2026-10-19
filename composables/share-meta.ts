import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import { appName } from '~/constants'

/**
 * Title, description and canonical URL for a page's link preview. The card
 * image and site-wide tags come from `app.head` in nuxt.config.ts.
 */
export function useShareMeta(meta: MaybeRefOrGetter<{ title: string, description: string }>) {
  const route = useRoute()
  const origin = String(useRuntimeConfig().public.siteOrigin).replace(/\/+$/, '')
  const title = () => `${toValue(meta).title} · ${appName}`
  const description = () => toValue(meta).description

  useSeoMeta({
    description,
    ogTitle: title,
    ogDescription: description,
    ogUrl: () => `${origin}${route.path}`,
    twitterTitle: title,
    twitterDescription: description,
  })
}
