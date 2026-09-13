import { openDB, type IDBPDatabase } from 'idb'
import type { StoredPhoto, TrackPoint } from '../types'

const DB_NAME = 'kgb-media'
const DB_VERSION = 1

interface TrackRecord {
  id: string
  name: string
  points: TrackPoint[]
  startedAt: string
  finishedAt?: string
}

/**
 * Zdjęcie tak, jak leży w bazie. Bajty zapisujemy jako ArrayBuffer, nie Blob:
 * WebKit w trybie prywatnym i w części przeglądarek wbudowanych (np. w aplikacji
 * Facebooka) odrzuca Bloby w IndexedDB, a Blob odczytany z bazy w Safari potrafi
 * się potem nie otworzyć. Rekordy sprzed tej zmiany mają jeszcze pole `blob`.
 */
type PhotoRecord = Omit<StoredPhoto, 'blob'> & { data?: ArrayBuffer; type?: string; blob?: Blob }

let dbPromise: Promise<IDBPDatabase> | null = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('photos')) {
          const s = d.createObjectStore('photos', { keyPath: 'id' })
          s.createIndex('peakId', 'peakId')
        }
        if (!d.objectStoreNames.contains('tracks')) {
          d.createObjectStore('tracks', { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

const fromRecord = ({ data, type, blob, ...meta }: PhotoRecord): StoredPhoto => ({
  ...meta,
  blob: data ? new Blob([data], { type: type || 'image/webp' }) : (blob ?? new Blob()),
})

export async function putPhoto(photo: StoredPhoto): Promise<void> {
  const { blob, ...meta } = photo
  const record: PhotoRecord = { ...meta, data: await blob.arrayBuffer(), type: blob.type }
  await (await db()).put('photos', record)
}

export async function getPhoto(id: string): Promise<StoredPhoto | undefined> {
  const record: PhotoRecord | undefined = await (await db()).get('photos', id)
  return record && fromRecord(record)
}

export async function getPhotosForPeak(peakId: string): Promise<StoredPhoto[]> {
  return ((await (await db()).getAllFromIndex('photos', 'peakId', peakId)) as PhotoRecord[]).map(fromRecord)
}

export async function getAllPhotos(): Promise<StoredPhoto[]> {
  return ((await (await db()).getAll('photos')) as PhotoRecord[]).map(fromRecord)
}

export async function deletePhoto(id: string): Promise<void> {
  await (await db()).delete('photos', id)
}

export async function putTrack(track: TrackRecord): Promise<void> {
  await (await db()).put('tracks', track)
}

export async function getAllTracks(): Promise<TrackRecord[]> {
  return (await db()).getAll('tracks')
}

export async function deleteTrack(id: string): Promise<void> {
  await (await db()).delete('tracks', id)
}

export async function clearAllMedia(): Promise<void> {
  const d = await db()
  await d.clear('photos')
  await d.clear('tracks')
}

export type { TrackRecord }
