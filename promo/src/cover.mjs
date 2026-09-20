/** Okładka rolki (1080×1920) do wgrania w TikToku/Reels — z src/cover.html. */
import { chromium } from 'playwright-core'
import { fileURLToPath } from 'node:url'

const JPG = fileURLToPath(new URL('../korona-apka-cover.jpg', import.meta.url))
const PAGE = (process.env.PROMO_URL ?? 'http://127.0.0.1:4179') + '/src/cover.html'

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
await page.goto(PAGE, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(800)
await page.screenshot({ path: JPG, type: 'jpeg', quality: 92 })
await browser.close()
console.log('ok', JPG)
