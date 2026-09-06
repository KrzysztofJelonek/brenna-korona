/**
 * Wysokość terenu z siatki SRTM (~90 m) próbkowanej dwuliniowo.
 *
 * Dzięki temu przewyższenie liczy się z profilu całej trasy, a nie z różnicy
 * wysokości między szczytami — to ta druga metoda dawała absurdalnie niskie
 * sumy, bo gubiła podejścia pośrednie na grani.
 */

import { haversine } from './geo'

interface Grid {
  lat0: number
  lon0: number
  dLat: number
  dLon: number
  cols: number
  rows: number
  data: number[]
}

let gridPromise: Promise<Grid> | null = null

export function loadGrid(): Promise<Grid> {
  if (!gridPromise) {
    gridPromise = import('../data/elevation.json').then((m) => m.default as unknown as Grid)
  }
  return gridPromise
}

export function elevationAt(G: Grid, lat: number, lon: number): number {
  const x = (lon - G.lon0) / G.dLon
  const y = (lat - G.lat0) / G.dLat
  const x0 = Math.max(0, Math.min(G.cols - 1, Math.floor(x)))
  const y0 = Math.max(0, Math.min(G.rows - 1, Math.floor(y)))
  const x1 = Math.min(G.cols - 1, x0 + 1)
  const y1 = Math.min(G.rows - 1, y0 + 1)
  const fx = Math.max(0, Math.min(1, x - x0))
  const fy = Math.max(0, Math.min(1, y - y0))

  const at = (cx: number, cy: number) => G.data[cy * G.cols + cx]
  const top = at(x0, y0) * (1 - fx) + at(x1, y0) * fx
  const bottom = at(x0, y1) * (1 - fx) + at(x1, y1) * fx
  return top * (1 - fy) + bottom * fy
}

/** Co ile metrów próbkujemy profil. Wierzchołki ścieżek OSM bywają rzadkie. */
const SAMPLE_M = 40

/** Wygładzenie: mniejsze wahania traktujemy jako szum siatki, nie podejście. */
const THRESHOLD_M = 3

/**
 * Suma podejść i zejść wzdłuż trasy.
 *
 * Sam odczyt w wierzchołkach ścieżki zaniżałby wynik, bo odcinki OSM potrafią
 * mieć po kilkaset metrów — dlatego trasę zagęszczamy co SAMPLE_M.
 */
export async function profileOf(
  points: [number, number][],
): Promise<{ ascent: number; descent: number; samples: number[] }> {
  const G = await loadGrid()
  const samples: number[] = []

  for (let i = 0; i < points.length; i++) {
    const [lat, lon] = points[i]
    if (i > 0) {
      const [pLat, pLon] = points[i - 1]
      const span = haversine(pLat, pLon, lat, lon)
      const steps = Math.floor(span / SAMPLE_M)
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 1)
        samples.push(elevationAt(G, pLat + (lat - pLat) * t, pLon + (lon - pLon) * t))
      }
    }
    samples.push(elevationAt(G, lat, lon))
  }

  let ascent = 0
  let descent = 0
  let reference = samples[0] ?? 0
  for (const e of samples) {
    const d = e - reference
    if (d > THRESHOLD_M) {
      ascent += d
      reference = e
    } else if (d < -THRESHOLD_M) {
      descent += -d
      reference = e
    }
  }
  return { ascent, descent, samples }
}
