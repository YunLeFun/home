import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function findListsInsideParagraphs(template: string) {
  let paragraphDepth = 0
  const invalidTags: string[] = []

  for (const match of template.matchAll(/<\/?(?:p|ul)\b[^>]*>/gi)) {
    const tag = match[0]

    if (/^<p\b/i.test(tag) && !/\/>$/.test(tag))
      paragraphDepth++
    else if (/^<\/p\b/i.test(tag))
      paragraphDepth = Math.max(0, paragraphDepth - 1)
    else if (/^<ul\b/i.test(tag) && paragraphDepth > 0)
      invalidTags.push(tag)
  }

  return invalidTags
}

describe('HTML nesting', () => {
  it('keeps the alternate-name list outside paragraph elements', () => {
    const pagePath = fileURLToPath(new URL('../pages/hi/[id].vue', import.meta.url))
    const source = readFileSync(pagePath, 'utf8')
    const template = source.match(/<template>([\s\S]*?)<\/template>/)?.[1]

    expect(template).toBeDefined()
    expect(findListsInsideParagraphs(template!)).toEqual([])
  })
})
