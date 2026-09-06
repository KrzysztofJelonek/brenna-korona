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
