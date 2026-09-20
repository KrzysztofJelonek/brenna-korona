import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MapContainer, TileLayer, Marker, Popup, Polyline, Circle, LayersControl, useMap, useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import { PEAKS, peakById } from '../../data/peaks'
import { estimateDay, formatDistance, formatTime, haversine, plural, type Stop } from '../../lib/geo'
import { START_POINTS, startPointById, type StartPoint } from '../../data/startPoints'
import { useDayRoute } from '../../lib/useDayRoute'
import { customParkingName, resolveToday, waypointName, waypointStopId, type ResolvedToday } from '../../lib/todayRoute'
import { elevationAt, loadGrid } from '../../lib/elevation'
import { useProgress, type ParkingRole } from '../../store/progress'
import type { CustomParking, ParkingRef, Peak, TodayPlan, TrackPoint, Waypoint } from '../../types'
import { IconLocate, IconMountain, IconPin, IconRoute, IconTrash } from '../../ui/Icons'

const BRENNA_CENTER: [number, number] = [49.7175, 18.9265]

/* Kolory dni: dwa pierwsze z palety organizatora, reszta dobrana tak,
   by dało się je rozróżnić na jasnych kafelkach OSM. */
const DAY_COLORS = ['#226b31', '#e26c3b', '#1f6f8b', '#8a4fbd', '#c99a2e', '#b03a48']

/** Wartość selectedDayId oznaczająca tryb układania trasy na dziś. */
export const TODAY_ID = 'today'
const TODAY_COLOR = DAY_COLORS[0]

/** Nagrany ślad — kolor spoza palety dni, żeby nie mylił się z planowaną trasą. */
const TRACK_COLOR = '#c0368a'

/** Dalej od Brennej pozycja nie wciąga widoku wybranej trasy — mapa oddaliłaby się do kraju. */
const NEAR_BRENNA_M = 20_000

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

/** Rola parkingu w trasie: start, meta, jedno i drugie (pętla) albo nic. */
type MarkerRole = ParkingRole | 'loop' | null

/** Co właśnie wskazujemy na mapie. */
type PlaceMode = ParkingRole | 'via'

const ROLE_LABEL: Record<'start' | 'finish' | 'loop', string> = { start: 'S', finish: 'M', loop: '↻' }

/** Marker parkingu; bez roli to parking do wyboru, jeszcze nie w trasie. */
const parkingIcon = (color: string, role: MarkerRole = null) => {
  const muted = role === null
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:7px;background:#fff;border:3px solid ${muted ? '#8fa596' : color};box-shadow:0 2px 8px rgba(20,49,31,.35);font:800 12px/1 ui-sans-serif,system-ui;color:${muted ? '#5f6c61' : color};opacity:${muted ? 0.85 : 1}">${role ? ROLE_LABEL[role] : 'P'}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  })
}

/** Punkt pośredni — okrąg z numerem kolejności, odróżnialny od szczytu i parkingu. */
const viaIcon = (color: string, order?: number) =>
  L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#fff;border:3px solid ${color};box-shadow:0 2px 8px rgba(20,49,31,.35);font:800 11px/1 ui-sans-serif,system-ui;color:${color}">${order ?? '•'}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -13],
  })

/** Podpis roli pod nazwą parkingu. */
const roleName = (role: MarkerRole) =>
  role === 'loop' ? 'start i meta' : role === 'start' ? 'start trasy' : role === 'finish' ? 'meta trasy' : null

/** Wybór końca trasy w dymku parkingu — jedno dotknięcie na każdą rolę. */
function ParkingRoleButtons({ role, onPick }: { role: MarkerRole; onPick: (role: ParkingRole) => void }) {
  const isStart = role === 'start' || role === 'loop'
  const isFinish = role === 'finish' || role === 'loop'
  return (
    <div className="mt-2 flex gap-1.5">
      {/* type="button": dymek własnego miejsca to formularz z nazwą. */}
      <button
        type="button"
        onClick={() => onPick('start')}
        className={`flex-1 !py-1.5 !text-xs ${isStart ? 'btn-primary' : 'btn-ghost'}`}
      >
        Start stąd
      </button>
      <button
        type="button"
        onClick={() => onPick('finish')}
        className={`flex-1 !py-1.5 !text-xs ${isFinish ? 'btn-primary' : 'btn-ghost'}`}
      >
        Meta tutaj
      </button>
    </div>
  )
}

const userIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#1f6f8b;border:3px solid #fff;box-shadow:0 0 0 4px rgba(31,111,139,.3)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

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

/** Dotknięcie mapy stawia parking. Aktywne tylko na czas wskazywania. */
function PlaceOnClick({ onPlace }: { onPlace: (lat: number, lon: number) => void }) {
  const map = useMapEvents({ click: (e) => onPlace(e.latlng.lat, e.latlng.lng) })
  useEffect(() => {
    const el = map.getContainer()
    el.style.cursor = 'crosshair'
    return () => {
      el.style.cursor = ''
    }
  }, [map])
  return null
}

/**
 * Pierwsza pozycja po wejściu na mapę (albo po włączeniu lokalizacji) ustawia widok.
 * Bez wybranej trasy centrujemy na użytkowniku; z trasą dopasowujemy widok tak,
 * żeby było widać i trasę, i pozycję. Dalsze odczyty już widoku nie ruszają.
 */
function CenterOnPosition({
  position,
  routePoints,
}: {
  position: { lat: number; lon: number } | null
  routePoints: [number, number][] | null
}) {
  const map = useMap()
  const centered = useRef(false)

  useEffect(() => {
    if (!position) {
      centered.current = false
      return
    }
    if (centered.current) return
    centered.current = true

    const here: [number, number] = [position.lat, position.lon]
    if (!routePoints) {
      map.setView(here, Math.max(map.getZoom(), 14))
      return
    }
    if (haversine(BRENNA_CENTER[0], BRENNA_CENTER[1], here[0], here[1]) > NEAR_BRENNA_M) return
    map.fitBounds(L.latLngBounds([...routePoints, here]), { padding: [56, 56], maxZoom: 15 })
  }, [map, position, routePoints])

  return null
}

interface Props {
  onOpenPeak: (peak: Peak) => void
  position: { lat: number; lon: number; accuracy: number } | null
  selectedDayId: string | null
  onSelectDay: (id: string | null) => void
  onGoToPlanner: () => void
  geoOn: boolean
  onEnableGeo: () => void
  track: TrackPoint[]
  recording: boolean
}

export function MapView({
  onOpenPeak,
  position,
  selectedDayId,
  onSelectDay,
  onGoToPlanner,
  geoOn,
  onEnableGeo,
  track,
  recording,
}: Props) {
  const progress = useProgress((s) => s.progress)
  const plans = useProgress((s) => s.plans)
  const today = useProgress((s) => s.today)
  const toggleTodayPeak = useProgress((s) => s.toggleTodayPeak)
  const setTodayParking = useProgress((s) => s.setTodayParking)
  const setTodayFinish = useProgress((s) => s.setTodayFinish)
  const customParkings = useProgress((s) => s.customParkings)
  const addCustomParking = useProgress((s) => s.addCustomParking)
  const addTodayWaypoint = useProgress((s) => s.addTodayWaypoint)
  const updateTodayWaypoint = useProgress((s) => s.updateTodayWaypoint)
  const updateCustomParking = useProgress((s) => s.updateCustomParking)

  const [map, setMap] = useState<L.Map | null>(null)
  const todayMode = selectedDayId === TODAY_ID
  /** Wskazywanie miejsca na mapie — i od razu wiadomo, na który koniec trasy. */
  const [placing, setPlacing] = useState<PlaceMode | null>(null)
  /** Świeżo wskazane miejsce — otwieramy jego dymek, żeby od razu dało się wpisać nazwę. */
  const [openSpotId, setOpenSpotId] = useState<string | null>(null)
  useEffect(() => {
    if (!todayMode) setPlacing(null)
  }, [todayMode])

  const days = useMemo(
    () =>
      plans.map((day, i) => ({
        id: day.id,
        name: day.name,
        color: DAY_COLORS[i % DAY_COLORS.length],
        stops: day.peakIds.map(peakById).filter((p): p is Peak => Boolean(p)),
        officialDistanceKm: day.officialDistanceKm,
        officialTime: day.officialTime,
        start: startPointById(day.startPointId),
        // Dni z planu są pętlami albo kończą się na szczycie — osobnej mety nie mają.
        finish: day.loop !== false ? startPointById(day.startPointId) : undefined,
      })),
    [plans],
  )

  const resolved = useMemo(() => resolveToday(today, customParkings), [today, customParkings])
  const todayDay = useMemo(
    () => ({
      id: TODAY_ID,
      name: 'Na dziś',
      color: TODAY_COLOR,
      stops: resolved.stops,
      start: resolved.start,
      finish: resolved.finish,
    }),
    [resolved],
  )

  const selected = todayMode ? todayDay : (days.find((d) => d.id === selectedDayId) ?? null)
  const shown = selected ? [selected] : days

  /** Numer kolejności i kolor dnia — tylko gdy patrzymy na jeden dzień.
      Numerujemy wszystkie przystanki, żeby mapa zgadzała się z listą w panelu. */
  const orderByStop = useMemo(() => {
    const map = new Map<string, { order: number; color: string }>()
    if (selected) {
      selected.stops.forEach((p, i) => map.set(p.id, { order: i + 1, color: selected.color }))
    }
    return map
  }, [selected])

  const fitPoints = useMemo<[number, number][]>(
    () =>
      shown.flatMap((d) => [
        ...(d.start ? [[d.start.lat, d.start.lon] as [number, number]] : []),
        ...d.stops.map((p) => [p.lat, p.lon] as [number, number]),
        ...(d.finish ? [[d.finish.lat, d.finish.lon] as [number, number]] : []),
      ]),
    [shown],
  )
  // Przy układaniu trasy widok dopasowujemy tylko przy wejściu w tryb —
  // skakanie mapy po każdym dotknięciu szczytu uniemożliwiałoby wybieranie.
  const fitToken = todayMode ? TODAY_ID : `${selectedDayId ?? 'all'}:${plans.length}:${fitPoints.length}`

  const trackPoints = useMemo(() => track.map((p) => [p.lat, p.lon] as [number, number]), [track])
  const trackM = useMemo(
    () => track.reduce((sum, p, i) => (i ? sum + haversine(track[i - 1].lat, track[i - 1].lon, p.lat, p.lon) : 0), 0),
    [track],
  )

  /** Wskazane miejsce: parking na start/metę albo punkt pośredni trasy. */
  const placePoint = (lat: number, lon: number) => {
    const mode = placing ?? 'start'
    setPlacing(null)
    loadGrid().then((grid) => {
      const spot = { lat, lon, ele: Math.round(elevationAt(grid, lat, lon)) }
      setOpenSpotId(mode === 'via' ? addTodayWaypoint(spot) : addCustomParking(spot, mode))
    })
  }

  const moveWaypoint = (id: string, lat: number, lon: number) =>
    loadGrid().then((grid) => updateTodayWaypoint(id, { lat, lon, ele: Math.round(elevationAt(grid, lat, lon)) }))

  /** Rola parkingu w dzisiejszej trasie — ten sam punkt może być i startem, i metą. */
  const roleOf = (isPoint: (id: string) => boolean): MarkerRole => {
    const start = Boolean(resolved.start && isPoint(resolved.start.id))
    const finish = Boolean(resolved.finish && isPoint(resolved.finish.id))
    return start && finish ? 'loop' : start ? 'start' : finish ? 'finish' : null
  }

  const moveParking = (id: string, lat: number, lon: number) =>
    loadGrid().then((grid) => updateCustomParking(id, { lat, lon, ele: Math.round(elevationAt(grid, lat, lon)) }))

  return (
    <div className="map-shell relative h-full w-full overflow-hidden">
      <MapContainer ref={setMap} center={BRENNA_CENTER} zoom={12} className="h-full w-full" zoomControl={false}>
        <LayersControl position="topright">
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

        {shown.map((day) => (
          <DayTrack key={day.id} day={day} />
        ))}

        {trackPoints.length >= 2 && (
          <>
            <Polyline positions={trackPoints} pathOptions={{ color: '#ffffff', weight: 7, opacity: 0.8, lineCap: 'round', lineJoin: 'round' }} />
            <Polyline positions={trackPoints} pathOptions={{ color: TRACK_COLOR, weight: 3.5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }} />
          </>
        )}

        {todayMode ? (
          <>
            {/* Wszystkie parkingi gminy — dymek wybiera, czy to start, czy meta. */}
            {START_POINTS.map((sp) => {
              const role = roleOf((id) => id === sp.id)
              return (
                <Marker
                  key={`today-start-${sp.id}`}
                  position={[sp.lat, sp.lon]}
                  icon={parkingIcon(TODAY_COLOR, role)}
                  zIndexOffset={role ? 600 : 300}
                  title={sp.name}
                >
                  <Popup>
                    <div className="min-w-52">
                      <div className="font-semibold">{sp.name}</div>
                      <div className="text-xs text-muted">
                        {sp.ele} m n.p.m.
                        {roleName(role) && ` · ${roleName(role)}`}
                      </div>
                      {sp.detail && <div className="mt-1 text-xs text-muted">{sp.detail}</div>}
                      <ParkingRoleButtons
                        role={role}
                        onPick={(pick) =>
                          pick === 'start'
                            ? setTodayParking({ kind: 'point', id: sp.id })
                            : setTodayFinish({ kind: 'point', id: sp.id })
                        }
                      />
                    </div>
                  </Popup>
                </Marker>
              )
            })}
            {/* Zapisane własne miejsca — dotknięcie otwiera dymek z nazwą i wyborem roli. */}
            {customParkings.map((spot) => (
              <CustomParkingMarker
                key={spot.id}
                spot={spot}
                role={roleOf((id) => id.startsWith(`custom:${spot.id}:`))}
                autoOpen={openSpotId === spot.id}
                onOpened={() => setOpenSpotId(null)}
                onPick={(pick) =>
                  pick === 'start'
                    ? setTodayParking({ kind: 'custom', id: spot.id })
                    : setTodayFinish({ kind: 'custom', id: spot.id })
                }
                onMove={(lat, lon) => moveParking(spot.id, lat, lon)}
              />
            ))}
            {/* Punkty pośrednie — trasa musi przez nie przejść. */}
            {today.waypoints.map((spot) => (
              <WaypointMarker
                key={spot.id}
                spot={spot}
                order={orderByStop.get(waypointStopId(spot))?.order}
                autoOpen={openSpotId === spot.id}
                onOpened={() => setOpenSpotId(null)}
                onMove={(lat, lon) => moveWaypoint(spot.id, lat, lon)}
              />
            ))}
            {placing && <PlaceOnClick onPlace={placePoint} />}
          </>
        ) : (
          shown.map((day) =>
            day.start ? (
              <Marker
                key={`start-${day.id}`}
                position={[day.start.lat, day.start.lon]}
                icon={parkingIcon(day.color, day.finish ? 'loop' : 'start')}
                zIndexOffset={300}
              >
                <Popup>
                  <div className="min-w-40">
                    <div className="font-semibold">{day.start.name}</div>
                    <div className="text-xs text-muted">
                      Start {day.name} · {day.start.ele} m n.p.m.
                      {day.finish ? ' · powrót na to samo miejsce' : ' · bez powrotu na start'}
                    </div>
                    {day.start.detail && <div className="mt-1 text-xs text-muted">{day.start.detail}</div>}
                  </div>
                </Popup>
              </Marker>
            ) : null,
          )
        )}

        {PEAKS.map((peak) => {
          const inRoute = orderByStop.get(peak.id)
          const dimmed = Boolean(selected) && !inRoute && !todayMode
          const icon = peakIcon(progress[peak.id]?.status ?? 'todo', peak.no, {
            order: inRoute?.order,
            dayColor: inRoute?.color,
            dimmed,
          })

          // W trybie „na dziś” dotknięcie szczytu od razu dodaje go do trasy albo
          // z niej usuwa — bez dymka, żeby wybór zajmował jedno dotknięcie.
          if (todayMode) {
            return (
              <Marker
                key={`today-${peak.id}`}
                position={[peak.lat, peak.lon]}
                zIndexOffset={400}
                icon={icon}
                title={peak.name}
                eventHandlers={{ click: () => !placing && toggleTodayPeak(peak.id) }}
              />
            )
          }

          return (
            <Marker key={peak.id} position={[peak.lat, peak.lon]} zIndexOffset={dimmed ? 0 : 400} icon={icon}>
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
            <Marker position={[position.lat, position.lon]} icon={userIcon} zIndexOffset={1000} interactive={false} />
          </>
        )}

        <FitToRoute points={fitPoints} token={fitToken} />
        {/* Po FitToRoute — przy wejściu na mapę z gotową pozycją ma ostatnie słowo. */}
        <CenterOnPosition position={position} routePoints={selected ? fitPoints : null} />
      </MapContainer>

      {/* Pasek nad mapą — w planie legenda i filtr dni, przy układaniu trasy podpowiedź. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-2">
        <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar rounded-xl border border-line bg-surface/95 p-1.5 shadow-lg backdrop-blur">
          {todayMode ? (
            <>
              <button onClick={() => onSelectDay(null)} className="chip shrink-0 !py-1.5 bg-tint text-ink">
                ← Plan dni
              </button>
              <span className="min-w-0 flex-1 truncate px-1 text-xs text-muted">
                {placing === 'start'
                  ? 'Dotknij mapy tam, gdzie zaczynasz'
                  : placing === 'finish'
                    ? 'Dotknij mapy tam, gdzie kończysz trasę'
                    : placing === 'via'
                      ? 'Dotknij miejsca, przez które chcesz przejść'
                      : 'Dotknij szczytów, które chcesz dziś zaliczyć'}
              </span>
              {placing ? (
                <button onClick={() => setPlacing(null)} className="chip shrink-0 !py-1.5 bg-tint text-ink">
                  Anuluj
                </button>
              ) : (
                <button
                  onClick={() => setPlacing('via')}
                  className="chip shrink-0 border border-brand bg-brand-soft !py-1.5 text-brand"
                  title="Dołóż miejsce, przez które ma przejść trasa"
                >
                  <IconPin className="h-3.5 w-3.5" />
                  + punkt
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => onSelectDay(TODAY_ID)}
                className="chip shrink-0 border border-brand bg-brand-soft !py-1.5 text-brand"
              >
                <IconMountain className="h-3.5 w-3.5" />
                Na dziś
                {today.peakIds.length > 0 && <span className="opacity-80">{today.peakIds.length}</span>}
              </button>
              {days.length > 0 ? (
                <>
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
                        <span className={active ? 'opacity-80' : 'text-muted'}>{day.stops.length}</span>
                      </button>
                    )
                  })}
                </>
              ) : (
                <button onClick={onGoToPlanner} className="chip min-w-0 flex-1 bg-tint !py-1.5 text-ink">
                  <IconRoute className="h-3.5 w-3.5 shrink-0 text-brand" />
                  <span className="truncate">Brak planu dni</span>
                  <span className="ml-auto shrink-0 font-semibold text-brand">Plan →</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dół mapy: przycisk pozycji nad panelem, żeby panel go nie zasłaniał.
          Od dołu odstęp na atrybucję OpenStreetMap. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] flex flex-col items-end gap-2 px-2 pb-6">
        <div className="flex items-center gap-2">
          {(recording || trackPoints.length >= 2) && (
            <span className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-line bg-surface/95 px-2.5 py-2 text-xs shadow-lg backdrop-blur">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${recording ? 'animate-pulse' : ''}`}
                style={{ background: TRACK_COLOR }}
              />
              {recording ? 'Nagrywam' : 'Ślad'}
              <span className="tabular-nums text-muted">{formatDistance(trackM)}</span>
            </span>
          )}
          {map && (
            <button
              onClick={() => {
                if (position) map.flyTo([position.lat, position.lon], Math.max(map.getZoom(), 14), { duration: 0.8 })
                else if (!geoOn) onEnableGeo()
              }}
              className={`pointer-events-auto rounded-xl border border-line bg-surface p-2.5 shadow-lg ${
                geoOn ? 'text-brand' : 'text-ink'
              } ${geoOn && !position ? 'animate-pulse' : ''}`}
              aria-label={
                position ? 'Wyśrodkuj na mojej pozycji' : geoOn ? 'Szukam pozycji…' : 'Włącz lokalizację'
              }
              title={position ? 'Wyśrodkuj na mojej pozycji' : geoOn ? 'Szukam pozycji…' : 'Włącz lokalizację'}
            >
              <IconLocate className="h-5 w-5" />
            </button>
          )}
        </div>
        {todayMode ? (
          <TodayPanel
            today={resolved}
            placing={placing}
            onPlacingChange={setPlacing}
            onOpenPeak={onOpenPeak}
          />
        ) : (
          selected && <DaySummary day={selected} />
        )}
      </div>
    </div>
  )
}

interface SummaryDay {
  name: string
  color: string
  stops: Stop[]
  officialDistanceKm?: number
  officialTime?: string
  start?: StartPoint
  finish?: StartPoint
}

/** Pasek pod mapą z podsumowaniem wybranego dnia planu. */
function DaySummary({ day }: { day: SummaryDay }) {
  const { route: routed, loading } = useDayRoute(day.stops, day.start, day.finish)
  const stats = routed ?? estimateDay(day.stops, { start: day.start, finish: day.finish })
  const distance = day.officialDistanceKm
    ? `${day.officialDistanceKm.toLocaleString('pl-PL', { minimumFractionDigits: 1 })} km`
    : `${routed ? '' : '~'}${stats.distanceKm.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
  const time = day.officialTime ?? `${routed ? '' : '~'}${formatTime(stats.timeH)}`

  return (
    <div className="pointer-events-auto flex w-full items-center gap-2 overflow-x-auto no-scrollbar rounded-xl border border-line bg-surface/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: day.color }} />
      <span className="shrink-0 font-semibold">{day.name}</span>
      {loading && <span className="shrink-0 text-muted">liczę trasę…</span>}
      <span className="shrink-0 text-muted">
        {day.stops.length} {plural(day.stops.length, ['szczyt', 'szczyty', 'szczytów'])}
      </span>
      <span className="shrink-0 tabular-nums">{distance}</span>
      <span className="shrink-0 tabular-nums">{time}</span>
      <span className="shrink-0 tabular-nums text-muted">↑&nbsp;{Math.round(stats.ascentM)}&nbsp;m</span>
      {day.start && (
        <span className="shrink-0 text-muted" title={day.start.name}>
          {day.finish ? '↻ pętla' : '→ bez powrotu'}
        </span>
      )}
    </div>
  )
}

/** Parkingi do wyboru — te same na starcie i na mecie. */
function ParkingOptions({ customParkings }: { customParkings: CustomParking[] }) {
  return (
    <>
      <optgroup label="Parkingi gminy">
        {START_POINTS.map((sp) => (
          <option key={sp.id} value={sp.id}>
            {sp.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="Moje miejsca">
        {customParkings.map((spot) => (
          <option key={spot.id} value={`custom:${spot.id}`}>
            {customParkingName(spot)} · {spot.ele} m n.p.m.
          </option>
        ))}
        <option value="new">+ Nowe miejsce — wskaż na mapie</option>
      </optgroup>
    </>
  )
}

interface TodayPanelProps {
  today: ResolvedToday
  placing: PlaceMode | null
  onPlacingChange: (placing: PlaceMode | null) => void
  onOpenPeak: (peak: Peak) => void
}

/**
 * Panel trasy na dziś: podsumowanie liczone po szlakach, kolejność przejścia
 * i ustawienia — start, meta, kierunek.
 */
function TodayPanel({ today, placing, onPlacingChange, onOpenPeak }: TodayPanelProps) {
  const plan = useProgress((s) => s.today)
  const progress = useProgress((s) => s.progress)
  const toggleTodayPeak = useProgress((s) => s.toggleTodayPeak)
  const setTodayParking = useProgress((s) => s.setTodayParking)
  const setTodayFinish = useProgress((s) => s.setTodayFinish)
  const toggleTodayReversed = useProgress((s) => s.toggleTodayReversed)
  const removeTodayWaypoint = useProgress((s) => s.removeTodayWaypoint)
  const clearToday = useProgress((s) => s.clearToday)
  const customParkings = useProgress((s) => s.customParkings)

  const { stops, peaks, start, finish, loop, autoStart, canReverse } = today
  const { route: routed, loading } = useDayRoute(stops, start, finish)
  const stats = routed ?? estimateDay(stops, { start, finish })
  // Jeden przystanek bez parkingu to jeszcze nie trasa — nie ma skąd dokąd liczyć.
  const routable = stops.length + (start ? 1 : 0) + (loop ? 0 : finish ? 1 : 0) >= 2
  /** Trasa między dwoma autami — kierunek zmienia się zamianą końców. */
  const twoEnds = Boolean(start && finish && start.id !== finish.id)

  // Wartości list: id punktu gminy, `custom:<id>` dla własnego miejsca, `new` dla wskazywania nowego.
  const refValue = (ref: TodayPlan['parking'] | TodayPlan['finish']) =>
    ref.kind === 'point' ? ref.id : ref.kind === 'custom' ? `custom:${ref.id}` : ref.kind

  const pickedRef = (value: string): ParkingRef | null =>
    value.startsWith('custom:')
      ? { kind: 'custom', id: value.slice('custom:'.length) }
      : { kind: 'point', id: value }

  const parkingValue = placing === 'start' ? 'new' : refValue(plan.parking)
  const onParkingChange = (value: string) => {
    if (value === 'new') {
      onPlacingChange('start')
      return
    }
    onPlacingChange(null)
    if (value === 'auto' || value === 'none') setTodayParking({ kind: value })
    else setTodayParking(pickedRef(value)!)
  }

  const finishValue = placing === 'finish' ? 'new' : refValue(plan.finish)
  const onFinishChange = (value: string) => {
    if (value === 'new') {
      onPlacingChange('finish')
      return
    }
    onPlacingChange(null)
    if (value === 'start' || value === 'none') setTodayFinish({ kind: value })
    else setTodayFinish(pickedRef(value)!)
  }

  return (
    <div className="pointer-events-auto w-full space-y-2 rounded-xl border border-line bg-surface/95 p-2 text-xs shadow-lg backdrop-blur">
      {stops.length === 0 ? (
        <p className="px-1 text-muted">
          Wybierz szczyty na mapie — po każdym wyborze ułożę kolejność i policzę trasę po szlakach.
        </p>
      ) : !routable ? (
        <p className="px-1 text-muted">Dodaj parking albo kolejny przystanek, żeby policzyć trasę.</p>
      ) : (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-1">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TODAY_COLOR }} />
          <span className="shrink-0 font-semibold">Na dziś</span>
          {loading && <span className="shrink-0 text-muted">liczę trasę…</span>}
          <span className="shrink-0 text-muted">
            {peaks.length} {plural(peaks.length, ['szczyt', 'szczyty', 'szczytów'])}
          </span>
          {stops.length > peaks.length && (
            <span className="shrink-0 text-muted">
              +{stops.length - peaks.length} {plural(stops.length - peaks.length, ['punkt', 'punkty', 'punktów'])}
            </span>
          )}
          <span className="shrink-0 tabular-nums">
            {routed ? '' : '~'}
            {stats.distanceKm.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km
          </span>
          <span className="shrink-0 tabular-nums">
            {routed ? '' : '~'}
            {formatTime(stats.timeH)}
          </span>
          <span className="shrink-0 tabular-nums text-muted">↑&nbsp;{Math.round(stats.ascentM)}&nbsp;m</span>
          {routed && routed.straightLegs > 0 && (
            <span className="shrink-0 text-warn">
              {routed.straightLegs} {plural(routed.straightLegs, ['odcinek', 'odcinki', 'odcinków'])} poza siecią
            </span>
          )}
        </div>
      )}

      {stops.length > 0 && (
        <ol className="flex items-center gap-1 overflow-x-auto no-scrollbar" aria-label="Kolejność przejścia">
          {start && (
            <li className="chip shrink-0 bg-tint font-bold text-brand" title={`Start: ${start.name}`}>
              S
            </li>
          )}
          {stops.map((stop, i) => {
            const peak = stop.peak
            const done = Boolean(peak) && progress[peak!.id]?.status === 'done'
            return (
              <li key={stop.id} className="flex shrink-0 items-center rounded-full bg-tint">
                <button
                  onClick={() => peak && onOpenPeak(peak)}
                  disabled={!peak}
                  className="!min-h-0 flex items-center gap-1 py-1.5 pl-2.5 pr-1 font-medium disabled:opacity-100"
                >
                  <span className="tabular-nums text-muted">{i + 1}</span>
                  {!peak && <IconPin className="h-3 w-3 text-brand" />}
                  <span className={done ? 'text-done' : !peak ? 'text-muted' : ''}>{stop.name}</span>
                  {done && <span className="text-done">✓</span>}
                </button>
                <button
                  onClick={() => (peak ? toggleTodayPeak(peak.id) : removeTodayWaypoint(stop.via!.id))}
                  aria-label={`Usuń ${stop.name} z trasy`}
                  className="!min-h-0 py-1.5 pl-1 pr-2.5 text-muted hover:text-red-400"
                >
                  ×
                </button>
              </li>
            )
          })}
          {finish && (
            <li className="chip shrink-0 bg-tint font-bold text-brand" title={`Meta: ${finish.name}`}>
              {loop ? '↻ S' : 'M'}
            </li>
          )}
        </ol>
      )}

      {/* Start i meta osobno — przy dwóch autach dzień kończy się na innym parkingu. */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="chip shrink-0 bg-tint font-bold text-brand" aria-hidden>
            S
          </span>
          <select
            className="field min-w-0 flex-1 !py-2 !text-xs"
            value={parkingValue}
            onChange={(e) => onParkingChange(e.target.value)}
            aria-label="Start trasy"
          >
            <option value="auto">
              {autoStart && start ? `Najbliższy: ${start.name}` : 'Najbliższy parking (automatycznie)'}
            </option>
            <ParkingOptions customParkings={customParkings} />
            <option value="none">Bez parkingu</option>
          </select>
          <button
            onClick={toggleTodayReversed}
            disabled={!canReverse}
            className={`btn shrink-0 !px-2.5 !py-2 !text-xs ${
              plan.reversed && canReverse ? 'bg-brand-soft text-brand' : 'border border-line bg-surface text-ink'
            }`}
            aria-label={twoEnds ? 'Zamień start z metą' : 'Odwróć kierunek przejścia'}
            title={twoEnds ? 'Zamień start z metą' : 'Odwróć kierunek'}
          >
            ⇄
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="chip shrink-0 bg-tint font-bold text-brand" aria-hidden>
            M
          </span>
          <select
            className="field min-w-0 flex-1 !py-2 !text-xs"
            value={finishValue}
            onChange={(e) => onFinishChange(e.target.value)}
            aria-label="Meta trasy"
          >
            <option value="start">{start ? `↻ Powrót na start: ${start.name}` : '↻ Powrót na start'}</option>
            <ParkingOptions customParkings={customParkings} />
            <option value="none">Koniec na ostatnim szczycie</option>
          </select>
          <button
            onClick={clearToday}
            disabled={plan.peakIds.length === 0 && plan.waypoints.length === 0}
            className="btn-ghost shrink-0 !px-2.5 !py-2"
            aria-label="Wyczyść trasę"
          >
            <IconTrash className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

interface WaypointMarkerProps {
  spot: Waypoint
  /** Numer w kolejności przejścia — ten sam, co na liście w panelu. */
  order?: number
  autoOpen: boolean
  onOpened: () => void
  onMove: (lat: number, lon: number) => void
}

/**
 * Punkt pośredni na mapie: miejsce, przez które trasa ma przejść, choćby leżało
 * poza szlakiem. Dymek pozwala je nazwać albo usunąć, marker da się przeciągnąć.
 */
function WaypointMarker({ spot, order, autoOpen, onOpened, onMove }: WaypointMarkerProps) {
  const updateTodayWaypoint = useProgress((s) => s.updateTodayWaypoint)
  const removeTodayWaypoint = useProgress((s) => s.removeTodayWaypoint)
  const markerRef = useRef<L.Marker | null>(null)
  const [name, setName] = useState(spot.name)
  useEffect(() => setName(spot.name), [spot.name])

  useEffect(() => {
    if (!autoOpen) return
    markerRef.current?.openPopup()
    onOpened()
  }, [autoOpen, onOpened])

  const title = `${waypointName(spot)} — przeciągnij, żeby przesunąć`
  useEffect(() => {
    markerRef.current?.getElement()?.setAttribute('title', title)
  }, [title])

  return (
    <Marker
      ref={markerRef}
      position={[spot.lat, spot.lon]}
      icon={viaIcon(TODAY_COLOR, order)}
      zIndexOffset={500}
      title={title}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const { lat, lng } = (e.target as L.Marker).getLatLng()
          onMove(lat, lng)
        },
      }}
    >
      <Popup>
        <form
          className="min-w-52 space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            updateTodayWaypoint(spot.id, { name: name.trim() })
            markerRef.current?.closePopup()
          }}
        >
          <div>
            <div className="font-semibold">{waypointName(spot)}</div>
            <div className="text-xs text-muted">
              {spot.ele} m n.p.m. · punkt pośredni{order ? ` · ${order}. w kolejności` : ''}
            </div>
          </div>
          <input
            className="field !py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nazwa lub opis, np. przejście przez potok"
            aria-label="Nazwa punktu"
            maxLength={60}
          />
          <div className="flex gap-1.5">
            <button type="submit" disabled={name.trim() === spot.name} className="btn-primary flex-1 !py-1.5 !text-xs">
              Zapisz
            </button>
            <button
              type="button"
              onClick={() => removeTodayWaypoint(spot.id)}
              className="btn-ghost shrink-0 !px-2.5 !py-1.5 !text-xs text-warn"
            >
              <IconTrash className="h-4 w-4" />
              Usuń
            </button>
          </div>
        </form>
      </Popup>
    </Marker>
  )
}

interface CustomParkingMarkerProps {
  spot: CustomParking
  /** Rola miejsca w dzisiejszej trasie. */
  role: MarkerRole
  /** Otwórz dymek od razu po pojawieniu się markera. */
  autoOpen: boolean
  onOpened: () => void
  onPick: (role: ParkingRole) => void
  onMove: (lat: number, lon: number) => void
}

/**
 * Własne miejsce na mapie. Dotknięcie otwiera dymek, w którym ustawia się je
 * jako start albo metę, nadaje nazwę albo usuwa z listy. Marker da się przeciągnąć.
 */
function CustomParkingMarker({ spot, role, autoOpen, onOpened, onPick, onMove }: CustomParkingMarkerProps) {
  const updateCustomParking = useProgress((s) => s.updateCustomParking)
  const removeCustomParking = useProgress((s) => s.removeCustomParking)
  const markerRef = useRef<L.Marker | null>(null)
  const [name, setName] = useState(spot.name)
  useEffect(() => setName(spot.name), [spot.name])

  useEffect(() => {
    if (!autoOpen) return
    markerRef.current?.openPopup()
    onOpened()
  }, [autoOpen, onOpened])

  // Leaflet ustawia `title` tylko przy tworzeniu markera — po zmianie nazwy odświeżamy go sami.
  const title = `${customParkingName(spot)} — przeciągnij, żeby przesunąć`
  useEffect(() => {
    markerRef.current?.getElement()?.setAttribute('title', title)
  }, [title])

  const save = () => {
    updateCustomParking(spot.id, { name: name.trim() })
    markerRef.current?.closePopup()
  }

  return (
    <Marker
      ref={markerRef}
      position={[spot.lat, spot.lon]}
      icon={parkingIcon(TODAY_COLOR, role)}
      zIndexOffset={role ? 600 : 350}
      title={title}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const { lat, lng } = (e.target as L.Marker).getLatLng()
          onMove(lat, lng)
        },
      }}
    >
      <Popup>
        <form
          className="min-w-52 space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <div>
            <div className="font-semibold">{customParkingName(spot)}</div>
            <div className="text-xs text-muted">
              {spot.ele} m n.p.m. · {roleName(role) ?? 'własne miejsce'}
            </div>
          </div>
          <ParkingRoleButtons role={role} onPick={onPick} />
          <input
            className="field !py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nazwa lub opis, np. pod kościołem"
            aria-label="Nazwa miejsca"
            maxLength={60}
          />
          <div className="flex gap-1.5">
            <button type="submit" disabled={name.trim() === spot.name} className="btn-primary flex-1 !py-1.5 !text-xs">
              Zapisz
            </button>
            <button
              type="button"
              onClick={() => removeCustomParking(spot.id)}
              className="btn-ghost shrink-0 !px-2.5 !py-1.5 !text-xs text-warn"
            >
              <IconTrash className="h-4 w-4" />
              Usuń
            </button>
          </div>
        </form>
      </Popup>
    </Marker>
  )
}

interface TrackDay {
  /** Przystanki w kolejności przejścia: szczyty i punkty pośrednie. */
  stops: Stop[]
  color: string
  start?: StartPoint
  finish?: StartPoint
}

/**
 * Trasa dnia poprowadzona po realnych ścieżkach z OSM. Do czasu policzenia
 * rysujemy przebieg orientacyjny, żeby mapa nie była pusta.
 */
function DayTrack({ day }: { day: TrackDay }) {
  const { route } = useDayRoute(day.stops, day.start, day.finish)

  const fallback: [number, number][] = [
    ...(day.start ? [[day.start.lat, day.start.lon] as [number, number]] : []),
    ...day.stops.map((p) => [p.lat, p.lon] as [number, number]),
    ...(day.finish ? [[day.finish.lat, day.finish.lon] as [number, number]] : []),
  ]
  const points = route?.points ?? fallback
  if (points.length < 2) return null

  return (
    <>
      {/* białe podłoże, żeby linia czytała się na każdym podkładzie */}
      <Polyline positions={points} pathOptions={{ color: '#ffffff', weight: 8, opacity: 0.75, lineCap: 'round', lineJoin: 'round' }} />
      <Polyline
        positions={points}
        pathOptions={{
          color: day.color,
          weight: 4,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: route ? undefined : '2 9',
        }}
      />
    </>
  )
}

export { DAY_COLORS }
