import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, LayersControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import { PEAKS } from '../../data/peaks'
import { useProgress } from '../../store/progress'
import type { Peak } from '../../types'
import { IconLocate } from '../../ui/Icons'

const BRENNA_CENTER: [number, number] = [49.7175, 18.9265]

/* Kolory dni: dwa pierwsze z palety organizatora, reszta dobrana tak,
   by dało się je rozróżnić na jasnych kafelkach OSM. */
const DAY_COLORS = ['#226b31', '#e26c3b', '#1f6f8b', '#8a4fbd', '#c99a2e', '#b03a48']

function peakIcon(status: string, no: number): L.DivIcon {
  const done = status === 'done'
  const planned = status === 'planned'
  const bg = done ? '#2f7d32' : planned ? '#c99a2e' : '#4f5e56'
  const ring = done ? '#e9f6e3' : planned ? '#fdf3d3' : '#e9eee8'
  const inner = done
    ? '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
    : `<span style="font:700 11px/1 ui-sans-serif,system-ui;color:#ffffff">${no}</span>`
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:${bg};border:2px solid ${ring};box-shadow:0 2px 8px rgba(20,49,31,.35)">${inner}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
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
      className="absolute right-3 top-3 z-[500] rounded-xl border border-line bg-surface p-2.5 text-ink shadow-lg backdrop-blur"
      aria-label="Wyśrodkuj na mojej pozycji"
    >
      <IconLocate className="h-5 w-5" />
    </button>
  )
}

interface Props {
  onOpenPeak: (peak: Peak) => void
  position: { lat: number; lon: number; accuracy: number } | null
  showPlanLines: boolean
}

export function MapView({ onOpenPeak, position, showPlanLines }: Props) {
  const progress = useProgress((s) => s.progress)
  const plans = useProgress((s) => s.plans)

  const lines = useMemo(() => {
    if (!showPlanLines) return []
    return plans
      .map((day, i) => ({
        id: day.id,
        name: day.name,
        color: DAY_COLORS[i % DAY_COLORS.length],
        points: day.peakIds
          .map((id) => PEAKS.find((p) => p.id === id))
          .filter((p): p is Peak => Boolean(p))
          .map((p) => [p.lat, p.lon] as [number, number]),
      }))
      .filter((l) => l.points.length > 1)
  }, [plans, showPlanLines])

  return (
    <MapContainer center={BRENNA_CENTER} zoom={12} className="h-full w-full" zoomControl={false}>
      <LayersControl position="bottomright">
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
            opacity={0.85}
          />
        </LayersControl.Overlay>
      </LayersControl>

      {lines.map((line) => (
        <Polyline
          key={line.id}
          positions={line.points}
          pathOptions={{ color: line.color, weight: 3.5, opacity: 0.85, dashArray: '1 8', lineCap: 'round' }}
        />
      ))}

      {PEAKS.map((peak) => (
        <Marker
          key={peak.id}
          position={[peak.lat, peak.lon]}
          icon={peakIcon(progress[peak.id]?.status ?? 'todo', peak.no)}
        >
          <Popup>
            <div className="min-w-40">
              <div className="font-semibold">{peak.name}</div>
              <div className="text-xs text-muted">{peak.ele} m n.p.m.</div>
              <button onClick={() => onOpenPeak(peak)} className="btn-primary mt-2 w-full !py-1.5 !text-xs">
                Otwórz szczyt
              </button>
            </div>
          </Popup>
        </Marker>
      ))}

      {position && (
        <>
          <Circle
            center={[position.lat, position.lon]}
            radius={position.accuracy}
            pathOptions={{ color: '#4cc4e0', fillColor: '#4cc4e0', fillOpacity: 0.1, weight: 1 }}
          />
          <Marker position={[position.lat, position.lon]} icon={userIcon} />
        </>
      )}

      <RecenterButton position={position} />
    </MapContainer>
  )
}

export { DAY_COLORS }
