import { useEffect, useRef, useState } from 'react'
import { PEAKS } from '../../data/peaks'
import { useProgress, countDone, totalAscent } from '../../store/progress'
import { renderCollage, renderSummaryCard } from './collage'
import { renderPdf } from './pdf'
import { photosForExport, type ExportFailure } from './exportPhotos'
import { exportBackup, importBackup } from './backup'
import { downloadBlob } from '../../lib/download'
import { IconDownload, IconShare, IconUpload, IconWarn } from '../../ui/Icons'

type Busy = null | 'collage' | 'pdf' | 'card' | 'backup' | 'import'

const PARTICIPANT_KEY = 'kgb-participant'

export function ExportView() {
  const { progress, plans, replaceState, markBackup } = useProgress()
  const [participant, setParticipant] = useState(() => localStorage.getItem(PARTICIPANT_KEY) ?? '')
  const [busy, setBusy] = useState<Busy>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    localStorage.setItem(PARTICIPANT_KEY, participant)
  }, [participant])

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  // Zdjęcia liczymy po bazie, tak jak pokazuje je karta szczytu i jak trafią do eksportu.
  const [photoPeaks, setPhotoPeaks] = useState<Set<string> | null>(null)
  useEffect(() => {
    let alive = true
    photosForExport(progress)
      .then((map) => alive && setPhotoPeaks(new Set(map.keys())))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [progress])
  const hasPhoto = (peakId: string) =>
    photoPeaks ? photoPeaks.has(peakId) : (progress[peakId]?.photoIds.length ?? 0) > 0

  const done = countDone(progress)
  const withPhoto = PEAKS.filter((p) => hasPhoto(p.id)).length
  const missing = PEAKS.filter((p) => !hasPhoto(p.id))

  const exportMessage = (ok: string, failed: ExportFailure[]) =>
    setMsg(
      failed.length
        ? {
            kind: 'err',
            text: `${ok} Nie udało się wczytać ${failed.length === 1 ? 'zdjęcia' : 'zdjęć'}: ${failed
              .map((f) => `${f.peak} (${f.reason})`)
              .join(', ')} — w pliku są puste pola.`,
          }
        : { kind: 'ok', text: ok },
    )

  const run = async (kind: Busy, fn: () => Promise<void>) => {
    setBusy(kind)
    setMsg(null)
    try {
      await fn()
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Coś poszło nie tak.' })
    } finally {
      setBusy(null)
    }
  }

  const makeCollage = () =>
    run('collage', async () => {
      const { blob, failed } = await renderCollage({ progress, photos: await photosForExport(progress), participant })
      if (preview) URL.revokeObjectURL(preview)
      setPreview(URL.createObjectURL(blob))
      downloadBlob(blob, 'korona-gor-brennej-2026-komplet.jpg')
      exportMessage('Kolaż pobrany. Wrzuć go w dyskusję wydarzenia na Facebooku.', failed)
    })

  const makePdf = () =>
    run('pdf', async () => {
      const { blob, failed } = await renderPdf({ progress, photos: await photosForExport(progress), participant })
      downloadBlob(blob, 'korona-gor-brennej-2026.pdf')
      exportMessage('PDF zapisany.', failed)
    })

  const makeCard = () =>
    run('card', async () => {
      const blob = await renderSummaryCard(progress, participant)
      if (preview) URL.revokeObjectURL(preview)
      setPreview(URL.createObjectURL(blob))
      const file = new File([blob], 'korona-gor-brennej.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Korona Gór Brennej 2026' })
        setMsg({ kind: 'ok', text: 'Udostępnione.' })
      } else {
        downloadBlob(blob, 'korona-gor-brennej.png')
        setMsg({ kind: 'ok', text: 'Karta pobrana.' })
      }
    })

  const makeBackup = () =>
    run('backup', async () => {
      const blob = await exportBackup(progress, plans)
      downloadBlob(blob, `kgb-backup-${new Date().toISOString().slice(0, 10)}.json`)
      markBackup()
      setMsg({ kind: 'ok', text: 'Backup zapisany. Trzymaj go poza telefonem.' })
    })

  const doImport = (file: File) =>
    run('import', async () => {
      const result = await importBackup(file)
      replaceState({ progress: result.progress, plans: result.plans })
      setMsg({ kind: 'ok', text: `Wczytano backup: ${countDone(result.progress)}/20 szczytów, ${result.photoCount} zdjęć.` })
    })

  return (
    <div className="space-y-4">
      <div className="card px-4 py-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Metric value={`${done}/20`} label="zdobyte" />
          <Metric value={`${withPhoto}/20`} label="ze zdjęciem" />
          <Metric value={`${totalAscent(progress).toLocaleString('pl-PL')} m`} label="suma wysokości" />
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted">Twoje imię / nick (na kolażu i karcie)</span>
        <input
          className="field"
          placeholder="np. Anna K."
          value={participant}
          onChange={(e) => setParticipant(e.target.value)}
        />
      </label>

      <section className="card px-4 py-4">
        <h2 className="text-sm font-semibold">Komplet zdjęć do weryfikacji</h2>
        <p className="mt-1 text-xs text-muted">
          Organizator weryfikuje zgłoszenie na podstawie kompletu zdjęć opublikowanego w dyskusji wydarzenia
          na Facebooku. Aplikacja składa je w jeden plik.
        </p>

        {missing.length > 0 && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-xs text-warn">
            <IconWarn className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Brakuje zdjęć dla {missing.length} {missing.length === 1 ? 'szczytu' : 'szczytów'}:{' '}
              {missing.map((p) => p.name).join(', ')}. Kolaż i tak powstanie — puste pola będą oznaczone.
            </span>
          </p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={makeCollage} disabled={busy !== null} className="btn-primary">
            <IconDownload className="h-4 w-4" /> {busy === 'collage' ? 'składam…' : 'Kolaż JPG'}
          </button>
          <button onClick={makePdf} disabled={busy !== null} className="btn-ghost">
            <IconDownload className="h-4 w-4" /> {busy === 'pdf' ? 'generuję…' : 'PDF'}
          </button>
        </div>
      </section>

      <section className="card px-4 py-4">
        <h2 className="text-sm font-semibold">Karta podsumowania</h2>
        <p className="mt-1 text-xs text-muted">Kwadratowy obrazek do wrzucenia na social media.</p>
        <button onClick={makeCard} disabled={busy !== null} className="btn-ghost mt-3 w-full">
          <IconShare className="h-4 w-4" /> {busy === 'card' ? 'rysuję…' : 'Utwórz i udostępnij'}
        </button>
      </section>

      <section className="card px-4 py-4">
        <h2 className="text-sm font-semibold">Backup danych</h2>
        <p className="mt-1 text-xs text-muted">
          Wszystko trzymane jest wyłącznie w tej przeglądarce. Wyczyszczenie danych witryny kasuje postęp
          bezpowrotnie — a backup przenosi go też na inny telefon.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={makeBackup} disabled={busy !== null} className="btn-ghost">
            <IconDownload className="h-4 w-4" /> {busy === 'backup' ? 'pakuję…' : 'Eksportuj'}
          </button>
          <button onClick={() => importRef.current?.click()} disabled={busy !== null} className="btn-ghost">
            <IconUpload className="h-4 w-4" /> {busy === 'import' ? 'wczytuję…' : 'Importuj'}
          </button>
        </div>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) doImport(f)
            e.target.value = ''
          }}
        />
        <p className="mt-2 text-[11px] text-warn">Import zastępuje bieżące dane i zdjęcia.</p>
      </section>

      {msg && (
        <p className={`rounded-xl px-3 py-2.5 text-xs ${msg.kind === 'ok' ? 'bg-done-soft text-done' : 'bg-red-500/12 text-red-400'}`}>
          {msg.text}
        </p>
      )}

      {preview && (
        <div className="card overflow-hidden">
          <img src={preview} alt="Podgląd wygenerowanego pliku" className="w-full" />
        </div>
      )}
    </div>
  )
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  )
}
