import { motion } from 'framer-motion'
import type { Peak } from '../../types'
import { usePeakProgress, useProgress } from '../../store/progress'
import { isWithinChallenge } from '../../data/peaks'
import { IconBike, IconBoot, IconCamera, IconCheck, IconWarn } from '../../ui/Icons'
import { formatDistance } from '../../lib/geo'

interface Props {
  peak: Peak
  onOpen: (peak: Peak) => void
  distanceM?: number
  index: number
}

export function PeakCard({ peak, onOpen, distanceM, index }: Props) {
  const p = usePeakProgress(peak.id)
  const toggleDone = useProgress((s) => s.toggleDone)

  const done = p.status === 'done'
  const planned = p.status === 'planned'
  const hasPhoto = p.photoIds.length > 0
  const dateWarning = done && p.conqueredAt && !isWithinChallenge(p.conqueredAt)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
      className={`card relative overflow-hidden transition-colors ${
        done ? 'border-summit-500/40 bg-summit-500/8' : planned ? 'border-dusk-400/30' : ''
      }`}
    >
      <div className="flex items-stretch">
        <button
          onClick={() => toggleDone(peak.id)}
          aria-pressed={done}
          aria-label={done ? `Cofnij zaliczenie: ${peak.name}` : `Zalicz szczyt ${peak.name}`}
          className={`flex w-16 shrink-0 flex-col items-center justify-center gap-1 border-r transition ${
            done
              ? 'border-summit-500/30 bg-summit-500/20 text-summit-300'
              : 'border-white/8 bg-white/3 text-slate-500 hover:bg-white/8'
          }`}
        >
          <motion.span
            key={String(done)}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 14, stiffness: 400 }}
          >
            {done ? (
              <IconCheck className="h-6 w-6" />
            ) : (
              <span className="text-sm font-bold tabular-nums">{peak.no}</span>
            )}
          </motion.span>
        </button>

        <button onClick={() => onOpen(peak)} className="min-w-0 flex-1 px-4 py-3 text-left !min-h-0">
          <div className="flex items-baseline gap-2">
            <span className={`truncate font-semibold ${done ? 'text-summit-300' : 'text-slate-100'}`}>
              {peak.name}
            </span>
            <span className="shrink-0 text-sm tabular-nums text-slate-400">{peak.ele} m</span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {planned && <span className="chip bg-dusk-500/20 text-dusk-400">zaplanowany</span>}
            {done && p.conqueredAt && (
              <span className="chip bg-white/6 text-slate-300">
                {new Date(p.conqueredAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
              </span>
            )}
            {p.ascentMode === 'bike' && (
              <span className="chip bg-ember-500/15 text-ember-400"><IconBike className="h-3.5 w-3.5" /> rower</span>
            )}
            {p.ascentMode === 'foot' && (
              <span className="chip bg-white/6 text-slate-400"><IconBoot className="h-3.5 w-3.5" /> pieszo</span>
            )}
            <span className={`chip ${hasPhoto ? 'bg-summit-500/15 text-summit-300' : 'bg-white/6 text-slate-500'}`}>
              <IconCamera className="h-3.5 w-3.5" />
              {hasPhoto ? `${p.photoIds.length}` : 'brak zdjęcia'}
            </span>
            {dateWarning && (
              <span className="chip bg-ember-500/20 text-ember-400"><IconWarn className="h-3.5 w-3.5" /> data poza terminem</span>
            )}
            {peak.verify && <span className="chip bg-white/6 text-slate-500">do weryfikacji</span>}
            {distanceM !== undefined && (
              <span className="chip bg-dusk-500/15 text-dusk-400">{formatDistance(distanceM)} stąd</span>
            )}
          </div>
        </button>
      </div>
    </motion.div>
  )
}
