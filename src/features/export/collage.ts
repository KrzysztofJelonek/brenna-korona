import { PEAKS } from '../../data/peaks'
import type { PeakProgress, StoredPhoto } from '../../types'
import {
  decodePhoto,
  describeError,
  drawContain,
  drawCover,
  type DecodedPhoto,
  type ExportFailure,
} from './exportPhotos'

/**
 * Kadr pionowy 3:4 — tabliczki szczytowe wiszą wysoko i zdjęcia robi się pionowo.
 * Kwadratowe pole ucinało górę kadru razem z tabliczką, więc zdjęcie wpisujemy
 * w całości (contain), a resztę pola wypełnia rozmyte tło z tego samego zdjęcia.
 */
const CELL_W = 460
const CELL_H = 614
const COLS = 4
const HEADER = 150
const GAP = 10
const CAPTION = 74
/** Zapas na rozmycie tła, żeby blur nie wciągał przezroczystości przy krawędziach. */
const BLUR_BLEED = 48

export interface CollageOptions {
  progress: Record<string, PeakProgress>
  /** Zdjęcie do eksportu per szczyt (photosForExport). */
  photos: Map<string, StoredPhoto>
  participant?: string
}

/**
 * Składa komplet zdjęć w jeden obraz gotowy do wklejenia w dyskusję wydarzenia
 * na Facebooku — bo tak właśnie wygląda weryfikacja u organizatora.
 */
export async function renderCollage({ progress, photos, participant }: CollageOptions): Promise<{
  blob: Blob
  failed: ExportFailure[]
}> {
  const rows = Math.ceil(PEAKS.length / COLS)
  const cellH = CELL_H + CAPTION
  const width = COLS * CELL_W + (COLS + 1) * GAP
  const height = HEADER + rows * cellH + (rows + 1) * GAP

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Brak kontekstu canvas')

  const bg = ctx.createLinearGradient(0, 0, width, height)
  bg.addColorStop(0, '#f6fbf2')
  bg.addColorStop(1, '#e4f0dd')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  const doneCount = PEAKS.filter((p) => progress[p.id]?.status === 'done').length
  const dates = PEAKS.map((p) => progress[p.id]?.conqueredAt).filter(Boolean).sort() as string[]

  ctx.fillStyle = '#185122'
  ctx.font = 'bold 58px ui-sans-serif, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText('Korona Gór Brennej 2026', GAP + 24, 58)

  ctx.font = '30px ui-sans-serif, system-ui, sans-serif'
  ctx.fillStyle = '#5f6c61'
  const range =
    dates.length > 0
      ? `${new Date(dates[0]).toLocaleDateString('pl-PL')} – ${new Date(dates[dates.length - 1]).toLocaleDateString('pl-PL')}`
      : ''
  ctx.fillText([participant, `${doneCount}/20 szczytów`, range].filter(Boolean).join('  ·  '), GAP + 24, 110)

  const blurAvailable = supportsFilter(ctx)
  const failed: ExportFailure[] = []
  for (let i = 0; i < PEAKS.length; i++) {
    const peak = PEAKS[i]
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const x = GAP + col * (CELL_W + GAP)
    const y = HEADER + GAP + row * (cellH + GAP)

    const prog = progress[peak.id]
    const photo = photos.get(peak.id)

    ctx.save()
    ctx.beginPath()
    ctx.roundRect(x, y, CELL_W, CELL_H, 18)
    ctx.clip()
    let placeholder: string | null = photo ? null : 'brak zdjęcia'
    if (photo) {
      try {
        const img = await decodePhoto(photo.blob)
        try {
          drawBackdrop(ctx, img, x, y, blurAvailable)
          drawContain(ctx, img, x, y, CELL_W, CELL_H)
        } finally {
          img.close()
        }
      } catch (e) {
        failed.push({ peak: peak.name, reason: describeError(e) })
        placeholder = 'nie udało się wczytać zdjęcia'
      }
    }
    if (placeholder) {
      ctx.fillStyle = photo ? '#f6e6dc' : '#e6f1e0'
      ctx.fillRect(x, y, CELL_W, CELL_H)
      ctx.fillStyle = photo ? '#b0643a' : '#9bb094'
      ctx.font = '26px ui-sans-serif, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(placeholder, x + CELL_W / 2, y + CELL_H / 2)
      ctx.textAlign = 'left'
    }
    ctx.restore()

    // numer szczytu
    ctx.fillStyle = 'rgba(34,107,49,.92)'
    ctx.beginPath()
    ctx.roundRect(x + 14, y + 14, 62, 44, 12)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 26px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(String(peak.no), x + 45, y + 37)
    ctx.textAlign = 'left'

    // podpis
    ctx.fillStyle = '#20312b'
    ctx.font = fitFont(ctx, peak.name, CELL_W - 12, 30, 'bold')
    ctx.fillText(peak.name, x + 6, y + CELL_H + 26)
    ctx.fillStyle = '#5f6c61'
    ctx.font = '25px ui-sans-serif, system-ui, sans-serif'
    const date = prog?.conqueredAt ? new Date(prog.conqueredAt).toLocaleDateString('pl-PL') : '—'
    ctx.fillText(`${peak.ele} m n.p.m.  ·  ${date}`, x + 6, y + CELL_H + 58)
  }

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9))
  if (!blob) throw new Error('Nie udało się wygenerować kolażu')
  return { blob, failed }
}

/** Czy canvas tej przeglądarki umie filtry (Safari dostał je dopiero w 17). */
function supportsFilter(ctx: CanvasRenderingContext2D): boolean {
  const before = ctx.filter
  try {
    ctx.filter = 'blur(2px)'
    return ctx.filter !== 'none' && ctx.filter !== before
  } finally {
    ctx.filter = before
  }
}

/** Tło pola: rozmyte zdjęcie rozciągnięte na cały kadr, żeby pasy obok zdjęcia nie były gołe. */
function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  img: DecodedPhoto,
  x: number,
  y: number,
  blur: boolean,
) {
  if (!blur) {
    ctx.fillStyle = '#e9f1e4'
    ctx.fillRect(x, y, CELL_W, CELL_H)
    return
  }
  ctx.save()
  ctx.filter = 'blur(28px) brightness(0.86)'
  // Rysujemy z zapasem poza polem — inaczej rozmycie zassałoby przezroczystość zza krawędzi.
  drawCover(ctx, img, x - BLUR_BLEED, y - BLUR_BLEED, CELL_W + 2 * BLUR_BLEED, CELL_H + 2 * BLUR_BLEED)
  ctx.restore()
}

/** Zmniejsza stopień pisma, dopóki napis nie zmieści się w polu (np. Trzy Kopce Wiślańskie). */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  size: number,
  weight: 'bold' | 'normal' = 'normal',
): string {
  for (let s = size; s > 16; s -= 1) {
    const font = `${weight === 'bold' ? 'bold ' : ''}${s}px ui-sans-serif, system-ui, sans-serif`
    ctx.font = font
    if (ctx.measureText(text).width <= maxWidth) return font
  }
  return `${weight === 'bold' ? 'bold ' : ''}17px ui-sans-serif, system-ui, sans-serif`
}

/** Kwadratowa karta podsumowania do udostępnienia. */
export async function renderSummaryCard(
  progress: Record<string, PeakProgress>,
  participant?: string,
): Promise<Blob> {
  const S = 1080
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Brak kontekstu canvas')

  const bg = ctx.createLinearGradient(0, 0, S, S)
  bg.addColorStop(0, '#8ac95f')
  bg.addColorStop(1, '#14401f')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, S, S)

  // sylwetka gór
  ctx.beginPath()
  ctx.moveTo(0, S)
  ctx.lineTo(0, 760)
  ctx.lineTo(200, 560)
  ctx.lineTo(330, 690)
  ctx.lineTo(520, 470)
  ctx.lineTo(700, 690)
  ctx.lineTo(880, 590)
  ctx.lineTo(S, 720)
  ctx.lineTo(S, S)
  ctx.closePath()
  const mg = ctx.createLinearGradient(0, 470, 0, S)
  mg.addColorStop(0, '#1c5527')
  mg.addColorStop(1, '#0e2c15')
  ctx.fillStyle = mg
  ctx.fill()

  ctx.fillStyle = '#ffd84d'
  ctx.beginPath()
  ctx.arc(830, 220, 78, 0, Math.PI * 2)
  ctx.fill()

  const done = PEAKS.filter((p) => progress[p.id]?.status === 'done')
  const ascent = done.reduce((s, p) => s + p.ele, 0)
  const dates = done.map((p) => progress[p.id]?.conqueredAt).filter(Boolean).sort() as string[]

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#dff0d3'
  ctx.font = '34px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText('KORONA GÓR BRENNEJ 2026', 70, 130)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 190px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText(`${done.length}/20`, 66, 310)

  ctx.font = 'bold 44px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText(done.length === 20 ? 'Korona zdobyta!' : 'szczytów zdobytych', 70, 372)

  if (participant) {
    ctx.font = '38px ui-sans-serif, system-ui, sans-serif'
    ctx.fillStyle = '#eaf6e2'
    ctx.fillText(participant, 70, 428)
  }

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 40px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText(`${ascent.toLocaleString('pl-PL')} m`, 70, 940)
  ctx.fillText(done.length ? `${dates.length} wejść` : '—', 480, 940)
  ctx.fillStyle = '#cfe6c2'
  ctx.font = '26px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText('suma wysokości szczytów', 70, 980)
  ctx.fillText(
    dates.length
      ? `${new Date(dates[0]).toLocaleDateString('pl-PL')} – ${new Date(dates[dates.length - 1]).toLocaleDateString('pl-PL')}`
      : '',
    480,
    980,
  )

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) throw new Error('Nie udało się wygenerować karty')
  return blob
}
