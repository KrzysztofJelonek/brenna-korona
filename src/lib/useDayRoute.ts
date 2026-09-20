import { useEffect, useState } from 'react'
import type { StartPoint } from '../data/startPoints'
import type { Stop } from './geo'
import { computeDayRoute, type DayRoute } from './dayRoute'

/**
 * Liczy trasę dnia poza ścieżką renderowania.
 *
 * Dijkstra po sieci ~76 tys. węzłów trwa dziesiątki milisekund na odcinek, więc
 * liczenie w trakcie renderu zacinałoby interfejs. Wynik trafia do cache'u
 * modułowego — ten sam dzień liczymy tylko raz na sesję.
 */

const cache = new Map<string, DayRoute | null>()

/** Trwające liczenia — pasek i linia na mapie proszą o tę samą trasę naraz. */
const inflight = new Map<string, Promise<DayRoute | null>>()

const keyOf = (peaks: Stop[], start: StartPoint | undefined, finish: StartPoint | undefined) =>
  `${start?.id ?? '-'}|${finish?.id ?? '-'}|${peaks.map((p) => p.id).join(',')}`

function computeOnce(key: string, peaks: Stop[], start: StartPoint | undefined, finish: StartPoint | undefined) {
  let job = inflight.get(key)
  if (!job) {
    job = computeDayRoute(peaks, start, finish).then((result) => {
      cache.set(key, result)
      inflight.delete(key)
      return result
    })
    inflight.set(key, job)
  }
  return job
}

export function useDayRoute(
  peaks: Stop[],
  start: StartPoint | undefined,
  finish: StartPoint | undefined,
): { route: DayRoute | null; loading: boolean } {
  const key = keyOf(peaks, start, finish)
  const [, force] = useState(0)
  const cached = cache.get(key)
  const known = cache.has(key)

  useEffect(() => {
    if (cache.has(key) || peaks.length === 0) return
    let alive = true
    const id = setTimeout(() => {
      computeOnce(key, peaks, start, finish).then(() => {
        if (alive) force((n) => n + 1)
      })
    }, 0)
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [key, peaks, start, finish])

  return { route: known ? (cached ?? null) : null, loading: !known && peaks.length > 0 }
}

export const clearRouteCache = () => cache.clear()

export interface DayInput {
  id: string
  peaks: Stop[]
  start: StartPoint | undefined
  /** Miejsce zakończenia; dla pętli ten sam punkt co start. */
  finish: StartPoint | undefined
}

/**
 * Trasy dla wielu dni naraz, liczone po kolei.
 *
 * Osobny hook zamiast wywoływania useDayRoute w pętli: dni jest zmienna liczba,
 * a policzenie ich równolegle zablokowałoby wątek na dobrą sekundę.
 */
export function useDayRoutes(days: DayInput[]): {
  routes: Map<string, DayRoute | null>
  pending: number
} {
  const keys = days.map((d) => `${d.id}::${keyOf(d.peaks, d.start, d.finish)}`).join('|')
  const [, force] = useState(0)

  const routes = new Map<string, DayRoute | null>()
  let pending = 0
  for (const d of days) {
    const k = keyOf(d.peaks, d.start, d.finish)
    if (cache.has(k)) routes.set(d.id, cache.get(k) ?? null)
    else if (d.peaks.length > 0) pending++
  }

  useEffect(() => {
    let alive = true
    const todo = days.filter((d) => d.peaks.length > 0 && !cache.has(keyOf(d.peaks, d.start, d.finish)))
    if (todo.length === 0) return

    const run = async () => {
      for (const d of todo) {
        if (!alive) return
        const k = keyOf(d.peaks, d.start, d.finish)
        if (cache.has(k)) continue
        await computeOnce(k, d.peaks, d.start, d.finish)
        if (alive) force((n) => n + 1)
      }
    }
    const id = setTimeout(run, 0)
    return () => {
      alive = false
      clearTimeout(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys])

  return { routes, pending }
}
