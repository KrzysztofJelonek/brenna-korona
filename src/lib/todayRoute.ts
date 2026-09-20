import { peakById } from '../data/peaks'
import { START_POINTS, startPointById, type StartPoint } from '../data/startPoints'
import type { CustomParking, ParkingRef, Peak, TodayPlan, Waypoint } from '../types'
import { estimateDay, type Stop } from './geo'
import { orderPeaks } from './planGenerator'

/**
 * Trasa „na dziś”: z wybranych na mapie szczytów i parkingu robi przystanki
 * gotowe dla routera.
 *
 * Użytkownik wybiera zbiór szczytów, nie kolejność — kolejność układamy sami,
 * po linii prostej, tak jak generator planów. Przebieg po szlakach liczy potem
 * computeDayRoute.
 */

/**
 * Przystanek dzisiejszej trasy: szczyt do zaliczenia albo punkt pośredni.
 * Router i szacunki biorą z niego współrzędne, panel — nazwę.
 */
export interface TodayStop extends Stop {
  name: string
  /** Szczyt, jeśli przystanek nim jest; punkt pośredni go nie ma. */
  peak?: Peak
  /** Punkt pośredni, jeśli to on. */
  via?: Waypoint
}

export interface ResolvedToday {
  /** Przystanki w kolejności przejścia — szczyty i punkty pośrednie. */
  stops: TodayStop[]
  /** Same szczyty, w kolejności przejścia. */
  peaks: Peak[]
  start?: StartPoint
  /** Miejsce zakończenia — ten sam punkt co start dla pętli. */
  finish?: StartPoint
  /** Faktyczny powrót na parking startowy. */
  loop: boolean
  /** Parking dobrany automatycznie, a nie wskazany przez użytkownika. */
  autoStart: boolean
  /** Czy da się iść w drugą stronę — dla dwóch parkingów zamienia je miejscami. */
  canReverse: boolean
}

/** Nazwa własnego miejsca do pokazania — bez wpisanej zostaje ogólna. */
export const customParkingName = (p: CustomParking) => p.name.trim() || 'Własne miejsce'

/** Nazwa punktu pośredniego do pokazania — bez wpisanej zostaje ogólna. */
export const waypointName = (w: Waypoint) => w.name.trim() || 'Punkt pośredni'

/** Id punktu pośredniego w trasie — ze współrzędnymi, bo przesunięcie markera to inna trasa w cache'u. */
export const waypointStopId = (w: Waypoint) => `via:${w.id}:${w.lat.toFixed(5)},${w.lon.toFixed(5)}`

/** Punkt pośredni jako przystanek trasy. */
export const waypointStop = (w: Waypoint): TodayStop => ({
  id: waypointStopId(w),
  name: waypointName(w),
  lat: w.lat,
  lon: w.lon,
  ele: w.ele,
  via: w,
})

const peakStop = (p: Peak): TodayStop => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon, ele: p.ele, peak: p })

export const customStartPoint = (p: CustomParking): StartPoint => ({
  // id ze współrzędnymi: przesunięcie markera to inna trasa w cache'u
  id: `custom:${p.id}:${p.lat.toFixed(5)},${p.lon.toFixed(5)}`,
  name: customParkingName(p),
  detail: 'Wskazane na mapie',
  lat: p.lat,
  lon: p.lon,
  ele: p.ele,
})

/**
 * Parking, od którego wybrane szczyty są najszybsze do przejścia — liczony
 * z pełnym ułożeniem kolejności, a nie ze średniej odległości, bo o wyborze
 * decyduje też droga do mety (przy pętli: powrót na ten sam parking).
 */
function bestStart(stops: Stop[], backToStart: boolean, end?: StartPoint): StartPoint {
  let best = START_POINTS[0]
  let bestTime = Infinity
  for (const sp of START_POINTS) {
    const finish = backToStart ? sp : end
    const time = estimateDay(orderPeaks(stops, sp, finish), { start: sp, finish }).timeH
    if (time < bestTime) {
      best = sp
      bestTime = time
    }
  }
  return best
}

/** Parking wskazany wprost — z listy gminy albo z własnych miejsc. */
function explicitPoint(ref: ParkingRef, customParkings: CustomParking[]): StartPoint | undefined {
  if (ref.kind === 'point') return startPointById(ref.id)
  const spot = customParkings.find((p) => p.id === ref.id)
  return spot && customStartPoint(spot)
}

const isExplicit = (ref: TodayPlan['parking'] | TodayPlan['finish']): ref is ParkingRef =>
  ref.kind === 'point' || ref.kind === 'custom'

export function resolveToday(plan: TodayPlan, customParkings: CustomParking[]): ResolvedToday {
  // Punkty pośrednie układamy razem ze szczytami — trasa ma przez nie przejść,
  // a gdzie wypadną w kolejności, wynika z ich położenia.
  const picked: TodayStop[] = [
    ...plan.peakIds.map(peakById).filter((p): p is Peak => Boolean(p)).map(peakStop),
    ...plan.waypoints.map(waypointStop),
  ]
  const autoStart = plan.parking.kind === 'auto'
  const backToStart = plan.finish.kind === 'start'

  const end = isExplicit(plan.finish) ? explicitPoint(plan.finish, customParkings) : undefined
  let start = autoStart
    ? picked.length > 0
      ? bestStart(picked, backToStart, end)
      : undefined
    : isExplicit(plan.parking)
      ? explicitPoint(plan.parking, customParkings)
      : undefined
  let finish = backToStart ? start : end

  // Dwa różne końce to trasa między autami: „w drugą stronę” znaczy tu zamienić
  // je miejscami, a nie odwrócić listę — kolejność i tak układamy od nowa.
  const twoEnds = Boolean(start && finish && finish.id !== start.id)
  if (twoEnds && plan.reversed) [start, finish] = [finish, start]

  let stops = orderPeaks(picked, start, finish)

  const loop = Boolean(start) && finish?.id === start?.id
  // Trasa zaczepiona tylko na jednym końcu ma narzucony kierunek; pętlę i trasę
  // bez parkingów odwracamy samą kolejnością szczytów.
  const oneSided = Boolean(start) !== Boolean(finish)
  const canReverse = twoEnds || (stops.length > 1 && !oneSided)
  if (canReverse && !twoEnds && plan.reversed) stops = [...stops].reverse()

  const peaks = stops.map((s) => s.peak).filter((p): p is Peak => Boolean(p))
  return { stops, peaks, start, finish, loop, autoStart, canReverse }
}
