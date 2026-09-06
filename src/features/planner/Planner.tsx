import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PEAKS, peakById } from '../../data/peaks'
import { ROUTE_PRESETS, START_POINTS } from '../../data/routes'
import { useProgress } from '../../store/progress'
import { estimateDay, formatTime } from '../../lib/geo'
import type { Peak } from '../../types'
import { ElevationProfile } from './ElevationProfile'
import { DAY_COLORS } from '../map/MapView'
import { Sheet } from '../../ui/Sheet'
import { IconCheck, IconMountain, IconTrash } from '../../ui/Icons'

export function Planner() {
  const { plans, activePresetId, loadPreset, addDay, removeDay, renameDay, setDayDate, setDayStart, assignPeak, movePeakInDay } =
    useProgress()
  const progress = useProgress((s) => s.progress)
  const [pickerDay, setPickerDay] = useState<string | null>(null)

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
              const stats = estimateDay(dayPeaks)
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
                      <input
                        list="start-points"
                        className="field !py-2 !text-xs"
                        placeholder="Punkt startowy"
                        value={day.startPoint ?? ''}
                        onChange={(e) => setDayStart(day.id, e.target.value)}
                      />
                    </div>

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

                    <button onClick={() => setPickerDay(day.id)} className="btn-ghost w-full !py-2 !text-xs">
                      <IconMountain className="h-4 w-4" /> Dodaj szczyty
                    </button>

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
                            : 'Wartości szacunkowe (linia prosta × 1,35, reguła Naismitha) — traktuj orientacyjnie.'}
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

      <datalist id="start-points">
        {START_POINTS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

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
