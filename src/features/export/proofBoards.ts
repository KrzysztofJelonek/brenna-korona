import { PEAKS } from '../../data/peaks'
import { APP_URL, APP_URL_SHORT } from '../../data/event'
import { makeQr, type QrCode } from '../../lib/qr'
import type { PeakProgress, StoredPhoto } from '../../types'
import { decodePhoto, describeError, drawContain, drawCover, type DecodedPhoto, type ExportFailure } from './exportPhotos'

const W = 2160
const H = 3000
const PAD = 64
const GAP = 32
const CARD_W = (W - PAD * 2 - GAP) / 2
const CARD_H = 1192
const PHOTO_H = 1050
const TOP = 340
const PER_BOARD = 4

export interface ProofBoard {
  blob: Blob
  name: string
}

/** Pięć dużych plansz do posta FB. Każdy kadr jest widoczny w całości. */
export async function renderProofBoards({
  progress,
  photos,
  participant,
}: {
  progress: Record<string, PeakProgress>
  photos: Map<string, StoredPhoto>
  participant?: string
}): Promise<{ boards: ProofBoard[]; failed: ExportFailure[] }> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Brak kontekstu canvas')
  const failed: ExportFailure[] = []
  const boards: ProofBoard[] = []
  const total = Math.ceil(PEAKS.length / PER_BOARD)
  const qr = await makeQr(APP_URL)

  try {
    for (let page = 0; page < total; page++) {
      ctx.clearRect(0, 0, W, H)
      drawPage(ctx, page, total, participant, progress, qr)
      for (let slot = 0; slot < PER_BOARD; slot++) {
        const peak = PEAKS[page * PER_BOARD + slot]
        if (!peak) continue
        const x = PAD + (slot % 2) * (CARD_W + GAP)
        const y = TOP + Math.floor(slot / 2) * (CARD_H + GAP)
        const photo = photos.get(peak.id)
        drawCardBase(ctx, x, y)
        ctx.save()
        ctx.beginPath()
        ctx.roundRect(x + 12, y + 12, CARD_W - 24, PHOTO_H, 18)
        ctx.clip()
        let placeholder: string | null = photo ? null : 'DODAJ ZDJĘCIE'
        if (photo) {
          try {
            const img = await decodePhoto(photo.blob)
            try {
              drawPhoto(ctx, img, x + 12, y + 12, CARD_W - 24, PHOTO_H)
            } finally {
              img.close()
            }
          } catch (error) {
            failed.push({ peak: peak.name, reason: describeError(error) })
            placeholder = 'NIE UDAŁO SIĘ WCZYTAĆ'
          }
        }
        if (placeholder) {
          ctx.fillStyle = '#e7efe1'
          ctx.fillRect(x + 12, y + 12, CARD_W - 24, PHOTO_H)
          ctx.fillStyle = '#6d866f'
          ctx.font = '600 32px system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(placeholder, x + CARD_W / 2, y + PHOTO_H / 2)
          ctx.textAlign = 'left'
        }
        ctx.restore()

        ctx.fillStyle = '#f7d75d'
        ctx.beginPath()
        ctx.roundRect(x + 32, y + 32, 98, 66, 15)
        ctx.fill()
        ctx.fillStyle = '#163825'
        ctx.font = '800 38px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(peak.no).padStart(2, '0'), x + 81, y + 65)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'

        ctx.fillStyle = '#193c28'
        ctx.font = fitFont(ctx, peak.name, CARD_W - 56, 48)
        ctx.fillText(peak.name, x + 28, y + PHOTO_H + 68)
        ctx.fillStyle = '#607366'
        ctx.font = '31px system-ui, sans-serif'
        const date = progress[peak.id]?.conqueredAt
          ? new Date(progress[peak.id].conqueredAt!).toLocaleDateString('pl-PL')
          : 'data wejścia: —'
        ctx.fillText(`${peak.ele} m n.p.m.   •   ${date}`, x + 28, y + PHOTO_H + 116)
      }
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.94))
      if (!blob) throw new Error('Nie udało się wygenerować planszy JPG')
      boards.push({ blob, name: `korona-gor-brennej-2026-${page + 1}-z-${total}.jpg` })
    }
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
  return { boards, failed }
}

function drawPage(
  ctx: CanvasRenderingContext2D,
  page: number,
  total: number,
  participant: string | undefined,
  progress: Record<string, PeakProgress>,
  qr: QrCode,
) {
  ctx.fillStyle = '#eaf1e6'
  ctx.fillRect(0, 0, W, H)
  const header = ctx.createLinearGradient(0, 0, W, TOP)
  header.addColorStop(0, '#123820')
  header.addColorStop(1, '#2c6735')
  ctx.fillStyle = header
  ctx.fillRect(0, 0, W, TOP - 20)

  // Prosta sylwetka gór daje charakter plakatu bez zasłaniania dowodów.
  ctx.fillStyle = 'rgba(151,203,127,.13)'
  ctx.beginPath()
  ctx.moveTo(950, TOP - 20)
  ctx.lineTo(1330, 48)
  ctx.lineTo(1550, 205)
  ctx.lineTo(1790, 68)
  ctx.lineTo(W, 220)
  ctx.lineTo(W, TOP - 20)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#f7d75d'
  ctx.font = '800 33px system-ui, sans-serif'
  ctx.fillText('W Y Z W A N I E   2 0 2 6', PAD, 76)
  ctx.fillStyle = '#fffdf4'
  ctx.font = '800 100px system-ui, sans-serif'
  ctx.fillText('KORONA GÓR', PAD - 4, 183)
  ctx.fillText('BRENNEJ', PAD - 4, 281)
  ctx.fillStyle = '#e4f1dc'
  ctx.font = '600 34px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('FOTORELACJA ZE SZCZYTÓW', W - PAD, 111)
  ctx.font = '38px system-ui, sans-serif'
  const label = participant?.trim() || 'Moja Korona Gór Brennej'
  ctx.fillText(label.slice(0, 35), W - PAD, 178)
  ctx.textAlign = 'left'

  ctx.fillStyle = '#183d28'
  ctx.font = '800 46px system-ui, sans-serif'
  ctx.fillText('RUSZ PO SWOJĄ KORONĘ', PAD, 2825)
  ctx.font = '700 42px system-ui, sans-serif'
  ctx.fillText(APP_URL_SHORT, PAD, 2901)
  ctx.fillStyle = '#607366'
  ctx.font = '31px system-ui, sans-serif'
  const done = PEAKS.filter((peak) => progress[peak.id]?.status === 'done').length
  ctx.fillText(`Szczyty ${page * PER_BOARD + 1}–${Math.min((page + 1) * PER_BOARD, PEAKS.length)}  •  ${done}/${PEAKS.length} zdobytych`, PAD, 2955)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#2c6735'
  ctx.font = '800 52px system-ui, sans-serif'
  ctx.fillText(`${String(page + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, 1820, 2915)
  ctx.textAlign = 'left'

  const qrX = 1875
  const qrY = 2773
  const qrSize = 211
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(qrX - 9, qrY - 9, qrSize + 18, qrSize + 18, 16)
  ctx.fill()
  ctx.save()
  ctx.translate(qrX, qrY)
  ctx.scale(qrSize / qr.size, qrSize / qr.size)
  ctx.fillStyle = '#163825'
  ctx.fill(new Path2D(qr.path))
  ctx.restore()
}

function drawCardBase(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = 'rgba(22,56,37,.12)'
  ctx.beginPath()
  ctx.roundRect(x + 5, y + 10, CARD_W, CARD_H, 26)
  ctx.fill()
  ctx.fillStyle = '#fffdf8'
  ctx.beginPath()
  ctx.roundRect(x, y, CARD_W, CARD_H, 26)
  ctx.fill()
}

function drawPhoto(ctx: CanvasRenderingContext2D, img: DecodedPhoto, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#dce8d7'
  ctx.fillRect(x, y, w, h)
  if (typeof ctx.filter === 'string') {
    ctx.save()
    ctx.filter = 'blur(35px) brightness(.7)'
    drawCover(ctx, img, x - 60, y - 60, w + 120, h + 120)
    ctx.restore()
  }
  drawContain(ctx, img, x, y, w, h)
}

function fitFont(ctx: CanvasRenderingContext2D, value: string, width: number, size: number): string {
  for (let s = size; s >= 29; s--) {
    const font = `800 ${s}px system-ui, sans-serif`
    ctx.font = font
    if (ctx.measureText(value).width <= width) return font
  }
  return '800 29px system-ui, sans-serif'
}
