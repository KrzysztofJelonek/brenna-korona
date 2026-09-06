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

export async function putPhoto(photo: StoredPhoto): Promise<void> {
  await (await db()).put('photos', photo)
}

export async function getPhoto(id: string): Promise<StoredPhoto | undefined> {
  return (await db()).get('photos', id)
}

export async function getPhotosForPeak(peakId: string): Promise<StoredPhoto[]> {
  return (await db()).getAllFromIndex('photos', 'peakId', peakId)
}

export async function getAllPhotos(): Promise<StoredPhoto[]> {
  return (await db()).getAll('photos')
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
