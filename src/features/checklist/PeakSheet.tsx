import { useEffect, useRef, useState } from 'react'
import type { Peak, StoredPhoto } from '../../types'
import { useProgress, usePeakProgress } from '../../store/progress'
import { deletePhoto, getPhotosForPeak, putPhoto } from '../../store/media'
import { photoUrl, preparePhoto } from '../../lib/photo'
import { isWithinChallenge, CHALLENGE_START, CHALLENGE_END } from '../../data/peaks'
import { haversine } from '../../lib/geo'
import { Sheet } from '../../ui/Sheet'
import { IconBike, IconBoot, IconCamera, IconCheck, IconStar, IconTrash, IconWarn } from '../../ui/Icons'

interface Props {
  peak: Peak | null
  onClose: () => void
}

const fmtDate = (iso?: string) => (iso ? iso.slice(0, 10) : '')

export function PeakSheet({ peak, onClose }: Props) {
  const p = usePeakProgress(peak?.id ?? '__none__')
  const { toggleDone, setAscentMode, setNote, setConqueredAt, addPhotoId, removePhotoId, setPrimaryPhoto } =
    useProgress()
  const [photos, setPhotos] = useState<StoredPhoto[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!peak) return setPhotos([])
    let alive = true
    getPhotosForPeak(peak.id).then((list) => alive && setPhotos(list))
    return () => {
      alive = false
    }
  }, [peak, p.photoIds.length])

  if (!peak) return null

  const done = p.status === 'done'

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        const photo = await preparePhoto(file, peak.id)
        await putPhoto(photo)
        addPhotoId(peak.id, photo.id)
        // Zdjęcie z datą to najmocniejsza przesłanka, kiedy szczyt został zdobyty.
        if (photo.takenAt && !p.conqueredAt) setConqueredAt(peak.id, photo.takenAt)
      }
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'QuotaExceededError'
          ? 'Brak miejsca w przeglądarce. Usuń część zdjęć albo zrób backup i wyczyść dane.'
          : 'Nie udało się dodać zdjęcia. Spróbuj innego pliku.',
      )
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onDelete = async (id: string) => {
    await deletePhoto(id)
    removePhotoId(peak.id, id)
    setPhotos((list) => list.filter((x) => x.id !== id))
  }

  const dateOk = !p.conqueredAt || isWithinChallenge(p.conqueredAt)

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <span className="flex items-baseline gap-2">
          <span className="truncate">{peak.name}</span>
          <span className="shrink-0 text-sm font-normal text-muted">{peak.ele} m n.p.m.</span>
        </span>
      }
    >
      <button
        onClick={() => toggleDone(peak.id)}
        className={`w-full ${done ? 'btn-ghost' : 'btn-summit'} !py-3.5 text-base`}
      >
        <IconCheck className="h-5 w-5" />
        {done ? 'Cofnij zaliczenie' : 'Zaliczam ten szczyt'}
      </button>

      {done && (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Data zdobycia</span>
            <input
              type="date"
              className="field"
              min="2026-01-01"
              max="2026-12-31"
              value={fmtDate(p.conqueredAt)}
              onChange={(e) =>
                setConqueredAt(peak.id, e.target.value ? new Date(e.target.value).toISOString() : undefined)
              }
            />
          </label>
          {!dateOk && (
            <p className="flex items-start gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-xs text-warn">
              <IconWarn className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Ta data jest poza terminem wydarzenia ({CHALLENGE_START.slice(8)}–{CHALLENGE_END.slice(8)}.09.2026).
                Organizator uznaje wyłącznie zdjęcia z tego okresu.
              </span>
            </p>
          )}

          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted">Sposób zdobycia</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAscentMode(peak.id, 'foot')}
                className={p.ascentMode === 'foot' ? 'btn-primary' : 'btn-ghost'}
              >
                <IconBoot className="h-4 w-4" /> Pieszo
              </button>
              <button
                onClick={() => setAscentMode(peak.id, 'bike')}
                className={p.ascentMode === 'bike' ? 'btn-primary' : 'btn-ghost'}
              >
                <IconBike className="h-4 w-4" /> Rowerem
              </button>
            </div>
            {p.ascentMode === 'bike' && (
              <p className="mt-2 text-xs text-warn">
                Przy zdobywaniu rowerem zdjęcie musi obejmować także rower — i musi to być rower bez wspomagania.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted">
            Zdjęcia ({photos.length}) — na tle tabliczki wysokościowej
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => {
            const isPrimary = p.primaryPhotoId === photo.id
            const offSite =
              photo.gps && haversine(photo.gps.lat, photo.gps.lon, peak.lat, peak.lon) > 500
            return (
              <div
                key={photo.id}
                className={`group relative aspect-square overflow-hidden rounded-xl border ${
                  isPrimary ? 'border-done' : 'border-line'
                }`}
              >
                <img src={photoUrl(photo)} alt="" className="h-full w-full object-cover" loading="lazy" />
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-bg/80 px-1 py-1">
                  <button
                    onClick={() => setPrimaryPhoto(peak.id, photo.id)}
                    title={isPrimary ? 'To zdjęcie trafi do kolażu' : 'Ustaw jako główne'}
                    className={`!min-h-0 rounded-lg p-1 ${isPrimary ? 'text-done' : 'text-muted'}`}
                  >
                    <IconStar className="h-4 w-4" filled={isPrimary} />
                  </button>
                  <button
                    onClick={() => onDelete(photo.id)}
                    title="Usuń zdjęcie"
                    className="!min-h-0 rounded-lg p-1 text-muted hover:text-red-400"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </div>
                {photo.takenAt && !isWithinChallenge(photo.takenAt) && (
                  <span className="absolute left-1 top-1 rounded-md bg-warn px-1.5 py-0.5 text-[10px] font-semibold text-onbrand">
                    zła data
                  </span>
                )}
                {offSite && (
                  <span className="absolute right-1 top-1 rounded-md bg-bg/90 px-1.5 py-0.5 text-[10px] text-ink-soft">
                    GPS ≠ szczyt
                  </span>
                )}
              </div>
            )
          })}

          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong bg-tint text-muted hover:bg-tint-strong"
          >
            <IconCamera className="h-6 w-6" />
            <span className="text-[11px]">{busy ? 'przetwarzam…' : 'dodaj'}</span>
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        <p className="mt-2 text-[11px] text-muted">
          Zdjęcia są zmniejszane i zapisywane wyłącznie w Twojej przeglądarce. Gwiazdka wskazuje zdjęcie,
          które trafi do kolażu dla organizatora.
        </p>
      </div>

      <label className="mt-5 block">
        <span className="mb-1.5 block text-xs font-medium text-muted">Notatka</span>
        <textarea
          className="field min-h-20 resize-y"
          placeholder="Pogoda, dojście, gdzie zaparkować…"
          value={p.note ?? ''}
          onChange={(e) => setNote(peak.id, e.target.value)}
        />
      </label>

      {(peak.note || peak.verify) && (
        <div className="mt-4 space-y-2 text-xs">
          {peak.note && (
            <p className="rounded-xl bg-tint px-3 py-2.5 text-ink-soft">{peak.note}</p>
          )}
          {peak.verify && (
            <p className="flex items-start gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-warn">
              <IconWarn className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{peak.verify}</span>
            </p>
          )}
        </div>
      )}

      <p className="mt-4 text-[11px] text-muted">
        Współrzędne: {peak.lat.toFixed(5)}, {peak.lon.toFixed(5)} ·{' '}
        <a
          className="text-brand underline"
          href={`https://www.google.com/maps/dir/?api=1&destination=${peak.lat},${peak.lon}`}
          target="_blank"
          rel="noreferrer"
        >
          nawiguj
        </a>
      </p>
    </Sheet>
  )
}
