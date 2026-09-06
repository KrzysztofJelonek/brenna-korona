import type { Peak } from '../types'

const R = 6371000

/** Odległość w metrach po wielkim kole. */
export function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Azymut A→B w stopniach (0 = północ). */
export function bearing(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const y = Math.sin(toRad(bLon - aLon)) * Math.cos(toRad(bLat))
  const x =
    Math.cos(toRad(aLat)) * Math.sin(toRad(bLat)) -
    Math.sin(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.cos(toRad(bLon - aLon))
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360
}

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
export const compassLabel = (deg: number) => DIRS[Math.round(deg / 45) % 8]

/**
 * Współczynnik krętości szlaku — odległość w linii prostej jest zawsze mniejsza
 * niż realna długość szlaku.
 */
export const TERRAIN_FACTOR = 1.65

/**
 * Dodatkowe podejście na każdy kilometr trasy. Sama różnica wysokości między
 * kolejnymi szczytami gubi wszystkie podejścia pośrednie na grani.
 *
 * Oba parametry są dopasowane wspólnie do sześciodniowej propozycji gminy —
 * jedynych danych, gdzie znamy prawdziwe dystanse i czasy. Po dopasowaniu suma
 * dystansu zgadza się z gminą w granicach 1%, a błąd pojedynczego dnia mieści
 * się w ±30%: najgorzej wypada dzień, w którym gmina świadomie prowadzi dłuższą
 * drogą powrotną, czego model po liniach prostych nie odtworzy.
 *
 * To szacunek do planowania, nie pomiar. Realny przebieg sprawdzaj na mapie.
 */
export const ROUGHNESS_M_PER_KM = 32

export interface DayStats {
  distanceKm: number
  ascentM: number
  descentM: number
  timeH: number
  /** Czy liczyliśmy z realnym punktem startowym, czy z przybliżenia. */
  fromStartPoint: boolean
}

export interface DayShape {
  /** Punkt startowy dnia — jeśli jest, dojście i powrót są policzone naprawdę. */
  start?: { lat: number; lon: number; ele: number }
  /** Powrót na miejsce startu (pętla albo droga tam i z powrotem). */
  loop?: boolean
}

/**
 * Szacunek dystansu, przewyższenia i czasu dnia.
 *
 * Z punktem startowym liczymy realny kształt wycieczki: parking → szczyty →
 * (dla pętli) parking. Bez niego zostaje przybliżenie — dojście z doliny
 * i zejście do niej — bo inaczej dzień z jednym szczytem wyszedłby zerowy.
 *
 * Czas: reguła Naismitha (5 km/h w poziomie + 1 h na 600 m podejścia).
 */
export function estimateDay(peaks: Peak[], shape: DayShape = {}): DayStats {
  if (peaks.length === 0) {
    return { distanceKm: 0, ascentM: 0, descentM: 0, timeH: 0, fromStartPoint: false }
  }

  const nodes: { lat: number; lon: number; ele: number }[] = []
  const { start, loop = true } = shape

  if (start) nodes.push(start)
  for (const p of peaks) nodes.push({ lat: p.lat, lon: p.lon, ele: p.ele })
  if (start && loop) nodes.push(start)

  let flat = 0
  let ascent = 0
  let descent = 0
  for (let i = 1; i < nodes.length; i++) {
    flat += haversine(nodes[i - 1].lat, nodes[i - 1].lon, nodes[i].lat, nodes[i].lon) * TERRAIN_FACTOR
    const d = nodes[i].ele - nodes[i - 1].ele
    if (d > 0) ascent += d
    else descent += -d
  }

  if (!start) {
    // Bez parkingu doklejamy typowe dojście z doliny i zejście do niej.
    const valley = 450
    ascent += Math.max(0, peaks[0].ele - valley)
    descent += Math.max(0, peaks[peaks.length - 1].ele - valley)
    flat += 2 * 2500
  }

  const distanceKm = flat / 1000
  const totalAscent = ascent + distanceKm * ROUGHNESS_M_PER_KM
  return {
    distanceKm,
    ascentM: totalAscent,
    descentM: descent + distanceKm * ROUGHNESS_M_PER_KM,
    timeH: distanceKm / 5 + totalAscent / 600,
    fromStartPoint: Boolean(start),
  }
}

export function formatTime(h: number): string {
  const total = Math.round(h * 60)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} h`
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
}

/**
 * Polska odmiana przez liczbę: 1 etap, 2 etapy, 5 etapów.
 * Formy: [pojedyncza, mnoga 2-4, mnoga 5+/dopełniacz].
 */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n)
  if (abs === 1) return forms[0]
  const last = abs % 10
  const lastTwo = abs % 100
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return forms[1]
  return forms[2]
}
