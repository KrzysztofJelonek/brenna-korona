import exifr from 'exifr'
import type { StoredPhoto } from '../types'

const MAX_EDGE = 1600
const QUALITY = 0.82

/** Zmniejsza i konwertuje zdjęcie do WebP, żeby 20 sztuk zmieściło się w IndexedDB. */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Brak kontekstu canvas')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', QUALITY),
  )
  if (blob) return blob
  // Safari starszy niż 14 nie umie WebP — spadamy na JPEG.
  const jpeg = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  )
  if (!jpeg) throw new Error('Nie udało się przetworzyć zdjęcia')
  return jpeg
}

export interface ExifInfo {
  takenAt?: string
  gps?: { lat: number; lon: number }
}

async function readExif(file: File): Promise<ExifInfo> {
  try {
    const data = await exifr.parse(file, { pick: ['DateTimeOriginal', 'CreateDate', 'latitude', 'longitude'] })
    if (!data) return {}
    const date: Date | undefined = data.DateTimeOriginal ?? data.CreateDate
    const info: ExifInfo = {}
    if (date instanceof Date && !Number.isNaN(date.getTime())) info.takenAt = date.toISOString()
    if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
      info.gps = { lat: data.latitude, lon: data.longitude }
    }
    return info
  } catch {
    // Zdjęcia bez EXIF (zrzuty, obrazy z komunikatorów) są w porządku — po prostu bez metadanych.
    return {}
  }
}

export async function preparePhoto(file: File, peakId: string): Promise<StoredPhoto> {
  const [blob, exif] = await Promise.all([compress(file), readExif(file)])
  return {
    id: `${peakId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    peakId,
    blob,
    takenAt: exif.takenAt ?? (file.lastModified ? new Date(file.lastModified).toISOString() : undefined),
    gps: exif.gps,
    addedAt: new Date().toISOString(),
  }
}

const urlCache = new Map<string, string>()

export function photoUrl(photo: StoredPhoto): string {
  const cached = urlCache.get(photo.id)
  if (cached) return cached
  const url = URL.createObjectURL(photo.blob)
  urlCache.set(photo.id, url)
  return url
}

export function releasePhotoUrl(id: string): void {
  const url = urlCache.get(id)
  if (url) {
    URL.revokeObjectURL(url)
    urlCache.delete(id)
  }
}
