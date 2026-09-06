import { getAllPhotos, putPhoto, clearAllMedia } from '../../store/media'
import type { DayPlan, PeakProgress, StoredPhoto } from '../../types'

const FORMAT = 'kgb-backup'
const VERSION = 1

interface BackupFile {
  format: typeof FORMAT
  version: number
  exportedAt: string
  progress: Record<string, PeakProgress>
  plans: DayPlan[]
  photos: { id: string; peakId: string; takenAt?: string; gps?: { lat: number; lon: number }; addedAt: string; type: string; data: string }[]
}

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] ?? '')
    r.onerror = () => rej(new Error('Nie udało się odczytać zdjęcia'))
    r.readAsDataURL(blob)
  })

function base64ToBlob(data: string, type: string): Blob {
  const bin = atob(data)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

export async function exportBackup(
  progress: Record<string, PeakProgress>,
  plans: DayPlan[],
): Promise<Blob> {
  const stored = await getAllPhotos()
  const photos = await Promise.all(
    stored.map(async (p) => ({
      id: p.id,
      peakId: p.peakId,
      takenAt: p.takenAt,
      gps: p.gps,
      addedAt: p.addedAt,
      type: p.blob.type || 'image/webp',
      data: await blobToBase64(p.blob),
    })),
  )
  const file: BackupFile = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    progress,
    plans,
    photos,
  }
  return new Blob([JSON.stringify(file)], { type: 'application/json' })
}

export interface ImportResult {
  progress: Record<string, PeakProgress>
  plans: DayPlan[]
  photoCount: number
}

export async function importBackup(file: File): Promise<ImportResult> {
  const parsed = JSON.parse(await file.text()) as BackupFile
  if (parsed?.format !== FORMAT) {
    throw new Error('To nie jest plik backupu Korony Gór Brennej.')
  }
  if (parsed.version > VERSION) {
    throw new Error('Backup pochodzi z nowszej wersji aplikacji. Zaktualizuj stronę.')
  }

  await clearAllMedia()
  for (const p of parsed.photos ?? []) {
    const photo: StoredPhoto = {
      id: p.id,
      peakId: p.peakId,
      blob: base64ToBlob(p.data, p.type),
      takenAt: p.takenAt,
      gps: p.gps,
      addedAt: p.addedAt,
    }
    await putPhoto(photo)
  }

  return {
    progress: parsed.progress ?? {},
    plans: parsed.plans ?? [],
    photoCount: parsed.photos?.length ?? 0,
  }
}
