import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, LayersControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import { PEAKS, peakById } from '../../data/peaks'
import { estimateDay, formatTime, plural } from '../../lib/geo'
import { useProgress } from '../../store/progress'
import type { Peak } from '../../types'
import { IconLocate, IconRoute } from '../../ui/Icons'

const BRENNA_CENTER: [number, number] = [49.7175, 18.9265]

/* Kolory dni: dwa pierwsze z palety organizatora, reszta dobrana tak,
   by dało się je rozróżnić na jasnych kafelkach OSM. */
const DAY_COLORS = ['#226b31', '#e26c3b', '#1f6f8b', '#8a4fbd', '#c99a2e', '#b03a48']

interface MarkerOpts {
  /** Numer kolejności w wybranym dniu — zastępuje numer szczytu. */
  order?: number
  /** Kolor dnia, rysowany jako obwódka. */
  dayColor?: string
  /** Szczyt spoza wybranego dnia — schodzi na drugi plan. */
  dimmed?: boolean
}

function peakIcon(status: string, no: number, opts: MarkerOpts = {}): L.DivIcon {
  const { order, dayColor, dimmed } = opts

  if (dimmed) {
    return L.divIcon({
      className: '',
      html: `<div style="width:10px;height:10px;border-radius:50%;background:#8fa596;border:2px solid #fff;opacity:.65"></div>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5],
      popupAnchor: [0, -6],
    })
  }

  const done = status === 'done'
  const planned = status === 'planned'
  const bg = done ? '#2f7d32' : planned ? '#c99a2e' : '#4f5e56'
  const ring = dayColor ?? (done ? '#e9f6e3' : planned ? '#fdf3d3' : '#e9eee8')
  const size = order ? 30 : 26

  const label =
    order !== undefined
      ? `<span style="font:700 12px/1 ui-sans-serif,system-ui;color:#fff">${order}</span>`
      : done
        ? '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
        : `<span style="font:700 11px/1 ui-sans-serif,system-ui;color:#fff">${no}</span>`

  const check =
    order !== undefined && done
      ? `<span style="position:absolute;right:-3px;bottom:-3px;display:flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;background:#2f7d32;border:2px solid #fff"><svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke="white" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>`
      : ''

  return L.divIcon({
    className: '',
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:3px solid ${ring};box-shadow:0 2px 8px rgba(20,49,31,.35)">${label}${check}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 2],
  })
}

const userIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#1f6f8b;border:3px solid #fff;box-shadow:0 0 0 4px rgba(31,111,139,.3)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

function RecenterButton({ position }: { position: { lat: number; lon: number } | null }) {
  const map = useMap()
  if (!position) return null
  return (
    <button
      onClick={() => map.flyTo([position.lat, position.lon], 14, { duration: 0.8 })}
      className="absolute bottom-3 right-3 z-[500] rounded-xl border border-line bg-surface p-2.5 text-ink shadow-lg"
      aria-label="Wyśrodkuj na mojej pozycji"
    >
      <IconLocate className="h-5 w-5" />
    </button>
  )
}

/** Dopasowuje widok do aktualnie pokazywanej trasy — ale tylko przy zmianie wyboru. */
function FitToRoute({ points, token }: { points: [number, number][]; token: string }) {
  const map = useMap()
  const last = useRef<string>('')

  useEffect(() => {
    if (last.current === token) return
    last.current = token
    if (points.length === 0) {
      map.setView(BRENNA_CENTER, 12)
      return
    }
    if (points.length === 1) {
      map.setView(points[0], 14)
      return
    }
    map.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 15 })
  }, [map, points, token])

  return null
}

interface Props {
  onOpenPeak: (peak: Peak) => void
  position: { lat: number; lon: number; accuracy: number } | null
  selectedDayId: string | null
  onSelectDay: (id: string | null) => void
  onGoToPlanner: () => void
}

export function MapView({ onOpenPeak, position, selectedDayId, onSelectDay, onGoToPlanner }: Props) {
  const progress = useProgress((s) => s.progress)
  const plans = useProgress((s) => s.plans)

  const days = useMemo(
    () =>
      plans.map((day, i) => ({
        id: day.id,
        name: day.name,
        color: DAY_COLORS[i % DAY_COLORS.length],
        peaks: day.peakIds.map(peakById).filter((p): p is Peak => Boolean(p)),
        officialDistanceKm: day.officialDistanceKm,
        officialTime: day.officialTime,
      })),
    [plans],
  )

  const selected = days.find((d) => d.id === selectedDayId) ?? null
  const shown = selected ? [selected] : days

  /** Numer kolejności i kolor dnia — tylko gdy patrzymy na jeden dzień. */
  const orderByPeak = useMemo(() => {
    const map = new Map<string, { order: number; color: string }>()
    if (selected) {
      selected.peaks.forEach((p, i) => map.set(p.id, { order: i + 1, color: selected.color }))
    }
    return map
  }, [selected])

  const fitPoints = useMemo<[number, number][]>(
    () => shown.flatMap((d) => d.peaks.map((p) => [p.lat, p.lon] as [number, number])),
    [shown],
  )

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapContainer center={BRENNA_CENTER} zoom={12} className="h-full w-full" zoomControl={false}>
        <LayersControl position="bottomleft">
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="OpenTopoMap">
            <TileLayer
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap, SRTM | <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
              maxZoom={17}
            />
          </LayersControl.BaseLayer>
          <LayersControl.Overlay checked name="Szlaki turystyczne">
            <TileLayer
              url="https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png"
              attribution='Szlaki: <a href="https://hiking.waymarkedtrails.org">waymarkedtrails.org</a> (CC-BY-SA)'
              maxZoom={18}
              opacity={0.55}
            />
          </LayersControl.Overlay>
        </LayersControl>

        {shown.map((day) => {
          const pts = day.peaks.map((p) => [p.lat, p.lon] as [number, number])
          if (pts.length < 2) return null
          return (
            <div key={day.id}>
              {/* białe podłoże, żeby linia czytała się na każdym podkładzie */}
              <Polyline positions={pts} pathOptions={{ color: '#ffffff', weight: 8, opacity: 0.75, lineCap: 'round', lineJoin: 'round' }} />
              <Polyline positions={pts} pathOptions={{ color: day.color, weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }} />
            </div>
          )
        })}

        {PEAKS.map((peak) => {
          const inRoute = orderByPeak.get(peak.id)
          const dimmed = Boolean(selected) && !inRoute
          return (
            <Marker
              key={peak.id}
              position={[peak.lat, peak.lon]}
              zIndexOffset={dimmed ? 0 : 400}
              icon={peakIcon(progress[peak.id]?.status ?? 'todo', peak.no, {
                order: inRoute?.order,
                dayColor: inRoute?.color,
                dimmed,
              })}
            >
              <Popup>
                <div className="min-w-40">
                  <div className="font-semibold">{peak.name}</div>
                  <div className="text-xs text-muted">
                    {peak.ele} m n.p.m.
                    {inRoute && ` · ${selected?.name}, punkt ${inRoute.order}`}
                  </div>
                  <button onClick={() => onOpenPeak(peak)} className="btn-primary mt-2 w-full !py-1.5 !text-xs">
                    Otwórz szczyt
                  </button>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {position && (
          <>
            <Circle
              center={[position.lat, position.lon]}
              radius={position.accuracy}
              pathOptions={{ color: '#1f6f8b', fillColor: '#1f6f8b', fillOpacity: 0.1, weight: 1 }}
            />
            <Marker position={[position.lat, position.lon]} icon={userIcon} />
          </>
        )}

        <FitToRoute points={fitPoints} token={`${selectedDayId ?? 'all'}:${plans.length}:${fitPoints.length}`} />
        <RecenterButton position={position} />
      </MapContainer>

      {/* Pasek dni nad mapą — jednocześnie legenda i filtr. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-2">
        {days.length > 0 ? (
          <div className="pointer-events-auto flex gap-1.5 overflow-x-auto no-scrollbar rounded-xl border border-line bg-surface/95 p-1.5 shadow-lg backdrop-blur">
            <button
              onClick={() => onSelectDay(null)}
              className={`chip shrink-0 !py-1.5 ${selectedDayId === null ? 'bg-brand text-onbrand' : 'bg-tint text-ink'}`}
            >
              Wszystkie
            </button>
            {days.map((day) => {
              const active = selectedDayId === day.id
              return (
                <button
                  key={day.id}
                  onClick={() => onSelectDay(day.id)}
                  className={`chip shrink-0 !py-1.5 ${active ? 'text-white' : 'bg-tint text-ink'}`}
                  style={active ? { background: day.color } : undefined}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: active ? '#fff' : day.color }}
                  />
                  {day.name}
                  <span className={active ? 'opacity-80' : 'text-muted'}>{day.peaks.length}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <button
            onClick={onGoToPlanner}
            className="pointer-events-auto flex w-full items-center gap-2 rounded-xl border border-line bg-surface/95 px-3 py-2.5 text-left text-xs text-ink shadow-lg backdrop-blur"
          >
            <IconRoute className="h-4 w-4 shrink-0 text-brand" />
            <span className="min-w-0 flex-1">
              Nie masz jeszcze planu — ułóż trasę, a pokaże się tutaj.
            </span>
            <span className="shrink-0 font-semibold text-brand">Plan →</span>
          </button>
        )}
      </div>

      {selected && <DaySummary day={selected} />}
    </div>
  )
}

interface SummaryDay {
  name: string
  color: string
  peaks: Peak[]
  officialDistanceKm?: number
  officialTime?: string
}

/**
 * Pasek pod mapą. Odsunięty od lewej, żeby nie wchodzić na kontrolkę warstw,
 * i od dołu, żeby nie zasłaniać atrybucji OpenStreetMap.
 */
function DaySummary({ day }: { day: SummaryDay }) {
  const stats = estimateDay(day.peaks)
  const distance = day.officialDistanceKm
    ? `${day.officialDistanceKm.toLocaleString('pl-PL', { minimumFractionDigits: 1 })} km`
    : `~${stats.distanceKm.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} km`
  const time = day.officialTime ?? `~${formatTime(stats.timeH)}`

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] pb-6 pl-14 pr-2">
      <div className="pointer-events-auto flex items-center gap-2 overflow-x-auto no-scrollbar rounded-xl border border-line bg-surface/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: day.color }} />
        <span className="shrink-0 font-semibold">{day.name}</span>
        <span className="shrink-0 text-muted">
          {day.peaks.length} {plural(day.peaks.length, ['szczyt', 'szczyty', 'szczytów'])}
        </span>
        <span className="shrink-0 tabular-nums">{distance}</span>
        <span className="shrink-0 tabular-nums">{time}</span>
        <span className="shrink-0 tabular-nums text-muted">↑&nbsp;{Math.round(stats.ascentM)}&nbsp;m</span>
      </div>
    </div>
  )
}

export { DAY_COLORS }
