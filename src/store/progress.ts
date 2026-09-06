import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AscentMode, DayPlan, PeakProgress } from '../types'
import { PEAKS } from '../data/peaks'

interface ProgressState {
  progress: Record<string, PeakProgress>
  plans: DayPlan[]
  activePresetId: string | null
  backupReminderAt: number

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

let dayCounter = 0
const nextDayId = () => `day-${Date.now()}-${dayCounter++}`

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      progress: {},
      plans: [],
      activePresetId: null,
      backupReminderAt: 0,

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

      resetAll: () => set({ progress: {}, plans: [], activePresetId: null, backupReminderAt: 0 }),
    }),
    { name: 'kgb-progress', version: 1 },
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
