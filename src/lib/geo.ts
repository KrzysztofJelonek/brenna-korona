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
 * Współczynnik krętości szlaku. Odległość w linii prostej między szczytami
 * jest zawsze mniejsza niż realna długość szlaku — 1.35 to przybliżenie
 * skalibrowane na wariancie 6-dniowym z PDF gminy.
 */
export const TERRAIN_FACTOR = 1.35

export interface DayStats {
  distanceKm: number
  ascentM: number
  descentM: number
  timeH: number
  estimated: boolean
}

/**
 * Szacunek dystansu, przewyższenia i czasu dla ciągu szczytów.
 * Czas: reguła Naismitha (5 km/h w poziomie + 1 h na 600 m podejścia).
 */
export function estimateDay(peaks: Peak[]): DayStats {
  if (peaks.length === 0) {
    return { distanceKm: 0, ascentM: 0, descentM: 0, timeH: 0, estimated: true }
  }
  let flat = 0
  let ascent = 0
  let descent = 0
  for (let i = 1; i < peaks.length; i++) {
    const a = peaks[i - 1]
    const b = peaks[i]
    flat += haversine(a.lat, a.lon, b.lat, b.lon) * TERRAIN_FACTOR
    const d = b.ele - a.ele
    if (d > 0) ascent += d
    else descent += -d
  }
  // dojście od doliny do pierwszego szczytu i zejście z ostatniego
  const valley = 450
  ascent += Math.max(0, peaks[0].ele - valley)
  descent += Math.max(0, peaks[peaks.length - 1].ele - valley)
  flat += 2500 * 2

  const distanceKm = flat / 1000
  const timeH = distanceKm / 5 + ascent / 600
  return { distanceKm, ascentM: ascent, descentM: descent, timeH, estimated: true }
}

export function formatTime(h: number): string {
  const total = Math.round(h * 60)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} h`
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
}
