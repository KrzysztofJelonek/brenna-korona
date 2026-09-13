import { PEAKS } from '../../data/peaks'
import { getAllPhotos } from '../../store/media'
import type { PeakProgress, StoredPhoto } from '../../types'
import { describeError } from '../../lib/errors'

export { describeError }

/** Szczyt, którego zdjęcia nie dało się wczytać — trafia do komunikatu po eksporcie. */
export interface ExportFailure {
  peak: string
  reason: string
}

/**
 * Zdjęcie do eksportu dla każdego szczytu, który jakieś ma.
 *
 * Źródłem są zdjęcia w IndexedDB przypisane do szczytu — tak samo jak w karcie
 * szczytu — a nie identyfikatory zapisane w postępie. Dzięki temu eksport pokazuje
 * to, co widać w aplikacji, nawet gdy postęp i baza zdjęć się rozjechały.
 * Pierwszeństwo ma zdjęcie oznaczone gwiazdką.
 */
export async function photosForExport(progress: Record<string, PeakProgress>): Promise<Map<string, StoredPhoto>> {
  const byPeak = new Map<string, StoredPhoto[]>()
  for (const photo of await getAllPhotos()) {
    const list = byPeak.get(photo.peakId)
    if (list) list.push(photo)
    else byPeak.set(photo.peakId, [photo])
  }

  const result = new Map<string, StoredPhoto>()
  for (const peak of PEAKS) {
    const list = byPeak.get(peak.id)
    if (!list?.length) continue
    const prog = progress[peak.id]
    const preferred = [prog?.primaryPhotoId, ...(prog?.photoIds ?? [])]
      .map((id) => list.find((p) => p.id === id))
      .find((p): p is StoredPhoto => Boolean(p))
    const oldest = [...list].sort((a, b) => a.addedAt.localeCompare(b.addedAt))[0]
    result.set(peak.id, preferred ?? oldest)
  }
  return result
}

export interface DecodedPhoto {
  source: CanvasImageSource
  width: number
  height: number
  close: () => void
}

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('przeglądarka nie zdekodowała obrazu'))
    img.src = src
  })

const fromImg = (img: HTMLImageElement): DecodedPhoto => ({
  source: img,
  width: img.naturalWidth,
  height: img.naturalHeight,
  close: () => {},
})

/**
 * Dekoduje zapisane zdjęcie do rysowania na canvasie. Kilka dróg, bo telefony
 * potykają się na różnych: Safari potrafi nie otworzyć bloba z IndexedDB przez
 * blob: URL, a starsze przeglądarki nie mają createImageBitmap dla WebP.
 */
export async function decodePhoto(blob: Blob): Promise<DecodedPhoto> {
  const errors: string[] = []

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob)
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
    } catch (e) {
      errors.push(describeError(e))
    }
  }

  // Bajty przepisane do świeżego bloba w pamięci — omija odwołanie do pliku w IndexedDB.
  let fresh: Blob
  try {
    fresh = new Blob([await blob.arrayBuffer()], { type: blob.type || 'image/webp' })
  } catch (e) {
    errors.push(describeError(e))
    throw new Error(errors.join('; '))
  }

  const url = URL.createObjectURL(fresh)
  try {
    return fromImg(await loadImg(url))
  } catch (e) {
    errors.push(describeError(e))
  } finally {
    URL.revokeObjectURL(url)
  }

  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(r.error ?? new Error('błąd odczytu pliku'))
      r.readAsDataURL(fresh)
    })
    return fromImg(await loadImg(dataUrl))
  } catch (e) {
    errors.push(describeError(e))
  }

  throw new Error(errors.join('; '))
}

/** Rysuje obraz wypełniający prostokąt, zachowując proporcje (object-fit: cover). */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  img: DecodedPhoto,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(img.source, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
}

/** Kwadratowy JPEG przycięty do środka — do PDF, który nie radzi sobie z WebP. */
export async function squareJpeg(blob: Blob, size: number): Promise<Uint8Array> {
  const img = await decodePhoto(blob)
  const canvas = document.createElement('canvas')
  try {
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('brak kontekstu canvas')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)
    drawCover(ctx, img, 0, 0, size, size)
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!jpeg) throw new Error('nie udało się zakodować JPEG')
    return new Uint8Array(await jpeg.arrayBuffer())
  } finally {
    img.close()
    // Safari trzyma pamięć canvasów do czasu GC — przy 20 zdjęciach potrafi jej zabraknąć.
    canvas.width = 0
    canvas.height = 0
  }
}
