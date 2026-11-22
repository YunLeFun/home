// Render the 1200 × 630 link-preview card (og:image / twitter:image) from the
// my-home day poster and the brand mark:
//
//   node scripts/export-og-image.mjs [--chrome /path/to/chrome]
//
// Needs a Chromium for playwright-core (`pnpm exec playwright-core install
// chromium`, or pass --chrome). Re-run after `pnpm scene:posters`.
import { readFileSync, statSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'

const { values } = parseArgs({ options: { chrome: { type: 'string' } } })
const PUBLIC = new URL('../public/', import.meta.url)
const OUT = new URL('og-image.jpg', PUBLIC).pathname
const dataUrl = (file, type) => `data:${type};base64,${readFileSync(new URL(file, PUBLIC)).toString('base64')}`

const html = `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; font-family: "PingFang SC", "Noto Sans SC", system-ui, sans-serif; color: #0f172a; background: linear-gradient(155deg, #dbeafe 0%, #eef5ff 42%, #fbf4e6 100%); }
  /* The diorama sits right of the copy; the poster's own sky fades into the card's. */
  .poster { position: absolute; top: 36px; left: 296px; height: 560px; mask-image: radial-gradient(ellipse 50% 58% at 51% 50%, #000 80%, transparent 100%); }
  .copy { position: absolute; top: 0; bottom: 0; left: 72px; display: flex; flex-direction: column; justify-content: center; gap: 22px; width: 440px; }
  .mark { width: 76px; height: 76px; }
  h1 { font-size: 96px; font-weight: 800; line-height: 1; letter-spacing: 0.04em; }
  .tagline { color: #2563eb; font-size: 40px; font-weight: 700; letter-spacing: 0.08em; }
  .devices { color: #475569; font-size: 18px; font-weight: 500; white-space: nowrap; }
  .site { position: absolute; bottom: 44px; left: 72px; padding: 8px 16px; border: 1px solid #d3e3fb; border-radius: 999px; background: rgba(255, 255, 255, 0.8); color: #2563eb; font-size: 19px; font-weight: 600; letter-spacing: 0.02em; }
</style>
<img class="poster" src="${dataUrl('scene/my-home-day-1600.webp', 'image/webp')}" alt="">
<div class="copy">
  <img class="mark" src="${dataUrl('brand-mark.svg', 'image/svg+xml')}" alt="">
  <h1>云之彼端</h1>
  <p class="tagline">家电上云，冷暖自知</p>
  <p class="devices">空调 · 风扇 · 电视 · 扫地机器人 · 暖手宝 · 小夜灯</p>
</div>
<span class="site">home.yunle.fun</span>
</html>`

const browser = await chromium.launch({ executablePath: values.chrome })
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  await page.setContent(html, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: OUT, type: 'jpeg', quality: 88 })
  console.log(OUT, `${Math.round(statSync(OUT).size / 1024)} KB`)
}
finally {
  await browser.close()
}
