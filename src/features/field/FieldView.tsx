import { useEffect, useMemo, useState } from 'react'
import { PEAKS } from '../../data/peaks'
import { useProgress } from '../../store/progress'
import { bearing, compassLabel, formatDistance, haversine } from '../../lib/geo'
import { buildGpx } from '../../lib/gpx'
import { downloadText } from '../../lib/download'
import type { Peak, TrackPoint } from '../../types'
import { IconCheck, IconDownload, IconLocate, IconWarn } from '../../ui/Icons'

/** Promień, w którym proponujemy zaliczenie — z zapasem na błąd GPS w lesie. */
const NEAR_RADIUS_M = 150

interface Props {
  position: { lat: number; lon: number; accuracy: number } | null
  error: string | null
  enabled: boolean
  onToggle: (v: boolean) => void
  recording: boolean
  onToggleRecording: (v: boolean) => void
  currentTrack: () => TrackPoint[]
  onOpenPeak: (peak: Peak) => void
}

export function FieldView({
  position,
  error,
  enabled,
  onToggle,
  recording,
  onToggleRecording,
  currentTrack,
  onOpenPeak,
}: Props) {
  const progress = useProgress((s) => s.progress)
  const toggleDone = useProgress((s) => s.toggleDone)
  const [dismissed, setDismissed] = useState<string[]>([])
  const [trackLen, setTrackLen] = useState(0)

  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setTrackLen(currentTrack().length), 3000)
    return () => clearInterval(t)
  }, [recording, currentTrack])

  const ranked = useMemo(() => {
    if (!position) return []
    return PEAKS.map((peak) => ({
      peak,
      distance: haversine(position.lat, position.lon, peak.lat, peak.lon),
      dir: compassLabel(bearing(position.lat, position.lon, peak.lat, peak.lon)),
    })).sort((a, b) => a.distance - b.distance)
  }, [position])

  const suggestion = ranked.find(
    (r) =>
      r.distance <= NEAR_RADIUS_M &&
      progress[r.peak.id]?.status !== 'done' &&
      !dismissed.includes(r.peak.id),
  )

  const exportTrack = () => {
    const points = currentTrack()
    downloadText(
      buildGpx(points, `Korona Gór Brennej ${new Date().toLocaleDateString('pl-PL')}`),
      `kgb-slad-${new Date().toISOString().slice(0, 10)}.gpx`,
      'application/gpx+xml',
    )
  }

  return (
    <div className="space-y-4">
      <section className="card px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Lokalizacja</h2>
            <p className="mt-1 text-xs text-muted">
              {position
                ? `Dokładność ±${Math.round(position.accuracy)} m`
                : enabled
                  ? 'Szukam sygnału…'
                  : 'Wyłączona — włącz, żeby zobaczyć dystanse do szczytów.'}
            </p>
          </div>
          <button onClick={() => onToggle(!enabled)} className={enabled ? 'btn-primary' : 'btn-ghost'}>
            <IconLocate className="h-4 w-4" /> {enabled ? 'Wł.' : 'Wył.'}
          </button>
        </div>
        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-xs text-warn">
            <IconWarn className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error} Geolokalizacja wymaga połączenia HTTPS.</span>
          </p>
        )}
      </section>

      {suggestion && (
        <section className="card border-done bg-done-soft px-4 py-4">
          <p className="text-sm">
            Jesteś <strong>{formatDistance(suggestion.distance)}</strong> od szczytu{' '}
            <strong>{suggestion.peak.name}</strong>. Zaliczyć?
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Pamiętaj o zdjęciu na tle tabliczki — bez niego organizator nie uzna wejścia.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                toggleDone(suggestion.peak.id)
                onOpenPeak(suggestion.peak)
              }}
              className="btn-summit"
            >
              <IconCheck className="h-4 w-4" /> Zaliczam
            </button>
            <button onClick={() => setDismissed((d) => [...d, suggestion.peak.id])} className="btn-ghost">
              Jeszcze nie
            </button>
          </div>
        </section>
      )}

      <section className="card px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Zapis śladu</h2>
            <p className="mt-1 text-xs text-muted">
              {recording ? `Nagrywam — ${trackLen} punktów.` : 'Zapisz trasę i wyeksportuj do GPX.'}
            </p>
          </div>
          <button
            onClick={() => onToggleRecording(!recording)}
            className={recording ? 'btn-primary' : 'btn-ghost'}
            disabled={!enabled}
          >
            {recording ? 'Stop' : 'Nagrywaj'}
          </button>
        </div>
        <button onClick={exportTrack} className="btn-ghost mt-3 w-full !py-2 !text-xs">
          <IconDownload className="h-4 w-4" /> Eksportuj GPX (ślad + 20 szczytów jako waypointy)
        </button>
        <p className="mt-2 text-[11px] text-muted">
          Ślad GPS jest dla Ciebie. Organizator uznaje go tylko wyjątkowo, po wcześniejszym ustaleniu — dowodem
          są zdjęcia.
        </p>
      </section>

      {ranked.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink-soft">Najbliższe szczyty</h2>
          <div className="space-y-1.5">
            {ranked.slice(0, 8).map(({ peak, distance, dir }) => {
              const done = progress[peak.id]?.status === 'done'
              return (
                <button
                  key={peak.id}
                  onClick={() => onOpenPeak(peak)}
                  className="card flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-tint-strong"
                >
                  <span className={`min-w-0 flex-1 truncate ${done ? 'text-done' : ''}`}>
                    {done && '✓ '}
                    {peak.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{peak.ele} m</span>
                  <span className="shrink-0 tabular-nums text-ink-soft">{formatDistance(distance)}</span>
                  <span className="w-7 shrink-0 text-right text-xs text-brand">{dir}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
