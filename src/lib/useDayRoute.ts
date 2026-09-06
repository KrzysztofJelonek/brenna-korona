import { useEffect, useState } from 'react'
import type { Peak } from '../types'
import type { StartPoint } from '../data/startPoints'
import { computeDayRoute, type DayRoute } from './dayRoute'

/**
 * Liczy trasę dnia poza ścieżką renderowania.
 *
 * Dijkstra po sieci ~76 tys. węzłów trwa dziesiątki milisekund na odcinek, więc
 * liczenie w trakcie renderu zacinałoby interfejs. Wynik trafia do cache'u
 * modułowego — ten sam dzień liczymy tylko raz na sesję.
 */

const cache = new Map<string, DayRoute | null>()

const keyOf = (peaks: Peak[], start: StartPoint | undefined, loop: boolean) =>
  `${start?.id ?? '-'}|${loop ? 'L' : 'P'}|${peaks.map((p) => p.id).join(',')}`

export function useDayRoute(
  peaks: Peak[],
  start: StartPoint | undefined,
  loop: boolean,
): { route: DayRoute | null; loading: boolean } {
  const key = keyOf(peaks, start, loop)
  const [, force] = useState(0)
  const cached = cache.get(key)
  const known = cache.has(key)

  useEffect(() => {
    if (cache.has(key) || peaks.length === 0) return
    let alive = true
    const id = setTimeout(() => {
      computeDayRoute(peaks, start, loop).then((result) => {
        cache.set(key, result)
        if (alive) force((n) => n + 1)
      })
    }, 0)
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [key, peaks, start, loop])

  return { route: known ? (cached ?? null) : null, loading: !known && peaks.length > 0 }
}

export const clearRouteCache = () => cache.clear()

export interface DayInput {
  id: string
  peaks: Peak[]
  start: StartPoint | undefined
  loop: boolean
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
  const keys = days.map((d) => `${d.id}::${keyOf(d.peaks, d.start, d.loop)}`).join('|')
  const [, force] = useState(0)

  const routes = new Map<string, DayRoute | null>()
  let pending = 0
  for (const d of days) {
    const k = keyOf(d.peaks, d.start, d.loop)
    if (cache.has(k)) routes.set(d.id, cache.get(k) ?? null)
    else if (d.peaks.length > 0) pending++
  }

  useEffect(() => {
    let alive = true
    const todo = days.filter((d) => d.peaks.length > 0 && !cache.has(keyOf(d.peaks, d.start, d.loop)))
    if (todo.length === 0) return

    const run = async () => {
      for (const d of todo) {
        if (!alive) return
        const k = keyOf(d.peaks, d.start, d.loop)
        if (cache.has(k)) continue
        cache.set(k, await computeDayRoute(d.peaks, d.start, d.loop))
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
