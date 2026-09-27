import { PEAKS } from '../../data/peaks'
import type { PeakProgress } from '../../types'

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
