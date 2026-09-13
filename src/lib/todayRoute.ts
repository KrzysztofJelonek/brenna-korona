import { peakById } from '../data/peaks'
import { START_POINTS, startPointById, type StartPoint } from '../data/startPoints'
import type { CustomParking, Peak, TodayParking, TodayPlan } from '../types'
import { estimateDay } from './geo'
import { orderPeaks } from './planGenerator'

/**
 * Trasa „na dziś”: z wybranych na mapie szczytów i parkingu robi przystanki
 * gotowe dla routera.
 *
 * Użytkownik wybiera zbiór szczytów, nie kolejność — kolejność układamy sami,
 * po linii prostej, tak jak generator planów. Przebieg po szlakach liczy potem
 * computeDayRoute.
 */

export interface ResolvedToday {
  /** Szczyty w kolejności przejścia. */
  peaks: Peak[]
  start?: StartPoint
  /** Faktyczny powrót na parking — bez parkingu zawsze false. */
  loop: boolean
  /** Parking dobrany automatycznie, a nie wskazany przez użytkownika. */
  autoStart: boolean
  /** Czy kierunek da się odwrócić bez zmiany miejsca startu. */
  canReverse: boolean
}

/** Nazwa własnego miejsca do pokazania — bez wpisanej zostaje ogólna. */
export const customParkingName = (p: CustomParking) => p.name.trim() || 'Własne miejsce'

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
 * z pełnym ułożeniem kolejności, a nie ze średniej odległości, bo przy pętli
 * liczy się też powrót.
 */
function bestStart(peaks: Peak[], loop: boolean): { start: StartPoint; peaks: Peak[] } {
  let best = { start: START_POINTS[0], peaks, time: Infinity }
  for (const sp of START_POINTS) {
    const ordered = orderPeaks(peaks, sp, loop)
    const time = estimateDay(ordered, { start: sp, loop }).timeH
    if (time < best.time) best = { start: sp, peaks: ordered, time }
  }
  return best
}

function explicitStart(parking: TodayParking, customParkings: CustomParking[]): StartPoint | undefined {
  if (parking.kind === 'point') return startPointById(parking.id)
  if (parking.kind === 'custom') {
    const spot = customParkings.find((p) => p.id === parking.id)
    return spot && customStartPoint(spot)
  }
  return undefined
}

export function resolveToday(plan: TodayPlan, customParkings: CustomParking[]): ResolvedToday {
  const picked = plan.peakIds.map(peakById).filter((p): p is Peak => Boolean(p))
  const autoStart = plan.parking.kind === 'auto'

  let start: StartPoint | undefined
  let peaks: Peak[]
  if (autoStart) {
    if (picked.length > 0) ({ start, peaks } = bestStart(picked, plan.loop))
    else peaks = []
  } else {
    start = explicitStart(plan.parking, customParkings)
    peaks = orderPeaks(picked, start, plan.loop)
  }

  const loop = Boolean(start) && plan.loop
  // Bez powrotu start jest przywiązany do parkingu — odwrócić można tylko pętlę
  // albo trasę, która w ogóle nie zaczyna się na parkingu.
  const canReverse = peaks.length > 1 && (!start || loop)
  if (canReverse && plan.reversed) peaks = [...peaks].reverse()

  return { peaks, start, loop, autoStart, canReverse }
}
