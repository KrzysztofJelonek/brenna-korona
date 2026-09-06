import { haversine } from './geo'

/**
 * Routing po realnej sieci ścieżek z OpenStreetMap.
 *
 * Trasy dnia nie są już prostymi odcinkami między szczytami — liczymy je po
 * istniejących drogach i ścieżkach, z preferencją oznakowanych szlaków PTTK
 * (organizator wymaga, żeby szczyty zdobywać właśnie nimi). Dystans bierze się
 * z geometrii, a nie z mnożnika.
 *
 * Graf budowany jest leniwie, przy pierwszym użyciu, i trzymany w pamięci.
 */

interface TrailsFile {
  bbox: [number, number, number, number]
  scale: number
  ways: number[][]
}

/** Kara za odcinki bez oznakowania szlaku. Skalibrowana na propozycji gminy. */
export const UNMARKED_PENALTY = 4

export interface LatLon {
  lat: number
  lon: number
}

type NodeId = number

/** Siatka kodowania geometrii: 1e-5 stopnia, czyli ~1 m. */
const SCALE = 100000

interface Graph {
  /** lat/lon każdego węzła, w jednostkach siatki (1e-5 stopnia). */
  lat: Int32Array
  lon: Int32Array
  /** Lista sąsiedztwa: dla węzła i krawędzie w [start[i], start[i+1]). */
  start: Int32Array
  to: Int32Array
  len: Float32Array
  marked: Uint8Array
  count: number
}

let graphPromise: Promise<Graph> | null = null

/**
 * Sieć waży ~630 KB, więc wczytujemy ją osobnym chunkiem dopiero przy pierwszym
 * liczeniu trasy — start aplikacji ma zostać lekki.
 */
export function loadGraph(): Promise<Graph> {
  if (!graphPromise) {
    graphPromise = import('../data/trails.json').then((m) => build(m.default as unknown as TrailsFile))
  }
  return graphPromise
}

function build(FILE: TrailsFile): Graph {
  const key = new Map<number, NodeId>()
  const lat: number[] = []
  const lon: number[] = []
  const edges: { a: NodeId; b: NodeId; len: number; marked: boolean }[] = []

  const idOf = (la: number, lo: number): NodeId => {
    // lat/lon mieszczą się w ~24 bitach, więc łączymy je w jeden klucz liczbowy
    const k = la * 4_000_000 + lo
    let id = key.get(k)
    if (id === undefined) {
      id = lat.length
      key.set(k, id)
      lat.push(la)
      lon.push(lo)
    }
    return id
  }

  const S = SCALE
  for (const w of FILE.ways) {
    const marked = w[0] === 1
    let la = w[1]
    let lo = w[2]
    let prev = idOf(la, lo)
    for (let i = 3; i < w.length; i += 2) {
      la += w[i]
      lo += w[i + 1]
      const cur = idOf(la, lo)
      if (cur !== prev) {
        const d = haversine(lat[prev] / S, lon[prev] / S, lat[cur] / S, lon[cur] / S)
        edges.push({ a: prev, b: cur, len: d, marked })
        prev = cur
      }
    }
  }

  const count = lat.length
  const degree = new Int32Array(count + 1)
  for (const e of edges) {
    degree[e.a]++
    degree[e.b]++
  }
  const start = new Int32Array(count + 1)
  for (let i = 0; i < count; i++) start[i + 1] = start[i] + degree[i]
  const cursor = Int32Array.from(start.subarray(0, count))
  const to = new Int32Array(edges.length * 2)
  const len = new Float32Array(edges.length * 2)
  const marked = new Uint8Array(edges.length * 2)
  for (const e of edges) {
    let i = cursor[e.a]++
    to[i] = e.b
    len[i] = e.len
    marked[i] = e.marked ? 1 : 0
    i = cursor[e.b]++
    to[i] = e.a
    len[i] = e.len
    marked[i] = e.marked ? 1 : 0
  }

  const full: Graph = {
    lat: Int32Array.from(lat),
    lon: Int32Array.from(lon),
    start,
    to,
    len,
    marked,
    count,
  }

  return largestComponent(full)
}

/**
 * Zostawia tylko największą spójną składową.
 *
 * Bez tego przyciągnięcie szczytu do odizolowanego fragmentu sieci kończyłoby
 * się brakiem trasy i cichym powrotem do linii prostej.
 */
function largestComponent(g: Graph): Graph {
  const comp = new Int32Array(g.count).fill(-1)
  const sizes: number[] = []
  const stack: number[] = []

  for (let s = 0; s < g.count; s++) {
    if (comp[s] !== -1) continue
    const id = sizes.length
    let size = 0
    stack.push(s)
    comp[s] = id
    while (stack.length) {
      const u = stack.pop() as number
      size++
      for (let e = g.start[u]; e < g.start[u + 1]; e++) {
        const v = g.to[e]
        if (comp[v] === -1) {
          comp[v] = id
          stack.push(v)
        }
      }
    }
    sizes.push(size)
  }

  const keep = sizes.indexOf(Math.max(...sizes))
  if (sizes.length === 1) return g

  const remap = new Int32Array(g.count).fill(-1)
  let n = 0
  for (let i = 0; i < g.count; i++) if (comp[i] === keep) remap[i] = n++

  const lat = new Int32Array(n)
  const lon = new Int32Array(n)
  const degree = new Int32Array(n + 1)
  for (let i = 0; i < g.count; i++) {
    const r = remap[i]
    if (r === -1) continue
    lat[r] = g.lat[i]
    lon[r] = g.lon[i]
    degree[r] = g.start[i + 1] - g.start[i]
  }
  const start = new Int32Array(n + 1)
  for (let i = 0; i < n; i++) start[i + 1] = start[i] + degree[i]
  const to = new Int32Array(start[n])
  const len = new Float32Array(start[n])
  const marked = new Uint8Array(start[n])
  const cursor = Int32Array.from(start.subarray(0, n))
  for (let i = 0; i < g.count; i++) {
    const r = remap[i]
    if (r === -1) continue
    for (let e = g.start[i]; e < g.start[i + 1]; e++) {
      const j = cursor[r]++
      to[j] = remap[g.to[e]]
      len[j] = g.len[e]
      marked[j] = g.marked[e]
    }
  }

  return { lat, lon, start, to, len, marked, count: n }
}

/** Najbliższy węzeł sieci; zwraca też, jak daleko od niej leży punkt. */
function snapIn(g: Graph, point: LatLon): { node: NodeId; distance: number } {
  const S = SCALE
  const tLat = point.lat * S
  const tLon = point.lon * S
  let best = -1
  let bestSq = Infinity
  for (let i = 0; i < g.count; i++) {
    const dLat = g.lat[i] - tLat
    const dLon = (g.lon[i] - tLon) * 0.65 // przybliżona korekta na szerokości ~49.7°
    const sq = dLat * dLat + dLon * dLon
    if (sq < bestSq) {
      bestSq = sq
      best = i
    }
  }
  return {
    node: best,
    distance: haversine(g.lat[best] / S, g.lon[best] / S, point.lat, point.lon),
  }
}

export interface RouteLeg {
  /** Geometria odcinka, gotowa do narysowania na mapie. */
  points: [number, number][]
  /** Długość w metrach, z geometrii trasy. */
  distance: number
}

/** Dijkstra z preferencją oznakowanych szlaków; koszt ≠ długość, więc liczymy obie wartości. */
export async function route(from: LatLon, to: LatLon): Promise<RouteLeg | null> {
  const g = await loadGraph()
  const S = SCALE
  const src = snapIn(g, from).node
  const dst = snapIn(g, to).node
  if (src < 0 || dst < 0) return null
  if (src === dst) return { points: [[from.lat, from.lon]], distance: 0 }

  const cost = new Float64Array(g.count).fill(Infinity)
  const real = new Float64Array(g.count)
  const prev = new Int32Array(g.count).fill(-1)
  cost[src] = 0

  // kopiec binarny na parach (koszt, węzeł)
  const heapCost: number[] = [0]
  const heapNode: number[] = [src]
  const push = (c: number, n: number) => {
    heapCost.push(c)
    heapNode.push(n)
    let i = heapCost.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (heapCost[p] <= heapCost[i]) break
      ;[heapCost[p], heapCost[i]] = [heapCost[i], heapCost[p]]
      ;[heapNode[p], heapNode[i]] = [heapNode[i], heapNode[p]]
      i = p
    }
  }
  const pop = () => {
    const c = heapCost[0]
    const n = heapNode[0]
    const lc = heapCost.pop() as number
    const ln = heapNode.pop() as number
    if (heapCost.length) {
      heapCost[0] = lc
      heapNode[0] = ln
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < heapCost.length && heapCost[l] < heapCost[m]) m = l
        if (r < heapCost.length && heapCost[r] < heapCost[m]) m = r
        if (m === i) break
        ;[heapCost[m], heapCost[i]] = [heapCost[i], heapCost[m]]
        ;[heapNode[m], heapNode[i]] = [heapNode[i], heapNode[m]]
        i = m
      }
    }
    return [c, n] as const
  }

  while (heapCost.length) {
    const [c, u] = pop()
    if (u === dst) break
    if (c > cost[u]) continue
    for (let e = g.start[u]; e < g.start[u + 1]; e++) {
      const v = g.to[e]
      const w = g.marked[e] ? g.len[e] : g.len[e] * UNMARKED_PENALTY
      const nc = c + w
      if (nc < cost[v]) {
        cost[v] = nc
        real[v] = real[u] + g.len[e]
        prev[v] = u
        push(nc, v)
      }
    }
  }

  if (cost[dst] === Infinity) return null

  const points: [number, number][] = []
  for (let n = dst; n !== -1; n = prev[n]) points.push([g.lat[n] / S, g.lon[n] / S])
  points.reverse()
  return { points, distance: real[dst] }
}
