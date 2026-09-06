import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { PEAKS, daysLeft, CHALLENGE_END } from './data/peaks'
import { useProgress, countDone, totalAscent } from './store/progress'
import { useGeolocation } from './features/field/useGeolocation'
import { Checklist } from './features/checklist/Checklist'
import { PeakSheet } from './features/checklist/PeakSheet'
import { MapView } from './features/map/MapView'
import { Planner } from './features/planner/Planner'
import { ExportView } from './features/export/ExportView'
import { InfoView } from './features/info/InfoView'
import { FieldView } from './features/field/FieldView'
import { ProgressRing } from './ui/ProgressRing'
import type { Peak } from './types'
import { IconInfo, IconList, IconLocate, IconMap, IconRoute, IconShare } from './ui/Icons'

type Tab = 'lista' | 'mapa' | 'plan' | 'teren' | 'dowod' | 'info'

const TABS: { id: Tab; label: string; icon: typeof IconList }[] = [
  { id: 'lista', label: 'Szczyty', icon: IconList },
  { id: 'mapa', label: 'Mapa', icon: IconMap },
  { id: 'plan', label: 'Plan', icon: IconRoute },
  { id: 'teren', label: 'Teren', icon: IconLocate },
  { id: 'dowod', label: 'Dowód', icon: IconShare },
  { id: 'info', label: 'Info', icon: IconInfo },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('lista')
  const [openPeak, setOpenPeak] = useState<Peak | null>(null)
  const [geoOn, setGeoOn] = useState(false)
  const [recording, setRecording] = useState(false)

  const progress = useProgress((s) => s.progress)
  const backupReminderAt = useProgress((s) => s.backupReminderAt)
  const { position, error, currentTrack } = useGeolocation(geoOn, recording)

  const done = countDone(progress)
  const left = daysLeft()

  // Backup przypominamy co piąty szczyt — utrata danych przeglądarki jest nieodwracalna.
  const [reminderClosed, setReminderClosed] = useState(false)
  const needsBackup =
    done >= 5 && done % 5 === 0 && !reminderClosed && Date.now() - backupReminderAt > 86_400_000
  useEffect(() => setReminderClosed(false), [done])

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col">
      <header className="safe-top sticky top-0 z-[900] border-b border-line bg-bg/85 backdrop-blur-xl">
        <div className="flex items-center gap-4 px-4 py-3">
          <ProgressRing done={done} total={PEAKS.length} size={62} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight">Korona Gór Brennej</h1>
            <p className="mt-0.5 text-xs text-muted">
              {done === PEAKS.length ? (
                <span className="text-done">Komplet! Zostaw dowód organizatorowi.</span>
              ) : left > 0 ? (
                <>
                  {left} {left === 1 ? 'dzień' : left < 5 ? 'dni' : 'dni'} do końca ·{' '}
                  {totalAscent(progress).toLocaleString('pl-PL')} m zebrane
                </>
              ) : (
                <>Edycja zakończona {new Date(CHALLENGE_END).toLocaleDateString('pl-PL')}</>
              )}
            </p>
          </div>
        </div>
      </header>

      {needsBackup && (
        <div className="mx-4 mt-3 rounded-xl border border-warn bg-warn-soft px-3 py-2.5 text-xs text-warn">
          Masz już {done} szczytów. Zrób backup w zakładce <strong>Dowód</strong> — wyczyszczenie danych
          przeglądarki kasuje wszystko.{' '}
          <button onClick={() => setReminderClosed(true)} className="!min-h-0 underline">
            ukryj
          </button>
        </div>
      )}

      <main className={`flex-1 ${tab === 'mapa' ? '' : 'px-4 py-4'} pb-24`}>
        {/* Bez AnimatePresence: animacja wyjścia potrafi się zaciąć i zablokować
            podmianę widoku, a to jest główna nawigacja aplikacji. */}
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16 }}
          className={tab === 'mapa' ? 'h-[calc(100vh-13rem)] min-h-96' : ''}
        >
          {tab === 'lista' && <Checklist onOpenPeak={setOpenPeak} position={position} />}
          {tab === 'mapa' && <MapView onOpenPeak={setOpenPeak} position={position} showPlanLines />}
          {tab === 'plan' && <Planner />}
          {tab === 'teren' && (
            <FieldView
              position={position}
              error={error}
              enabled={geoOn}
              onToggle={setGeoOn}
              recording={recording}
              onToggleRecording={setRecording}
              currentTrack={currentTrack}
              onOpenPeak={setOpenPeak}
            />
          )}
          {tab === 'dowod' && <ExportView />}
          {tab === 'info' && <InfoView onGoToPlanner={() => setTab('plan')} />}
        </motion.div>
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-[900] mx-auto max-w-3xl border-t border-line bg-bg/90 px-2 pt-1 backdrop-blur-xl">
        <div className="grid grid-cols-6">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition ${
                tab === id ? 'text-brand' : 'text-muted'
              }`}
            >
              {tab === id && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-x-2 inset-y-1 -z-10 rounded-xl bg-brand-soft"
                  transition={{ type: 'spring', damping: 26, stiffness: 380 }}
                />
              )}
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      <PeakSheet peak={openPeak} onClose={() => setOpenPeak(null)} />
    </div>
  )
}
