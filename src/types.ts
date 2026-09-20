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

/**
 * Punkt pośredni trasy „na dziś” — miejsce, przez które trasa ma przejść
 * (przełęcz, bacówka, zejście poza szlakiem). Kolejność układamy tak samo
 * jak dla szczytów, więc punkt wpada tam, gdzie leży.
 */
export interface Waypoint {
  id: string
  /** Nazwa lub opis; pusty — pokazujemy „Punkt pośredni”. */
  name: string
  lat: number
  lon: number
  /** Wysokość z siatki SRTM. */
  ele: number
}

/** Wskazane miejsce: jeden z parkingów gminy albo własne miejsce z mapy. */
export type ParkingRef = { kind: 'point'; id: string } | { kind: 'custom'; id: string }

/** Parking trasy „na dziś”: dobrany automatycznie, wskazany wprost albo żaden. */
export type TodayParking = { kind: 'auto' } | { kind: 'none' } | ParkingRef

/**
 * Koniec trasy „na dziś”. Zwykle wraca się po auto na start, ale przy dwóch
 * autach dzień kończy się na innym parkingu — stąd osobny wybór.
 */
export type TodayFinish = { kind: 'start' } | { kind: 'none' } | ParkingRef

/**
 * Trasa ułożona na mapie na bieżący dzień. Trzyma tylko wybór użytkownika —
 * kolejność przejścia i przebieg liczone są z niego za każdym razem.
 */
export interface TodayPlan {
  peakIds: string[]
  /** Parking startowy. */
  parking: TodayParking
  /** Miejsce zakończenia: powrót na start, inny parking albo ostatni szczyt. */
  finish: TodayFinish
  /** Punkty pośrednie, przez które ma przejść trasa. */
  waypoints: Waypoint[]
  /** Przejście trasy w przeciwnym kierunku — przy dwóch parkingach zamienia je miejscami. */
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
