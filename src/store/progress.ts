import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AscentMode, CustomParking, DayPlan, PeakProgress, TodayFinish, TodayParking, TodayPlan, Waypoint,
} from '../types'
import { PEAKS } from '../data/peaks'

interface ProgressState {
  progress: Record<string, PeakProgress>
  plans: DayPlan[]
  activePresetId: string | null
  backupReminderAt: number
  today: TodayPlan
  customParkings: CustomParking[]

  toggleTodayPeak: (peakId: string) => void
  setTodayParking: (parking: TodayParking) => void
  setTodayFinish: (finish: TodayFinish) => void
  toggleTodayReversed: () => void
  clearToday: () => void

  /** Dokłada punkt pośredni dzisiejszej trasy; zwraca jego id. */
  addTodayWaypoint: (spot: Omit<Waypoint, 'id' | 'name'>) => string
  updateTodayWaypoint: (id: string, patch: Partial<Omit<Waypoint, 'id'>>) => void
  removeTodayWaypoint: (id: string) => void

  /** Zapisuje nowe własne miejsce i od razu wstawia je na wskazany koniec trasy; zwraca jego id. */
  addCustomParking: (spot: Omit<CustomParking, 'id' | 'name'>, role?: ParkingRole) => string
  updateCustomParking: (id: string, patch: Partial<Omit<CustomParking, 'id'>>) => void
  removeCustomParking: (id: string) => void

  toggleDone: (peakId: string) => void
  setStatus: (peakId: string, status: PeakProgress['status']) => void
  setConqueredAt: (peakId: string, iso: string | undefined) => void
  setAscentMode: (peakId: string, mode: AscentMode) => void
  setNote: (peakId: string, note: string) => void
  addPhotoId: (peakId: string, photoId: string) => void
  removePhotoId: (peakId: string, photoId: string) => void
  setPrimaryPhoto: (peakId: string, photoId: string) => void

  loadPreset: (presetId: string, plans: DayPlan[]) => void
  addDay: () => void
  removeDay: (dayId: string) => void
  renameDay: (dayId: string, name: string) => void
  setDayDate: (dayId: string, date: string | undefined) => void
  setDayStart: (dayId: string, start: string) => void
  setDayStartPoint: (dayId: string, startPointId: string | undefined) => void
  toggleDayLoop: (dayId: string) => void
  loadGenerated: (days: DayPlan[]) => void
  assignPeak: (peakId: string, dayId: string | null) => void
  movePeakInDay: (dayId: string, peakId: string, dir: -1 | 1) => void

  markBackup: () => void
  replaceState: (data: { progress: Record<string, PeakProgress>; plans: DayPlan[] }) => void
  resetAll: () => void
}

export const emptyProgress = (): PeakProgress => ({ status: 'todo', photoIds: [] })

const withPeak = (
  state: ProgressState,
  peakId: string,
  patch: (p: PeakProgress) => PeakProgress,
) => ({
  progress: {
    ...state.progress,
    [peakId]: patch(state.progress[peakId] ?? emptyProgress()),
  },
})

/** Który koniec trasy ustawia wskazane miejsce. */
export type ParkingRole = 'start' | 'finish'

const emptyToday = (): TodayPlan => ({
  peakIds: [],
  parking: { kind: 'auto' },
  finish: { kind: 'start' },
  waypoints: [],
  reversed: false,
})

let dayCounter = 0
const nextDayId = () => `day-${Date.now()}-${dayCounter++}`

let parkingCounter = 0
const nextParkingId = () => `parking-${Date.now()}-${parkingCounter++}`

let waypointCounter = 0
const nextWaypointId = () => `via-${Date.now()}-${waypointCounter++}`

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      progress: {},
      plans: [],
      activePresetId: null,
      backupReminderAt: 0,
      today: emptyToday(),
      customParkings: [],

      toggleTodayPeak: (peakId) =>
        set((s) => {
          const has = s.today.peakIds.includes(peakId)
          const peakIds = has ? s.today.peakIds.filter((id) => id !== peakId) : [...s.today.peakIds, peakId]
          return { today: { ...s.today, peakIds } }
        }),

      // Wybór startu kasuje zamianę kierunku — inaczej auto trafiłoby na metę.
      setTodayParking: (parking) => set((s) => ({ today: { ...s.today, parking, reversed: false } })),

      setTodayFinish: (finish) => set((s) => ({ today: { ...s.today, finish, reversed: false } })),

      toggleTodayReversed: () => set((s) => ({ today: { ...s.today, reversed: !s.today.reversed } })),

      // Parking i koniec trasy zostają — to raczej stały zwyczaj niż wybór na jeden dzień.
      // Punkty pośrednie należą do konkretnej trasy, więc znikają razem ze szczytami.
      clearToday: () =>
        set((s) => ({ today: { ...s.today, peakIds: [], waypoints: [], reversed: false } })),

      addTodayWaypoint: (spot) => {
        const id = nextWaypointId()
        set((s) => ({ today: { ...s.today, waypoints: [...s.today.waypoints, { ...spot, id, name: '' }] } }))
        return id
      },

      updateTodayWaypoint: (id, patch) =>
        set((s) => ({
          today: {
            ...s.today,
            waypoints: s.today.waypoints.map((w) => (w.id === id ? { ...w, ...patch } : w)),
          },
        })),

      removeTodayWaypoint: (id) =>
        set((s) => ({ today: { ...s.today, waypoints: s.today.waypoints.filter((w) => w.id !== id) } })),

      addCustomParking: (spot, role = 'start') => {
        const id = nextParkingId()
        set((s) => ({
          customParkings: [...s.customParkings, { ...spot, id, name: '' }],
          today: {
            ...s.today,
            ...(role === 'start' ? { parking: { kind: 'custom' as const, id } } : { finish: { kind: 'custom' as const, id } }),
            reversed: false,
          },
        }))
        return id
      },

      updateCustomParking: (id, patch) =>
        set((s) => ({ customParkings: s.customParkings.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

      // Usunięcie miejsca wybranego na dziś wraca do automatycznego doboru parkingu
      // (na starcie) albo do powrotu na start (na mecie).
      removeCustomParking: (id) =>
        set((s) => {
          const usedAsStart = s.today.parking.kind === 'custom' && s.today.parking.id === id
          const usedAsFinish = s.today.finish.kind === 'custom' && s.today.finish.id === id
          return {
            customParkings: s.customParkings.filter((p) => p.id !== id),
            today: {
              ...s.today,
              ...(usedAsStart ? { parking: { kind: 'auto' as const } } : {}),
              ...(usedAsFinish ? { finish: { kind: 'start' as const } } : {}),
            },
          }
        }),

      toggleDone: (peakId) =>
        set((s) =>
          withPeak(s, peakId, (p) =>
            p.status === 'done'
              ? { ...p, status: 'todo', conqueredAt: undefined }
              : { ...p, status: 'done', conqueredAt: p.conqueredAt ?? new Date().toISOString() },
          ),
        ),

      setStatus: (peakId, status) =>
        set((s) => withPeak(s, peakId, (p) => ({ ...p, status }))),

      setConqueredAt: (peakId, iso) =>
        set((s) => withPeak(s, peakId, (p) => ({ ...p, conqueredAt: iso }))),

      setAscentMode: (peakId, mode) =>
        set((s) => withPeak(s, peakId, (p) => ({ ...p, ascentMode: mode }))),

      setNote: (peakId, note) => set((s) => withPeak(s, peakId, (p) => ({ ...p, note }))),

      addPhotoId: (peakId, photoId) =>
        set((s) =>
          withPeak(s, peakId, (p) => ({
            ...p,
            photoIds: [...p.photoIds, photoId],
            primaryPhotoId: p.primaryPhotoId ?? photoId,
          })),
        ),

      removePhotoId: (peakId, photoId) =>
        set((s) =>
          withPeak(s, peakId, (p) => {
            const photoIds = p.photoIds.filter((id) => id !== photoId)
            return {
              ...p,
              photoIds,
              primaryPhotoId: p.primaryPhotoId === photoId ? photoIds[0] : p.primaryPhotoId,
            }
          }),
        ),

      setPrimaryPhoto: (peakId, photoId) =>
        set((s) => withPeak(s, peakId, (p) => ({ ...p, primaryPhotoId: photoId }))),

      loadPreset: (presetId, plans) =>
        set((s) => {
          const planned = new Set(plans.flatMap((d) => d.peakIds))
          const progress = { ...s.progress }
          for (const peak of PEAKS) {
            const cur = progress[peak.id] ?? emptyProgress()
            if (cur.status === 'done') continue
            progress[peak.id] = { ...cur, status: planned.has(peak.id) ? 'planned' : 'todo' }
          }
          return {
            activePresetId: presetId,
            plans: plans.map((d) => ({ ...d, id: nextDayId(), peakIds: [...d.peakIds] })),
            progress,
          }
        }),

      addDay: () =>
        set((s) => ({
          activePresetId: null,
          plans: [...s.plans, { id: nextDayId(), name: `Dzień ${s.plans.length + 1}`, peakIds: [] }],
        })),

      removeDay: (dayId) =>
        set((s) => ({ activePresetId: null, plans: s.plans.filter((d) => d.id !== dayId) })),

      renameDay: (dayId, name) =>
        set((s) => ({ plans: s.plans.map((d) => (d.id === dayId ? { ...d, name } : d)) })),

      setDayDate: (dayId, date) =>
        set((s) => ({ plans: s.plans.map((d) => (d.id === dayId ? { ...d, date } : d)) })),

      setDayStart: (dayId, startPoint) =>
        set((s) => ({ plans: s.plans.map((d) => (d.id === dayId ? { ...d, startPoint } : d)) })),

      setDayStartPoint: (dayId, startPointId) =>
        set((s) => ({ plans: s.plans.map((d) => (d.id === dayId ? { ...d, startPointId } : d)) })),

      toggleDayLoop: (dayId) =>
        set((s) => ({
          plans: s.plans.map((d) => (d.id === dayId ? { ...d, loop: d.loop === false } : d)),
        })),

      loadGenerated: (days) =>
        set((s) => {
          const planned = new Set(days.flatMap((d) => d.peakIds))
          const progress = { ...s.progress }
          for (const peak of PEAKS) {
            const cur = progress[peak.id] ?? emptyProgress()
            if (cur.status === 'done') continue
            progress[peak.id] = { ...cur, status: planned.has(peak.id) ? 'planned' : 'todo' }
          }
          return {
            activePresetId: null,
            plans: days.map((d) => ({ ...d, id: nextDayId(), peakIds: [...d.peakIds] })),
            progress,
          }
        }),

      assignPeak: (peakId, dayId) =>
        set((s) => {
          const plans = s.plans.map((d) => ({
            ...d,
            peakIds: d.peakIds.filter((id) => id !== peakId),
          }))
          if (dayId) {
            const target = plans.find((d) => d.id === dayId)
            if (target) target.peakIds = [...target.peakIds, peakId]
          }
          const cur = s.progress[peakId] ?? emptyProgress()
          const progress =
            cur.status === 'done'
              ? s.progress
              : { ...s.progress, [peakId]: { ...cur, status: dayId ? 'planned' : 'todo' } as PeakProgress }
          return { plans, progress, activePresetId: null }
        }),

      movePeakInDay: (dayId, peakId, dir) =>
        set((s) => ({
          plans: s.plans.map((d) => {
            if (d.id !== dayId) return d
            const idx = d.peakIds.indexOf(peakId)
            const next = idx + dir
            if (idx < 0 || next < 0 || next >= d.peakIds.length) return d
            const peakIds = [...d.peakIds]
            ;[peakIds[idx], peakIds[next]] = [peakIds[next], peakIds[idx]]
            return { ...d, peakIds }
          }),
        })),

      markBackup: () => set({ backupReminderAt: Date.now() }),

      replaceState: (data) =>
        set({ progress: data.progress, plans: data.plans, activePresetId: null }),

      resetAll: () =>
        set({
          progress: {},
          plans: [],
          activePresetId: null,
          backupReminderAt: 0,
          today: emptyToday(),
          customParkings: [],
        }),
    }),
    {
      name: 'kgb-progress',
      version: 3,
      migrate: (persisted, version) => {
        let state = persisted as ProgressState
        // v1 trzymała jedno własne miejsce wprost w parkingu na dziś — w v2 staje się pierwszym wpisem listy.
        const parking = state.today?.parking as
          | TodayParking
          | { kind: 'custom'; lat: number; lon: number; ele: number }
          | undefined
        if (version < 2 && parking?.kind === 'custom' && 'lat' in parking) {
          const id = nextParkingId()
          state = {
            ...state,
            customParkings: [{ id, name: '', lat: parking.lat, lon: parking.lon, ele: parking.ele }],
            today: { ...state.today, parking: { kind: 'custom', id } },
          }
        }
        // v2 miała tylko „wracam / nie wracam”; w v3 koniec trasy jest osobnym
        // miejscem, doszły też punkty pośrednie.
        if (version < 3) {
          const { loop, ...today } = (state.today ?? emptyToday()) as TodayPlan & { loop?: boolean }
          state = {
            ...state,
            today: { ...today, finish: { kind: loop === false ? 'none' : 'start' }, waypoints: [] },
          }
        }
        return state
      },
    },
  ),
)

/** Selektor: postęp konkretnego szczytu, zawsze zdefiniowany. */
export const usePeakProgress = (peakId: string): PeakProgress =>
  useProgress((s) => s.progress[peakId] ?? EMPTY)

const EMPTY: PeakProgress = { status: 'todo', photoIds: [] }

export function countDone(progress: Record<string, PeakProgress>): number {
  return PEAKS.filter((p) => progress[p.id]?.status === 'done').length
}

export function totalAscent(progress: Record<string, PeakProgress>): number {
  return PEAKS.filter((p) => progress[p.id]?.status === 'done').reduce((sum, p) => sum + p.ele, 0)
}
