import { PEAKS } from '../../data/peaks'
import type { PeakProgress, StoredPhoto } from '../../types'
import { containJpeg, describeError, type ExportFailure } from './exportPhotos'

const PAGE_W = 210
const PAGE_H = 297
const M = 12
const TOP = 20
const COLS = 2
const ROWS = 2
const PER_PAGE = COLS * ROWS
const GUTTER = 6
const CAPTION = 11
const ROW_GAP = 5
const COL_W = (PAGE_W - 2 * M - GUTTER) / COLS
/**
 * Pole zdjęcia jest pionowe (3:4) i mieści cały kadr — tabliczki szczytowe wiszą
 * wysoko, więc przycinanie do kwadratu ucinało dowód wejścia. Stąd 4 szczyty na
 * stronie zamiast 6: pionowe pole jest wyższe.
 */
const PHOTO_H = (PAGE_H - TOP - M - ROWS * (CAPTION + ROW_GAP)) / ROWS
const PHOTO_W = Math.min(COL_W, (PHOTO_H * 3) / 4)
/** ~300 dpi przy boku zdjęcia na stronie. */
const PHOTO_PX_W = 1040
const PHOTO_PX_H = Math.round((PHOTO_PX_W * PHOTO_H) / PHOTO_W)

export interface PdfOptions {
  progress: Record<string, PeakProgress>
  /** Zdjęcie do eksportu per szczyt (photosForExport). */
  photos: Map<string, StoredPhoto>
  participant?: string
}

/** Komplet zdjęć jako PDF A4 — po 4 szczyty na stronę, całe kadry bez przycinania. */
export async function renderPdf({ progress, photos, participant }: PdfOptions): Promise<{
  blob: Blob
  failed: ExportFailure[]
}> {
  // jsPDF i font ważą razem ~400 kB — ładujemy dopiero przy realnym użyciu.
  const [{ default: jsPDF }, font] = await Promise.all([import('jspdf'), import('./pdfFont')])
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  pdf.addFileToVFS(`${font.PDF_FONT}-Regular.ttf`, font.REGULAR)
  pdf.addFont(`${font.PDF_FONT}-Regular.ttf`, font.PDF_FONT, 'normal')
  pdf.addFileToVFS(`${font.PDF_FONT}-Bold.ttf`, font.BOLD)
  pdf.addFont(`${font.PDF_FONT}-Bold.ttf`, font.PDF_FONT, 'bold')

  const pages = Math.ceil(PEAKS.length / PER_PAGE)
  const failed: ExportFailure[] = []

  for (const [idx, peak] of PEAKS.entries()) {
    const slot = idx % PER_PAGE
    if (slot === 0) {
      if (idx > 0) pdf.addPage()
      pdf.setFont(font.PDF_FONT, 'bold')
      pdf.setFontSize(14)
      pdf.setTextColor(24, 81, 34)
      pdf.text(`Korona Gór Brennej 2026${participant ? ` — ${participant}` : ''}`, M, 13)
      pdf.setFont(font.PDF_FONT, 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(95, 108, 97)
      pdf.text(`strona ${idx / PER_PAGE + 1} z ${pages}`, PAGE_W - M, 13, { align: 'right' })
    }

    const col = slot % COLS
    const row = Math.floor(slot / COLS)
    const x = M + col * (COL_W + GUTTER) + (COL_W - PHOTO_W) / 2
    const y = TOP + row * (PHOTO_H + CAPTION + ROW_GAP)

    const photo = photos.get(peak.id)
    let placeholder: string | null = photo ? null : 'brak zdjęcia'
    if (photo) {
      try {
        pdf.addImage(
          await containJpeg(photo.blob, PHOTO_PX_W, PHOTO_PX_H),
          'JPEG',
          x,
          y,
          PHOTO_W,
          PHOTO_H,
          undefined,
          'NONE',
        )
      } catch (e) {
        failed.push({ peak: peak.name, reason: describeError(e) })
        placeholder = 'nie udało się wczytać zdjęcia'
      }
    }
    if (placeholder) {
      pdf.setDrawColor(180)
      pdf.rect(x, y, PHOTO_W, PHOTO_H)
      pdf.setFont(font.PDF_FONT, 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(150)
      pdf.text(placeholder, x + PHOTO_W / 2, y + PHOTO_H / 2, { align: 'center', baseline: 'middle' })
    }

    const prog = progress[peak.id]
    pdf.setFont(font.PDF_FONT, 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(32, 49, 43)
    pdf.text(`${peak.no}. ${peak.name} — ${peak.ele} m`, x, y + PHOTO_H + 5)
    pdf.setFont(font.PDF_FONT, 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(95, 108, 97)
    pdf.text(
      prog?.conqueredAt ? new Date(prog.conqueredAt).toLocaleDateString('pl-PL') : 'brak daty',
      x,
      y + PHOTO_H + 9,
    )
  }

  return { blob: pdf.output('blob'), failed }
}
