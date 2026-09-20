/** Grafika 1080×1350 (4:5) do długiego posta — z src/card.html do promo/korona-apka-post.png. */
import { chromium } from 'playwright-core'
import { fileURLToPath } from 'node:url'

const PNG = fileURLToPath(new URL('../korona-apka-post.png', import.meta.url))
const JPG = fileURLToPath(new URL('../korona-apka-post.jpg', import.meta.url))
const PAGE = (process.env.PROMO_URL ?? 'http://127.0.0.1:4179') + '/src/card.html'

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 })
await page.goto(PAGE, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(800)
await page.screenshot({ path: PNG })
// JPG do wrzucenia na Facebooka (mniejszy), PNG jako wersja bez stratnej kompresji.
await page.screenshot({ path: JPG, type: 'jpeg', quality: 92 })
await browser.close()
console.log('ok', PNG, JPG)
