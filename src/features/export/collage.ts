import { PEAKS } from '../../data/peaks'
import type { PeakProgress, StoredPhoto } from '../../types'

const CELL = 520
const COLS = 4
const HEADER = 150
const GAP = 10
const CAPTION = 74

async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise((res, rej) => {
      img.onload = res
      img.onerror = () => rej(new Error('Nie udało się wczytać zdjęcia'))
      img.src = url
    })
    return img
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

/** Rysuje obraz wypełniający komórkę, zachowując proporcje (object-fit: cover). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
}

export interface CollageOptions {
  progress: Record<string, PeakProgress>
  photos: Map<string, StoredPhoto>
  participant?: string
}

/**
 * Składa komplet zdjęć w jeden obraz gotowy do wklejenia w dyskusję wydarzenia
 * na Facebooku — bo tak właśnie wygląda weryfikacja u organizatora.
 */
export async function renderCollage({ progress, photos, participant }: CollageOptions): Promise<Blob> {
  const rows = Math.ceil(PEAKS.length / COLS)
  const cellH = CELL + CAPTION
  const width = COLS * CELL + (COLS + 1) * GAP
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

  for (let i = 0; i < PEAKS.length; i++) {
    const peak = PEAKS[i]
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const x = GAP + col * (CELL + GAP)
    const y = HEADER + GAP + row * (cellH + GAP)

    const prog = progress[peak.id]
    const photoId = prog?.primaryPhotoId ?? prog?.photoIds[0]
    const photo = photoId ? photos.get(photoId) : undefined

    ctx.save()
    ctx.beginPath()
    ctx.roundRect(x, y, CELL, CELL, 18)
    ctx.clip()
    if (photo) {
      try {
        drawCover(ctx, await loadImage(photo.blob), x, y, CELL, CELL)
      } catch {
        ctx.fillStyle = '#dfeed8'
        ctx.fillRect(x, y, CELL, CELL)
      }
    } else {
      ctx.fillStyle = '#e6f1e0'
      ctx.fillRect(x, y, CELL, CELL)
      ctx.fillStyle = '#9bb094'
      ctx.font = '26px ui-sans-serif, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('brak zdjęcia', x + CELL / 2, y + CELL / 2)
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
    ctx.font = 'bold 30px ui-sans-serif, system-ui, sans-serif'
    ctx.fillText(peak.name, x + 6, y + CELL + 26)
    ctx.fillStyle = '#5f6c61'
    ctx.font = '25px ui-sans-serif, system-ui, sans-serif'
    const date = prog?.conqueredAt ? new Date(prog.conqueredAt).toLocaleDateString('pl-PL') : '—'
    ctx.fillText(`${peak.ele} m n.p.m.  ·  ${date}`, x + 6, y + CELL + 58)
  }

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9))
  if (!blob) throw new Error('Nie udało się wygenerować kolażu')
  return blob
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
