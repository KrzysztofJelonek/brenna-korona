import { PEAKS } from '../data/peaks'
import { START_POINTS, type StartPoint } from '../data/startPoints'
import type { DayPlan, Peak } from '../types'
import { estimateDay, haversine } from './geo'

/**
 * Generator alternatywnych wariantów trasy.
 *
 * Propozycje gminy dzielą szczyty tak, jak wygodnie było je opisać. Tu liczy się
 * co innego: prawie każdy zostawia samochód na parkingu i musi po niego wrócić,
 * więc dzień jest pętlą. Generator grupuje szczyty geograficznie, dobiera do
 * każdej grupy najbliższy parking z listy gminy i układa kolejność tak, żeby
 * pętla była możliwie krótka.
 *
 * To heurystyka po linii prostej, nie planowanie po szlakach — realny przebieg
 * zawsze weryfikuj na mapie.
 */

const dist = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  haversine(a.lat, a.lon, b.lat, b.lon)

/** k-means po współrzędnych, deterministyczny: centroidy startowe rozłożone po długości geograficznej. */
function cluster(peaks: Peak[], k: number): Peak[][] {
  if (k <= 1) return [peaks]
  if (k >= peaks.length) return peaks.map((p) => [p])

  const sorted = [...peaks].sort((a, b) => a.lon - b.lon || a.lat - b.lat)
  let centroids = Array.from({ length: k }, (_, i) => {
    const p = sorted[Math.floor(((i + 0.5) * sorted.length) / k)]
    return { lat: p.lat, lon: p.lon }
  })

  let groups: Peak[][] = []
  for (let iter = 0; iter < 40; iter++) {
    groups = Array.from({ length: k }, () => [] as Peak[])
    for (const p of peaks) {
      let best = 0
      let bestD = Infinity
      centroids.forEach((c, i) => {
        const d = dist(p, c)
        if (d < bestD) {
          bestD = d
          best = i
        }
      })
      groups[best].push(p)
    }
    const next = groups.map((g, i) =>
      g.length
        ? { lat: g.reduce((s, p) => s + p.lat, 0) / g.length, lon: g.reduce((s, p) => s + p.lon, 0) / g.length }
        : centroids[i],
    )
    const moved = next.some((c, i) => dist(c, centroids[i]) > 5)
    centroids = next
    if (!moved) break
  }

  return groups.filter((g) => g.length > 0)
}

/** Parking, z którego cała grupa jest najbliżej. */
function pickStart(group: Peak[]): StartPoint {
  let best = START_POINTS[0]
  let bestScore = Infinity
  for (const sp of START_POINTS) {
    const score = group.reduce((s, p) => s + dist(sp, p), 0) / group.length
    if (score < bestScore) {
      bestScore = score
      best = sp
    }
  }
  return best
}

/** Najbliższy sąsiad od parkingu, potem 2-opt na zamkniętej pętli. */
function order(group: Peak[], start: StartPoint): Peak[] {
  const left = [...group]
  const route: Peak[] = []
  let cur: { lat: number; lon: number } = start
  while (left.length) {
    let bi = 0
    let bd = Infinity
    left.forEach((p, i) => {
      const d = dist(cur, p)
      if (d < bd) {
        bd = d
        bi = i
      }
    })
    cur = left[bi]
    route.push(left.splice(bi, 1)[0])
  }

  const loopLength = (r: Peak[]) => {
    let total = dist(start, r[0])
    for (let i = 1; i < r.length; i++) total += dist(r[i - 1], r[i])
    return total + dist(r[r.length - 1], start)
  }

  let improved = true
  let guard = 0
  while (improved && guard++ < 60) {
    improved = false
    for (let i = 0; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        const candidate = [...route.slice(0, i), ...route.slice(i, j + 1).reverse(), ...route.slice(j + 1)]
        if (loopLength(candidate) < loopLength(route) - 1) {
          route.splice(0, route.length, ...candidate)
          improved = true
        }
      }
    }
  }
  return route
}

const timeOf = (group: Peak[]) => {
  const sp = pickStart(group)
  return estimateDay(order(group, sp), { start: sp, loop: true }).timeH
}

/** Przesuwa pojedyncze szczyty z najcięższego dnia do lżejszego, jeśli to skraca najdłuższy dzień. */
function balance(groups: Peak[][]): Peak[][] {
  const work = groups.map((g) => [...g])
  for (let round = 0; round < 12; round++) {
    const times = work.map(timeOf)
    const hi = times.indexOf(Math.max(...times))
    const lo = times.indexOf(Math.min(...times))
    if (hi === lo || work[hi].length < 2) break

    let bestGain = 0
    let bestPeak = -1
    for (let i = 0; i < work[hi].length; i++) {
      const peak = work[hi][i]
      const from = work[hi].filter((_, x) => x !== i)
      const to = [...work[lo], peak]
      const after = Math.max(timeOf(from), timeOf(to))
      const gain = Math.max(times[hi], times[lo]) - after
      if (gain > bestGain) {
        bestGain = gain
        bestPeak = i
      }
    }
    if (bestPeak < 0) break
    work[lo].push(...work[hi].splice(bestPeak, 1))
  }
  return work
}

export interface GeneratedDay extends DayPlan {
  startPointId: string
  loop: true
}

export interface GeneratedPlan {
  days: GeneratedDay[]
  totalKm: number
  totalAscentM: number
  totalTimeH: number
  longestDayH: number
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

export function generatePlan(dayCount: number): GeneratedPlan {
  const k = Math.max(1, Math.min(dayCount, PEAKS.length))
  const groups = balance(cluster([...PEAKS], k))

  // dni od północy na południe, żeby kolejność była przewidywalna
  groups.sort((a, b) => {
    const la = a.reduce((s, p) => s + p.lat, 0) / a.length
    const lb = b.reduce((s, p) => s + p.lat, 0) / b.length
    return lb - la
  })

  let totalKm = 0
  let totalAscentM = 0
  let totalTimeH = 0
  let longestDayH = 0

  const days = groups.map((group, i): GeneratedDay => {
    const start = pickStart(group)
    const peaks = order(group, start)
    const stats = estimateDay(peaks, { start, loop: true })
    totalKm += stats.distanceKm
    totalAscentM += stats.ascentM
    totalTimeH += stats.timeH
    longestDayH = Math.max(longestDayH, stats.timeH)
    return {
      id: `gen-${i}`,
      name: `Dzień ${ROMAN[i] ?? i + 1}`,
      startPointId: start.id,
      startPoint: start.name,
      loop: true,
      peakIds: peaks.map((p) => p.id),
    }
  })

  return { days, totalKm, totalAscentM, totalTimeH, longestDayH }
}
