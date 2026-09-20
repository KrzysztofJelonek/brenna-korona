import { useEffect, useState } from 'react'
import { APP_URL, APP_URL_SHORT } from '../../data/event'
import { makeQr, type QrCode } from '../../lib/qr'
import { Sheet } from '../../ui/Sheet'
import { IconCheck, IconCopy, IconShare } from '../../ui/Icons'

interface Props {
  open: boolean
  onClose: () => void
}

/** Kolory kodu niezależne od motywu — odwrócony kod (jasny na ciemnym) potrafi zablokować skaner. */
const QR_LIGHT = '#ffffff'
const QR_DARK = '#20312b'

/**
 * Udostępnianie aplikacji: duży kod QR dla osoby stojącej obok, przycisk systemowy
 * i kopiowanie adresu dla reszty. Wszystko działa bez zasięgu — kod liczy się na miejscu.
 */
export function ShareSheet({ open, onClose }: Props) {
  const [qr, setQr] = useState<QrCode | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  // Kod liczymy raz, przy pierwszym otwarciu — adres jest stały, więc nie ma czego przeliczać.
  useEffect(() => {
    if (!open || qr || failed) return
    let alive = true
    makeQr(APP_URL)
      .then((code) => alive && setQr(code))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [open, qr, failed])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2500)
    return () => clearTimeout(t)
  }, [copied])

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const share = async () => {
    try {
      await navigator.share({
        title: 'Korona Gór Brennej 2026',
        text: 'Pomocnik uczestnika: 20 szczytów, mapa, planer tras i zdjęcia do weryfikacji.',
        url: APP_URL,
      })
    } catch {
      // Anulowanie okna systemowego też wpada w catch — nie ma o czym informować.
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(APP_URL)
      setCopied(true)
    } catch {
      // Brak dostępu do schowka (starsze Safari, odmowa uprawnienia) — adres i tak jest
      // wypisany pod kodem, więc zostaje zaznaczenie go palcem.
      setCopied(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Udostępnij aplikację">
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-soft">
          Pokaż ten kod drugiej osobie — po zeskanowaniu aparatem telefonu otworzy jej się aplikacja.
          Nie trzeba jej instalować ani zakładać konta.
        </p>

        <div className="mx-auto w-full max-w-[16rem] rounded-2xl border border-line bg-white p-3">
          {qr ? (
            <svg
              viewBox={`0 0 ${qr.size} ${qr.size}`}
              className="h-auto w-full"
              shapeRendering="crispEdges"
              role="img"
              aria-label={`Kod QR z adresem ${APP_URL_SHORT}`}
            >
              <rect width={qr.size} height={qr.size} fill={QR_LIGHT} />
              <path d={qr.path} fill={QR_DARK} />
            </svg>
          ) : (
            <div
              className={`aspect-square w-full rounded-lg bg-tint ${failed ? '' : 'animate-pulse'}`}
              aria-hidden
            />
          )}
        </div>

        {failed && (
          <p className="text-center text-xs text-warn">
            Nie udało się narysować kodu. Adres poniżej działa tak samo.
          </p>
        )}

        <p className="break-all text-center text-sm font-medium text-brand">
          <a href={APP_URL} target="_blank" rel="noreferrer">
            {APP_URL_SHORT}
          </a>
        </p>

        <div className="flex flex-wrap gap-2">
          {canShare && (
            <button onClick={share} className="btn-primary flex-1 basis-40">
              <IconShare className="h-4 w-4" />
              Wyślij link
            </button>
          )}
          <button onClick={copy} className="btn-ghost flex-1 basis-40">
            {copied ? <IconCheck className="h-4 w-4 text-done" /> : <IconCopy className="h-4 w-4" />}
            {copied ? 'Skopiowano' : 'Kopiuj adres'}
          </button>
        </div>

        <p className="text-[11px] leading-relaxed text-muted">
          Aplikacji nie ma w żadnym sklepie — działa w przeglądarce. Po otwarciu można ją dodać do ekranu
          głównego (Android: menu <strong>⋮</strong> → <em>Dodaj do ekranu głównego</em>, iPhone: Safari →{' '}
          <em>Udostępnij</em> → <em>Do ekranu początkowego</em>) i wtedy chodzi też bez zasięgu.
        </p>
      </div>
    </Sheet>
  )
}
