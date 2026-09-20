/**
 * Zrzuty ekranu aplikacji do materiałów promocyjnych (promo/screens/).
 *
 * Wymaga zbudowanej aplikacji wystawionej lokalnie:
 *   npm run build && (cd dist && python3 -m http.server 4178 --bind 127.0.0.1)
 *
 * Stan (zaliczone szczyty, trasa na dziś) wstrzykujemy do localStorage przed startem
 * aplikacji — zrzuty mają pokazywać realną sytuację, a nie pustą apkę po instalacji.
 */
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../screens', import.meta.url))
const APP = process.env.APP_URL ?? 'http://127.0.0.1:4178/index.html'
mkdirSync(OUT, { recursive: true })

const done = (iso, mode = 'foot') => ({ status: 'done', conqueredAt: iso, ascentMode: mode, photoIds: [] })
const Y = '2026-09-19T11:00:00.000Z'
const E = '2026-09-13T10:00:00.000Z'
const progress = {
  zebrzydka: done(Y), czupel: done(Y), 'maly-cisowy': done(Y), 'wielka-cisowa': done(Y),
  blatnia: done(Y), stolow: done(Y), 'trzy-kopce': done(Y),
  'stary-gron': done(E), orlowa: done(E), jaworzyna: done(E),
  beskidek: { status: 'planned', photoIds: [] }, hyrca: { status: 'planned', photoIds: [] },
  kotarz: { status: 'planned', photoIds: [] },
}

// backupReminderAt „teraz” — inaczej przy 10 szczytach pasek przypomnienia zasłania nagłówek.
const seed = (today) => ({
  state: { progress, plans: [], activePresetId: null, backupReminderAt: Date.now(), today, customParkings: [] },
  version: 3,
})

/** Wczorajszy dzień: auto zostaje w Górkach, odbiór w Bukowej — trasa z metą gdzie indziej. */
const TODAY_A = {
  peakIds: ['zebrzydka', 'czupel', 'maly-cisowy', 'wielka-cisowa', 'blatnia', 'stolow', 'trzy-kopce'],
  parking: { kind: 'point', id: 'gorki-kosciol' },
  finish: { kind: 'point', id: 'brenna-bukowa' },
  waypoints: [], reversed: false,
}
/** Pętla z Bukowej z powrotem przez Halę Jaworową — pokazuje punkt pośredni. */
const TODAY_B = {
  peakIds: ['beskidek', 'hyrca', 'kotarz'],
  parking: { kind: 'point', id: 'brenna-bukowa' },
  finish: { kind: 'start' },
  waypoints: [{ id: 'via-hala', name: 'Hala Jaworowa', lat: 49.6975, lon: 18.953, ele: 700 }],
  reversed: false,
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })

async function ctx(today) {
  const c = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    locale: 'pl-PL', timezoneId: 'Europe/Warsaw', colorScheme: 'light',
    permissions: ['geolocation'], geolocation: { latitude: 49.7005, longitude: 18.9705, accuracy: 12 },
  })
  await c.addInitScript((s) => localStorage.setItem('kgb-progress', s), JSON.stringify(seed(today)))
  const p = await c.newPage()
  await p.goto(APP, { waitUntil: 'load' })
  await p.waitForTimeout(1200)
  return { c, p }
}

const shot = async (p, name) => { await p.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name) }
const tab = async (p, label) => { await p.getByRole('button', { name: label, exact: true }).click(); await p.waitForTimeout(900) }

{
  const { c, p } = await ctx(TODAY_A)
  await shot(p, '01-lista')
  await p.getByText('Błatnia', { exact: false }).first().click()
  await p.waitForTimeout(1500)
  await shot(p, '02-szczyt')
  await p.keyboard.press('Escape')
  await p.waitForTimeout(600)
  await tab(p, 'Mapa')
  await p.getByRole('button', { name: 'Na dziś' }).first().click()
  await p.waitForTimeout(4000)   // kafelki OSM
  await shot(p, '03-mapa-start-meta')
  await c.close()
}
{
  const { c, p } = await ctx(TODAY_B)
  await tab(p, 'Mapa')
  await p.getByRole('button', { name: 'Na dziś' }).first().click()
  await p.waitForTimeout(4000)
  await shot(p, '04-mapa-waypoint')
  await tab(p, 'Plan')
  await p.evaluate(() => window.scrollTo({ top: 700 }))
  await p.waitForTimeout(700)
  await shot(p, '05-plan')
  await tab(p, 'Teren')
  await p.getByRole('button', { name: /Wył\.|Szukam|Wł\./ }).first().click()
  await p.waitForTimeout(3000)
  await shot(p, '06-teren')
  await p.getByRole('button', { name: /kod QR|Udostępnij aplikację/i }).first().click()
  await p.waitForTimeout(1500)
  await shot(p, '08-qr')
  await c.close()
}
await browser.close()
