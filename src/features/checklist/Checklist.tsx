import { useMemo, useState } from 'react'
import { PEAKS } from '../../data/peaks'
import { useProgress } from '../../store/progress'
import { haversine } from '../../lib/geo'
import type { Peak } from '../../types'
import { PeakCard } from './PeakCard'

type Sort = 'ele' | 'name' | 'near' | 'status'

interface Props {
  onOpenPeak: (peak: Peak) => void
  position: { lat: number; lon: number } | null
}

const SORTS: { id: Sort; label: string }[] = [
  { id: 'ele', label: 'wysokość' },
  { id: 'status', label: 'do zrobienia' },
  { id: 'name', label: 'alfabetycznie' },
  { id: 'near', label: 'najbliższe' },
]

export function Checklist({ onOpenPeak, position }: Props) {
  const progress = useProgress((s) => s.progress)
  const [sort, setSort] = useState<Sort>('ele')
  const [hideDone, setHideDone] = useState(false)

  const list = useMemo(() => {
    const dist = (p: Peak) => (position ? haversine(position.lat, position.lon, p.lat, p.lon) : Infinity)
    const rank = (p: Peak) => {
      const s = progress[p.id]?.status ?? 'todo'
      return s === 'planned' ? 0 : s === 'todo' ? 1 : 2
    }
    const arr = PEAKS.filter((p) => !hideDone || progress[p.id]?.status !== 'done')
    return [...arr].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'pl')
      if (sort === 'near') return dist(a) - dist(b)
      if (sort === 'status') return rank(a) - rank(b) || a.ele - b.ele
      return a.ele - b.ele
    })
  }, [sort, hideDone, progress, position])

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {SORTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSort(s.id)}
            disabled={s.id === 'near' && !position}
            className={`chip shrink-0 !py-1.5 transition ${
              sort === s.id ? 'bg-dusk-500 text-white' : 'bg-white/6 text-slate-300 hover:bg-white/10'
            } disabled:opacity-35`}
          >
            {s.label}
          </button>
        ))}
        <button
          onClick={() => setHideDone((v) => !v)}
          className={`chip shrink-0 !py-1.5 ${hideDone ? 'bg-summit-500/25 text-summit-300' : 'bg-white/6 text-slate-300'}`}
        >
          {hideDone ? 'pokaż zdobyte' : 'ukryj zdobyte'}
        </button>
      </div>

      <div className="space-y-2">
        {list.map((peak, i) => (
          <PeakCard
            key={peak.id}
            peak={peak}
            index={i}
            onOpen={onOpenPeak}
            distanceM={position ? haversine(position.lat, position.lon, peak.lat, peak.lon) : undefined}
          />
        ))}
      </div>

      {list.length === 0 && (
        <p className="card px-4 py-8 text-center text-sm text-summit-300">
          Wszystkie 20 szczytów zdobyte. Przejdź do zakładki Dowód i wygeneruj komplet zdjęć.
        </p>
      )}
    </div>
  )
}
