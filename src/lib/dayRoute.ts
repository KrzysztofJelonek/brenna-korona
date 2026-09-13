import type { Peak } from '../types'
import type { StartPoint } from '../data/startPoints'
import { profileOf } from './elevation'
import { route, type LatLon, type RouteLeg } from './trailRouter'
import { haversine, walkingTime, TERRAIN_FACTOR, ROUGHNESS_M_PER_KM } from './geo'

/**
 * Trasa całego dnia policzona po realnej sieci ścieżek.
 *
 * Gdy któregoś odcinka nie da się poprowadzić po sieci (np. szczyt bez dojścia
 * w danych OSM), ten jeden odcinek spada na linię prostą z dawnym mnożnikiem,
 * a wynik jest oznaczony jako niepełny — zamiast udawać, że wszystko się udało.
 */

export interface DayRoute {
  /** Odcinki gotowe do narysowania; kolejne pary punkt→punkt. */
  legs: RouteLeg[]
  /** Cała trasa jako jedna polilinia. */
  points: [number, number][]
  distanceKm: number
  ascentM: number
  descentM: number
  timeH: number
  /** Ile odcinków trzeba było policzyć po linii prostej. */
  straightLegs: number
  routed: boolean
}

/**
 * Cache pojedynczych odcinków. Trasa „na dziś” przelicza się po każdym dotknięciu
 * szczytu, a dołożenie jednego szczytu zmienia zwykle jeden–dwa odcinki — reszta
 * nie musi drugi raz przechodzić przez Dijkstrę. Sieć jest nieskierowana, więc
 * odcinek B→A to odwrócony A→B (odwrócenie kierunku pętli nic nie liczy).
 */
const legCache = new Map<string, Promise<RouteLeg | null>>()
const pointKey = (p: LatLon) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`

function cachedLeg(from: LatLon, to: LatLon): Promise<RouteLeg | null> {
  const forward = `${pointKey(from)}>${pointKey(to)}`
  const hit = legCache.get(forward)
  if (hit) return hit
  const backward = legCache.get(`${pointKey(to)}>${pointKey(from)}`)
  const leg = backward
    ? backward.then((l) => l && { ...l, points: [...l.points].reverse() })
    : route(from, to)
  legCache.set(forward, leg)
  return leg
}

export async function computeDayRoute(
  peaks: Peak[],
  start: StartPoint | undefined,
  loop: boolean,
): Promise<DayRoute | null> {
  if (peaks.length === 0) return null

  const stops: LatLon[] = [
    ...(start ? [{ lat: start.lat, lon: start.lon }] : []),
    ...peaks.map((p) => ({ lat: p.lat, lon: p.lon })),
    ...(start && loop ? [{ lat: start.lat, lon: start.lon }] : []),
  ]
  if (stops.length < 2) return null

  const legs: RouteLeg[] = []
  let distance = 0
  let straightLegs = 0

  for (let i = 1; i < stops.length; i++) {
    const leg = await cachedLeg(stops[i - 1], stops[i])
    if (leg && leg.points.length > 1) {
      legs.push(leg)
      distance += leg.distance
    } else {
      const d = haversine(stops[i - 1].lat, stops[i - 1].lon, stops[i].lat, stops[i].lon) * TERRAIN_FACTOR
      legs.push({
        points: [
          [stops[i - 1].lat, stops[i - 1].lon],
          [stops[i].lat, stops[i].lon],
        ],
        distance: d,
      })
      distance += d
      straightLegs++
    }
  }

  const points = legs.flatMap((l, i) => (i === 0 ? l.points : l.points.slice(1)))
  const distanceKm = distance / 1000

  // Profil z siatki SRTM; odcinki po linii prostej dostają dawny dodatek,
  // bo dla nich nie znamy realnego przebiegu.
  const profile = await profileOf(points)
  const straightShare = legs.filter((_, i) => i < straightLegs).reduce((s, l) => s + l.distance, 0) / 1000
  const ascent = profile.ascent + straightShare * ROUGHNESS_M_PER_KM

  return {
    legs,
    points,
    distanceKm,
    ascentM: ascent,
    descentM: profile.descent,
    timeH: walkingTime(distanceKm, ascent),
    straightLegs,
    routed: straightLegs === 0,
  }
}
