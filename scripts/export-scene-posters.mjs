// Export a poster of the 3D home for every template, for the first paint and
// for browsers without WebGL2. Run against a dev or preview server:
//
//   pnpm dev
//   pnpm scene:posters [--url http://localhost:3000] [--chrome /path/to/chrome]
//
// Needs a Chromium for playwright-core (`pnpm exec playwright-core install
// chromium`, or pass --chrome) and `cwebp` (`brew install webp`).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'

const { values } = parseArgs({ options: { url: { type: 'string', default: 'http://localhost:3000/' }, chrome: { type: 'string' } } })
const TEMPLATES = ['cloud-apartment', 'studio', 'comfort-suite']
// Night stands in for dark mode and late hours; day covers the rest.
const VARIANTS = { day: 'light', night: 'dark' }
const WIDTHS = [1600, 800]
const OUT = new URL('../public/scene/', import.meta.url).pathname
// Everything but the diorama itself goes, so the poster sits on the page's own sky.
const CAPTURE_CSS = `
  html, body, #__nuxt, .home-experience, .home-stage, .home-scene-stack, .home-scene3d { background: transparent !important; }
  .home-scene3d { border-color: transparent !important; box-shadow: none !important; }
  .home-ambient, .home-scene3d > :not(canvas), .home-poster, .room-tabs, nuxt-devtools-frame { visibility: hidden !important; }
`

const browser = await chromium.launch({
  executablePath: values.chrome,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const scratch = mkdtempSync(join(tmpdir(), 'scene-posters-'))
try {
  for (const templateId of TEMPLATES) {
    for (const [variant, colorScheme] of Object.entries(VARIANTS)) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2, colorScheme, reducedMotion: 'reduce' })
      await context.clock.setFixedTime(new Date(2026, 0, 1, 10, 10))
      await context.addInitScript(([templateId, colorScheme]) => {
        localStorage.setItem('yun-home:layout:v1', JSON.stringify({ version: 1, templateId, placements: [], revision: 0, changedAt: '2026-01-01T00:00:00.000Z' }))
        localStorage.setItem('yun-home:scene-mode', '3d')
        localStorage.setItem('nuxt-color-mode', colorScheme)
      }, [templateId, colorScheme])
      const page = await context.newPage()
      await page.goto(values.url)
      await page.waitForSelector('.home-scene3d.is-ready', { timeout: 60_000 })
      await page.addStyleTag({ content: CAPTURE_CSS })
      await page.waitForTimeout(1500)
      const png = join(scratch, `${templateId}-${variant}.png`)
      writeFileSync(png, await page.locator('.home-scene3d__canvas').screenshot({ omitBackground: true }))
      for (const width of WIDTHS) {
        const file = join(OUT, `${templateId}-${variant}-${width}.webp`)
        execFileSync('cwebp', ['-quiet', '-q', '80', '-alpha_q', '90', '-resize', String(width), String(width / 2), png, '-o', file])
        console.log(file)
      }
      await context.close()
    }
  }
}
finally {
  await browser.close()
  rmSync(scratch, { recursive: true, force: true })
}
