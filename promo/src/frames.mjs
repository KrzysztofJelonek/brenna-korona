/**
 * Klatki rolki (1080×1920) z src/render.html. Sklejka w ffmpeg — patrz promo/README.md.
 * `node frames.mjs preview` renderuje osiem klatek kontrolnych zamiast całości.
 */
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const preview = process.argv[2] === 'preview'
const OUT = fileURLToPath(new URL(preview ? '../build/preview' : '../build/frames', import.meta.url))
const PAGE = (process.env.PROMO_URL ?? 'http://127.0.0.1:4179') + '/src/render.html'
mkdirSync(OUT, { recursive: true })

const FPS = 30, D = 21.24   // długość ścieżki „Góry w Rytmie”

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
})
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
await page.goto(PAGE, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(1500)

if (preview) {
  for (const [i, t] of [0.9, 2.6, 5.6, 8.4, 11.2, 13.9, 16.6, 19.8].entries()) {
    await page.evaluate((t) => window.renderAt(t), t)
    await page.waitForTimeout(120)
    await page.screenshot({ path: `${OUT}/p${i}.png` })
  }
} else {
  const n = Math.round(D * FPS)
  for (let f = 0; f < n; f++) {
    await page.evaluate((t) => window.renderAt(t), f / FPS)
    await page.screenshot({ path: `${OUT}/f${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 94 })
    if (f % 60 === 0) console.log('frame', f, '/', n)
  }
  console.log('done', n)
}
await browser.close()
