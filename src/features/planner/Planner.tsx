import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PEAKS, peakById } from '../../data/peaks'
import { ROUTE_PRESETS } from '../../data/routes'
import { START_POINTS, startPointById } from '../../data/startPoints'
import { generatePlan } from '../../lib/planGenerator'
import { useProgress } from '../../store/progress'
import { TERRAIN_FACTOR, estimateDay, formatTime, plural } from '../../lib/geo'
import type { Peak } from '../../types'
import { ElevationProfile } from './ElevationProfile'
import { DAY_COLORS } from '../map/MapView'
import { Sheet } from '../../ui/Sheet'
import { IconCheck, IconMap, IconMountain, IconRoute, IconTrash } from '../../ui/Icons'

interface Props {
  onShowDayOnMap: (dayId: string) => void
}

export function Planner({ onShowDayOnMap }: Props) {
  const {
    plans, activePresetId, loadPreset, addDay, removeDay, renameDay, setDayDate,
    setDayStartPoint, toggleDayLoop, assignPeak, movePeakInDay, loadGenerated,
  } = useProgress()
  const progress = useProgress((s) => s.progress)
  const [pickerDay, setPickerDay] = useState<string | null>(null)
  const [genDays, setGenDays] = useState(3)
  const generated = useMemo(() => generatePlan(genDays), [genDays])

  const assigned = useMemo(() => new Set(plans.flatMap((d) => d.peakIds)), [plans])
  const unassigned = PEAKS.filter((p) => !assigned.has(p.id))

  return (
    <div className="space-y-4">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-soft">Gotowe warianty</h2>
        <div className="grid grid-cols-2 gap-2">
          {ROUTE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => loadPreset(preset.id, preset.plans)}
              className={`card px-3 py-3 text-left transition ${
                activePresetId === preset.id ? 'border-brand bg-brand-soft' : 'hover:bg-tint-strong'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{preset.name}</span>
                {activePresetId === preset.id && <IconCheck className="h-4 w-4 text-brand" />}
              </div>
              <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-muted">{preset.description}</p>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Wczytanie wariantu nadpisuje plan dni, ale nie rusza zaliczonych szczytów.
        </p>
      </section>

      <section className="card px-4 py-4">
        <h2 className="text-sm font-semibold">Ułóż plan pod siebie</h2>
        <p className="mt-1 text-xs text-muted">
          Propozycje gminy dzielą szczyty tak, jak wygodnie było je opisać. Ten generator zakłada, że
          zostawiasz samochód na parkingu i musisz po niego wrócić — każdy dzień układa jako pętlę,
          dobiera najbliższy parking z listy gminy i skraca kolejność przejścia.
        </p>

        <div className="mt-3">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-xs font-medium text-muted">Liczba dni</span>
            <span className="text-sm font-semibold tabular-nums">{genDays}</span>
          </div>
          <input
            type="range"
            min={1}
            max={8}
            value={genDays}
            onChange={(e) => setGenDays(Number(e.target.value))}
            className="w-full accent-[var(--s-brand)]"
            aria-label="Liczba dni w generowanym planie"
          />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="dystans" value={`~${generated.totalKm.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} km`} />
          <Stat label="podejścia" value={`~${Math.round(generated.totalAscentM).toLocaleString('pl-PL')} m`} />
          <Stat label="najdłuższy dzień" value={`~${formatTime(generated.longestDayH)}`} />
        </div>

        <ol className="mt-3 space-y-1.5">
          {generated.days.map((day) => {
            const sp = startPointById(day.startPointId)
            return (
              <li key={day.id} className="rounded-lg bg-tint px-3 py-2 text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{day.name}</span>
                  <span className="text-muted">
                    {day.peakIds.length} {plural(day.peakIds.length, ['szczyt', 'szczyty', 'szczytów'])}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-muted">⭮ {sp?.name}</div>
                <div className="truncate">{day.peakIds.map((id) => peakById(id)?.name).join(' → ')}</div>
              </li>
            )
          })}
        </ol>

        <button onClick={() => loadGenerated(generated.days)} className="btn-primary mt-3 w-full">
          <IconRoute className="h-4 w-4" /> Wczytaj ten plan
        </button>
        <p className="mt-2 text-[10px] text-muted">
          Podział liczony po linii prostej, nie po przebiegu szlaków — przed wyjazdem sprawdź trasę na mapie.
        </p>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-soft">Twój plan</h2>
          <button onClick={addDay} className="btn-ghost !min-h-0 !py-1.5 !text-xs">
            + dzień
          </button>
        </div>

        {plans.length === 0 && (
          <p className="card px-4 py-6 text-center text-sm text-muted">
            Wybierz gotowy wariant powyżej albo dodaj własny dzień.
          </p>
        )}

        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {plans.map((day, i) => {
              const dayPeaks = day.peakIds.map(peakById).filter((p): p is Peak => Boolean(p))
              const start = startPointById(day.startPointId)
              const isLoop = day.loop !== false
              const stats = estimateDay(dayPeaks, start ? { start, loop: isLoop } : {})
              const color = DAY_COLORS[i % DAY_COLORS.length]
              const donePeaks = dayPeaks.filter((p) => progress[p.id]?.status === 'done').length

              return (
                <motion.div
                  key={day.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="card overflow-hidden"
                >
                  <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
                    <input
                      value={day.name}
                      onChange={(e) => renameDay(day.id, e.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                      aria-label="Nazwa dnia"
                    />
                    <span className="chip bg-tint text-muted">
                      {donePeaks}/{dayPeaks.length}
                    </span>
                    <button
                      onClick={() => removeDay(day.id)}
                      aria-label={`Usuń ${day.name}`}
                      className="!min-h-0 rounded-lg p-1.5 text-muted hover:text-red-400"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-2 px-3 py-3">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        className="field !py-2 !text-xs"
                        value={day.date ?? ''}
                        onChange={(e) => setDayDate(day.id, e.target.value || undefined)}
                      />
                      <button
                        onClick={() => toggleDayLoop(day.id)}
                        className={`btn !py-2 !text-xs ${isLoop ? 'bg-brand-soft text-brand' : 'border border-line bg-surface text-ink'}`}
                        title={isLoop ? 'Wracasz na miejsce startu' : 'Kończysz w innym miejscu'}
                      >
                        {isLoop ? '⭮ Pętla' : '→ Punkt-punkt'}
                      </button>
                    </div>

                    <select
                      className="field !py-2 !text-xs"
                      value={day.startPointId ?? ''}
                      onChange={(e) => setDayStartPoint(day.id, e.target.value || undefined)}
                      aria-label="Punkt startowy"
                    >
                      <option value="">— wybierz parking / punkt startowy —</option>
                      {START_POINTS.map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.name}
                        </option>
                      ))}
                    </select>
                    {start?.detail && <p className="text-[10px] text-muted">{start.detail}</p>}

                    {dayPeaks.length > 0 ? (
                      <ol className="space-y-1">
                        {dayPeaks.map((peak, idx) => {
                          const done = progress[peak.id]?.status === 'done'
                          return (
                            <li
                              key={peak.id}
                              className="flex items-center gap-2 rounded-lg bg-tint px-2 py-1.5 text-sm"
                            >
                              <span className={`w-4 shrink-0 text-center text-xs ${done ? 'text-done' : 'text-muted'}`}>
                                {done ? '✓' : idx + 1}
                              </span>
                              <span className={`min-w-0 flex-1 truncate ${done ? 'text-done' : ''}`}>
                                {peak.name}
                              </span>
                              <span className="shrink-0 text-xs tabular-nums text-muted">{peak.ele} m</span>
                              <span className="flex shrink-0">
                                <button
                                  onClick={() => movePeakInDay(day.id, peak.id, -1)}
                                  disabled={idx === 0}
                                  aria-label="W górę"
                                  className="!min-h-0 px-1 text-muted disabled:opacity-25"
                                >
                                  ↑
                                </button>
                                <button
                                  onClick={() => movePeakInDay(day.id, peak.id, 1)}
                                  disabled={idx === dayPeaks.length - 1}
                                  aria-label="W dół"
                                  className="!min-h-0 px-1 text-muted disabled:opacity-25"
                                >
                                  ↓
                                </button>
                                <button
                                  onClick={() => assignPeak(peak.id, null)}
                                  aria-label="Usuń z dnia"
                                  className="!min-h-0 px-1 text-muted hover:text-red-400"
                                >
                                  ×
                                </button>
                              </span>
                            </li>
                          )
                        })}
                      </ol>
                    ) : (
                      <p className="py-2 text-center text-xs text-muted">Brak szczytów w tym dniu.</p>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setPickerDay(day.id)} className="btn-ghost !py-2 !text-xs">
                        <IconMountain className="h-4 w-4" /> Dodaj szczyty
                      </button>
                      <button
                        onClick={() => onShowDayOnMap(day.id)}
                        disabled={dayPeaks.length === 0}
                        className="btn-ghost !py-2 !text-xs"
                      >
                        <IconMap className="h-4 w-4" /> Na mapie
                      </button>
                    </div>

                    {dayPeaks.length > 0 && (
                      <>
                        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                          <Stat
                            label="dystans"
                            value={day.officialDistanceKm ? `${day.officialDistanceKm} km` : `~${stats.distanceKm.toFixed(1)} km`}
                          />
                          <Stat label="podejścia" value={`~${Math.round(stats.ascentM)} m`} />
                          <Stat label="czas" value={day.officialTime ?? `~${formatTime(stats.timeH)}`} />
                        </div>
                        <ElevationProfile peaks={dayPeaks} color={color} />
                        <p className="text-[10px] text-muted">
                          {day.officialDistanceKm
                            ? 'Dystans i czas z materiałów gminy Brenna.'
                            : stats.fromStartPoint
                              ? `Szacunek dla ${isLoop ? 'pętli z powrotem na start' : 'trasy bez powrotu na start'} — linia prosta × ${TERRAIN_FACTOR.toLocaleString('pl-PL')}, reguła Naismitha, kalibrowane na danych gminy.`
                              : 'Szacunek bez punktu startowego — wybierz parking, żeby policzyć dojście i powrót.'}
                        </p>
                      </>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {unassigned.length > 0 && plans.length > 0 && (
          <p className="mt-3 rounded-xl bg-warn-soft px-3 py-2.5 text-xs text-warn">
            Poza planem {unassigned.length === 1 ? 'został' : 'zostało'} {unassigned.length}{' '}
            {unassigned.length === 1 ? 'szczyt' : 'szczytów'}: {unassigned.map((p) => p.name).join(', ')}.
          </p>
        )}
      </section>

      <Sheet open={pickerDay !== null} onClose={() => setPickerDay(null)} title="Dodaj szczyty do dnia">
        <div className="space-y-1.5">
          {PEAKS.map((peak) => {
            const inThisDay = plans.find((d) => d.id === pickerDay)?.peakIds.includes(peak.id)
            const otherDay = plans.find((d) => d.id !== pickerDay && d.peakIds.includes(peak.id))
            return (
              <button
                key={peak.id}
                onClick={() => assignPeak(peak.id, inThisDay ? null : pickerDay)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                  inThisDay ? 'border-brand bg-brand-soft' : 'border-line bg-tint hover:bg-tint-strong'
                }`}
              >
                <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted">{peak.no}</span>
                <span className="min-w-0 flex-1 truncate">{peak.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted">{peak.ele} m</span>
                {otherDay && <span className="chip shrink-0 bg-tint-strong text-[10px] text-muted">{otherDay.name}</span>}
                {inThisDay && <IconCheck className="h-4 w-4 shrink-0 text-brand" />}
              </button>
            )
          })}
        </div>
      </Sheet>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-tint px-2 py-1.5">
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  )
}
