import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PeakInfo, PeakPhoto } from '../../types'
import { IconClose } from '../../ui/Icons'

interface PeakInfoFile {
  peaks: Record<string, PeakInfo>
}

let infoPromise: Promise<Record<string, PeakInfo>> | null = null

/** Opisy i zdjęcia są osobnym chunkiem — lista szczytów nie musi na nie czekać. */
function loadPeakInfo(): Promise<Record<string, PeakInfo>> {
  if (!infoPromise) {
    infoPromise = import('../../data/peakInfo.json').then((m) => (m.default as unknown as PeakInfoFile).peaks)
  }
  return infoPromise
}

export function usePeakInfo(peakId: string | undefined): PeakInfo | null {
  const [info, setInfo] = useState<PeakInfo | null>(null)
  useEffect(() => {
    setInfo(null)
    if (!peakId) return
    let alive = true
    loadPeakInfo().then((all) => alive && setInfo(all[peakId] ?? null))
    return () => {
      alive = false
    }
  }, [peakId])
  return info
}

// Ścieżka względna, jak logo sponsora — działa przy base: './' także z podkatalogu.
const peakFile = (file: string) => `peaks/${file}`

/** Pasek zdjęć z Wikimedia Commons — przewijany w poziomie, dotknięcie otwiera podgląd. */
export function PeakGallery({ info }: { info: PeakInfo }) {
  const [open, setOpen] = useState<number | null>(null)
  if (!info.photos.length) return null

  return (
    <>
      <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-1">
        {info.photos.map((p, i) => (
          <button
            key={p.src + i}
            onClick={() => setOpen(i)}
            aria-label={`Powiększ zdjęcie: ${p.caption}`}
            className="relative h-44 max-w-[85%] shrink-0 snap-start overflow-hidden rounded-xl border border-line bg-tint !min-h-0"
            style={{ aspectRatio: `${p.w} / ${p.h}` }}
          >
            <img
              src={peakFile(p.thumb)}
              alt={p.caption}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-2 pb-1 pt-4 text-left text-[10px] text-white/90">
              fot. {p.author}
            </span>
          </button>
        ))}
      </div>
      {open !== null && (
        <Lightbox photos={info.photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
      )}
    </>
  )
}

interface LightboxProps {
  photos: PeakPhoto[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}

function Lightbox({ photos, index, onIndex, onClose }: LightboxProps) {
  const photo = photos[index]
  const many = photos.length > 1
  const go = (d: number) => onIndex((index + d + photos.length) % photos.length)

  useEffect(() => {
    // Faza przechwytywania: Escape ma zamknąć podgląd, a nie cały panel szczytu pod nim.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' && many) go(1)
      else if (e.key === 'ArrowLeft' && many) go(-1)
      else return
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  // Portal, bo panel szczytu ma transform z animacji, a on psuje position: fixed potomków.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption}
      className="fixed inset-0 z-[1300] flex flex-col bg-black/95 text-white"
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-xs tabular-nums text-white/70">
          {many ? `${index + 1} / ${photos.length}` : ''}
        </span>
        <button onClick={onClose} aria-label="Zamknij podgląd" className="rounded-lg p-2 text-white/80 hover:text-white">
          <IconClose className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        <img
          src={peakFile(photo.src)}
          alt={photo.caption}
          className="max-h-full max-w-full object-contain"
          onClick={(e) => {
            e.stopPropagation()
            if (many) go(1)
          }}
        />
        {many && (
          <>
            <NavButton side="left" onClick={() => go(-1)} />
            <NavButton side="right" onClick={() => go(1)} />
          </>
        )}
      </div>

      <div className="safe-bottom px-5 pt-3 text-center" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm">{photo.caption}</p>
        <p className="mt-1 text-[11px] text-white/60">
          fot. {photo.author} ·{' '}
          <a className="underline" href={photo.licenseUrl ?? photo.page} target="_blank" rel="noreferrer">
            {photo.license}
          </a>{' '}
          ·{' '}
          <a className="underline" href={photo.page} target="_blank" rel="noreferrer">
            Wikimedia Commons
          </a>
        </p>
      </div>
    </div>,
    document.body,
  )
}

function NavButton({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-label={side === 'left' ? 'Poprzednie zdjęcie' : 'Następne zdjęcie'}
      className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2.5 text-white/90 hover:bg-black/70 ${
        side === 'left' ? 'left-2' : 'right-2'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={side === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
      </svg>
    </button>
  )
}

/** Opis szczytu zredagowany na podstawie Wikipedii. */
export function PeakAbout({ info }: { info: PeakInfo }) {
  return (
    <section className="mt-5">
      <h3 className="mb-1.5 text-xs font-medium text-muted">
        O szczycie{info.range ? ` · ${info.range}` : ''}
      </h3>
      <p className="text-sm leading-relaxed text-ink-soft">{info.summary}</p>

      {info.highlights.length > 0 && (
        <ul className="mt-2.5 space-y-1.5 text-sm leading-snug text-ink-soft">
          {info.highlights.map((h) => (
            <li key={h} className="flex gap-2.5">
              <span className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      )}

      {info.wiki && (
        <p className="mt-2.5 text-[11px] text-muted">
          Na podstawie Wikipedii:{' '}
          <a className="text-brand underline" href={info.wiki.url} target="_blank" rel="noreferrer">
            {info.wiki.title}
          </a>{' '}
          (CC BY-SA 4.0){info.wiki.note ? ` — ${info.wiki.note}` : ''}
        </p>
      )}
    </section>
  )
}
