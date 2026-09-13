export type PeakStatus = 'todo' | 'planned' | 'done'
export type AscentMode = 'foot' | 'bike'

export interface Peak {
  id: string
  no: number
  name: string
  ele: number
  lat: number
  lon: number
  note?: string
  verify?: string
  /** Link do szczytu w Mapy.com (warstwa turystyczna, obiekt OSM). */
  mapy?: string
}

export interface PeakPhoto {
  /** Nazwa pliku na Wikimedia Commons (bez prefiksu File:). */
  commons: string
  caption: string
  /** Pliki w public/peaks/: pełny do podglądu i miniatura do paska. */
  src: string
  thumb: string
  w: number
  h: number
  author: string
  license: string
  licenseUrl?: string
  /** Strona pliku na Commons. */
  page: string
}

export interface PeakInfo {
  range?: string
  summary: string
  highlights: string[]
  wiki?: { title: string; url: string; note?: string }
  photos: PeakPhoto[]
}

export interface PeakProgress {
  status: PeakStatus
  conqueredAt?: string
  ascentMode?: AscentMode
  photoIds: string[]
  primaryPhotoId?: string
  note?: string
}

export interface DayPlan {
  id: string
  name: string
  date?: string
  /** Wolny tekst — zostaje dla planów sprzed wprowadzenia punktów startowych. */
  startPoint?: string
  /** Punkt startowy ze współrzędnymi (src/data/startPoints.ts). */
  startPointId?: string
  /** Powrót na miejsce startu. Domyślnie tak — zwykle zostawia się tam samochód. */
  loop?: boolean
  peakIds: string[]
  /** Oficjalne dane z PDF gminy — jeśli są, mają pierwszeństwo przed szacunkiem. */
  officialDistanceKm?: number
  officialTime?: string
}

/** Własne miejsce parkowania wskazane na mapie — zapisane, żeby dało się do niego wracać. */
export interface CustomParking {
  id: string
  /** Nazwa lub opis wpisany przez użytkownika; pusty — pokazujemy „Własne miejsce”. */
  name: string
  lat: number
  lon: number
  /** Wysokość z siatki SRTM. */
  ele: number
}

/** Parking trasy „na dziś”: dobrany automatycznie, z listy gminy, jedno z własnych miejsc albo żaden. */
export type TodayParking =
  | { kind: 'auto' }
  | { kind: 'none' }
  | { kind: 'point'; id: string }
  | { kind: 'custom'; id: string }

/**
 * Trasa ułożona na mapie na bieżący dzień. Trzyma tylko wybór użytkownika —
 * kolejność przejścia i przebieg liczone są z niego za każdym razem.
 */
export interface TodayPlan {
  peakIds: string[]
  parking: TodayParking
  /** Powrót na parking; bez parkingu nie ma znaczenia. */
  loop: boolean
  /** Przejście ułożonej kolejności w przeciwnym kierunku. */
  reversed: boolean
}

export interface RoutePreset {
  id: string
  name: string
  days: number
  description: string
  plans: DayPlan[]
}

export interface StoredPhoto {
  id: string
  peakId: string
  blob: Blob
  takenAt?: string
  gps?: { lat: number; lon: number }
  addedAt: string
}

export interface TrackPoint {
  lat: number
  lon: number
  ele?: number
  t: number
}
