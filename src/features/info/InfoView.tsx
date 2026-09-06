import { useState, type ReactNode } from 'react'
import { CHALLENGE_END, CHALLENGE_START, FINALE_DATE, PEAKS, daysLeft } from '../../data/peaks'
import { ROUTE_PRESETS } from '../../data/routes'
import { AUTHOR, CONTESTS, FAQ, ORGANIZER, PROMO_VIDEO, SIDE_EVENTS, SPONSOR, TOURIST_INFO } from '../../data/event'
import { IconCalendar, IconLink, IconMail, IconPhone, IconPlay, IconRoute } from '../../ui/Icons'
import { plural } from '../../lib/geo'

interface Props {
  onGoToPlanner: () => void
}

export function InfoView({ onGoToPlanner }: Props) {
  const left = daysLeft()

  return (
    <div className="space-y-4">
      <Section title="O wyzwaniu">
        <p className="text-sm leading-relaxed text-ink-soft">
          Korona Gór Brennej to zdobycie <strong>{PEAKS.length} szczytów</strong> leżących na terenie gminy
          Brenna. Bez zapisów i wpisowego, w dowolnej kolejności, pieszo lub rowerem bez wspomagania
          elektrycznego. Wejście potwierdza się zdjęciem na tle tabliczki wysokościowej, a po skompletowaniu
          całości odbiera pamiątkowy medal.
        </p>

        <dl className="mt-3 grid grid-cols-2 gap-2">
          <Fact label="Termin" value={`${fmt(CHALLENGE_START)} – ${fmt(CHALLENGE_END)} 2026`} />
          <Fact label="Wielki Finał" value={`${fmt(FINALE_DATE)} 2026`} hint="Park Turystyki w Brennej" />
          <Fact label="Szczytów" value={`${PEAKS.length}`} hint="od 557 do 1082 m n.p.m." />
          <Fact
            label={left > 0 ? 'Do końca' : 'Status'}
            value={left > 0 ? `${left} dni` : 'edycja zakończona'}
          />
        </dl>

        <p className="mt-3 text-xs text-muted">
          Motyw edycji 2026: nietoperze — „Nietoperze przejmują tegoroczną edycję. Ty przejmij szlak”.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Ext href={ORGANIZER.rules}>Regulamin</Ext>
          <Ext href={ORGANIZER.checklistPdf}>Lista szczytów (PDF)</Ext>
          <Ext href={ORGANIZER.news}>Aktualności</Ext>
        </div>
      </Section>

      <VideoSection />

      <Section title="Trasy">
        <p className="text-sm leading-relaxed text-ink-soft">
          Gmina Brenna przygotowała propozycje przejścia w{' '}
          {[...ROUTE_PRESETS].map((r) => r.days).sort((a, b) => a - b).join(', ')} dni. Wariant sześciodniowy
          jest opisany w materiałach gminy najdokładniej — z punktami startowymi, czasami i dystansami.
        </p>

        <ul className="mt-3 space-y-1.5">
          {[...ROUTE_PRESETS]
            .sort((a, b) => a.days - b.days)
            .map((preset) => {
              const total = preset.plans.reduce((s, d) => s + (d.officialDistanceKm ?? 0), 0)
              return (
                <li
                  key={preset.id}
                  className="flex items-baseline gap-2 rounded-lg bg-tint px-3 py-2 text-sm"
                >
                  <span className="font-semibold">{preset.name}</span>
                  <span className="text-xs text-muted">
                    {total > 0
                      ? `${total.toLocaleString('pl-PL', { minimumFractionDigits: 1 })} km łącznie`
                      : `${preset.plans.length} ${plural(preset.plans.length, ['etap', 'etapy', 'etapów'])}`}
                  </span>
                </li>
              )
            })}
        </ul>

        <button onClick={onGoToPlanner} className="btn-primary mt-3 w-full">
          <IconRoute className="h-4 w-4" /> Otwórz planer tras
        </button>

        <p className="mt-2 text-[11px] text-muted">
          Wszystkie szczyty leżą na oznakowanych szlakach PTTK. W terenie kieruj się oznakowaniem szlaku,
          nie aplikacją.
        </p>
        <div className="mt-2">
          <Ext href={ORGANIZER.routesPdf}>Propozycje tras — PDF gminy</Ext>
        </div>
      </Section>

      <Section title="Dla uczestników">
        <div className="space-y-2">
          {FAQ.map((item) => (
            <details key={item.q} className="group rounded-xl border border-line bg-tint">
              <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium">
                <span className="flex items-center justify-between gap-2">
                  {item.q}
                  <span className="shrink-0 text-muted transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="border-t border-line px-3 py-2.5 text-sm leading-relaxed text-ink-soft">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </Section>

      <Section title="Imprezy towarzyszące">
        <ul className="space-y-1.5">
          {SIDE_EVENTS.map((e, i) => (
            <li key={`${e.date}-${i}`} className="flex items-start gap-3 rounded-lg bg-tint px-3 py-2">
              <span className="chip shrink-0 bg-brand-soft tabular-nums text-brand">{e.date}</span>
              <span className="min-w-0 text-sm text-ink">{e.name}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex items-start gap-2 text-[11px] text-muted">
          <IconCalendar className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Godziny i szczegóły organizator publikuje osobno — sprawdź aktualności i Facebook.
        </p>
      </Section>

      <Section title="Konkursy">
        <ul className="space-y-1.5">
          {CONTESTS.map((c) => (
            <li key={c.url}>
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg bg-tint px-3 py-2.5 text-sm hover:bg-tint-strong"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="text-xs text-muted">{c.kind}</span>
                </span>
                <IconLink className="h-4 w-4 shrink-0 text-muted" />
              </a>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Kontakt z organizatorem">
        <p className="text-sm text-ink-soft">
          Wyzwanie prowadzi {ORGANIZER.foundation} wspólnie z {ORGANIZER.commune}. W sprawach weryfikacji,
          zgłoszeń i medali pisz bezpośrednio do organizatora.
        </p>

        <div className="mt-3 space-y-1.5">
          <Row href={`mailto:${ORGANIZER.email}`} icon={<IconMail className="h-4 w-4" />} label={ORGANIZER.email} sub="e-mail organizatora" />
          <Row href={ORGANIZER.contact} icon={<IconLink className="h-4 w-4" />} label="Formularz kontaktowy" sub="koronagorbrennej.pl" />
          <Row href={ORGANIZER.facebook} icon={<IconLink className="h-4 w-4" />} label="Facebook" sub="tu publikuje się komplet zdjęć do weryfikacji" />
          <Row href={ORGANIZER.instagram} icon={<IconLink className="h-4 w-4" />} label="Instagram" sub="@korona_gor_brennej" />
          <Row href={ORGANIZER.youtube} icon={<IconLink className="h-4 w-4" />} label="YouTube" sub="kanał wydarzenia" />
        </div>

        <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
          Informacja Turystyczna w Brennej
        </h3>
        <div className="space-y-1.5">
          <Row href={`tel:${TOURIST_INFO.phoneHref}`} icon={<IconPhone className="h-4 w-4" />} label={TOURIST_INFO.phone} sub={TOURIST_INFO.address} />
          <Row href={`mailto:${TOURIST_INFO.email}`} icon={<IconMail className="h-4 w-4" />} label={TOURIST_INFO.email} sub="informacja turystyczna" />
          <Row href={ORGANIZER.communeSite} icon={<IconLink className="h-4 w-4" />} label="brenna.org.pl" sub="strona gminy" />
        </div>
      </Section>

      <Section title="O tej aplikacji">
        <p className="text-sm leading-relaxed text-ink-soft">
          To nieoficjalny pomocnik uczestnika — nie jest powiązany z organizatorem. Jedyną wiążącą procedurą
          zaliczenia jest ta opisana przez organizatora. Aplikacja niczego nie zgłasza za Ciebie.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
          <Bullet>Brak kont, logowania i zbierania danych osobowych.</Bullet>
          <Bullet>Brak analityki, ciasteczek i skryptów śledzących.</Bullet>
          <Bullet>
            Postęp, zdjęcia i notatki zapisują się wyłącznie w pamięci tej przeglądarki i nigdzie stąd nie
            wychodzą.
          </Bullet>
          <Bullet>
            Z sieci pobierane są tylko kafelki mapy (OpenStreetMap) i — dopiero po kliknięciu — film z YouTube.
          </Bullet>
          <Bullet>
            Wyczyszczenie danych przeglądarki kasuje postęp. Rób kopię w zakładce <strong>Dowód</strong>.
          </Bullet>
        </ul>
      </Section>

      <Section title="Autor i sponsor">
        <p className="text-sm leading-relaxed text-ink-soft">
          Aplikację napisał <strong>{AUTHOR.name}</strong> — uczestnik wyzwania, z potrzeby uporządkowania
          własnych wejść i zdjęć. Jest bezpłatna i niekomercyjna: nie ma w niej reklam ani płatnych funkcji.
        </p>

        <p className="mt-3 text-xs uppercase tracking-wide text-muted">Sponsor aplikacji</p>
        <a
          href={SPONSOR.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block rounded-xl border border-line bg-white p-4 transition hover:border-line-strong"
          aria-label={`${SPONSOR.name} — otwórz stronę facelove.pl`}
        >
          <img
            src={SPONSOR.logo}
            alt={`${SPONSOR.name} — ${SPONSOR.tagline}`}
            width={600}
            height={165}
            className="mx-auto h-auto w-full max-w-64"
            loading="lazy"
          />
        </a>
        <p className="mt-2 text-center text-sm text-ink-soft">
          {SPONSOR.name} z {SPONSOR.cityGenitive}
        </p>
        <p className="mt-1 text-center text-[11px] text-muted">
          Dzięki wsparciu sponsora aplikacja jest dostępna dla wszystkich za darmo.{' '}
          <a
            href={SPONSOR.url}
            target="_blank"
            rel="noreferrer"
            className="whitespace-nowrap text-brand underline"
          >
            {sponsorDomain}
          </a>
        </p>
      </Section>
    </div>
  )
}

/**
 * Film ładowany dopiero na żądanie. Standardowy embed YouTube wysyła zapytania
 * do Google przy samym otwarciu strony — tu do kliknięcia nie leci nic.
 */
function VideoSection() {
  const [loaded, setLoaded] = useState(false)

  return (
    <Section title="Zapowiedź wydarzenia">
      <div className="overflow-hidden rounded-xl border border-line bg-bg">
        {loaded ? (
          <iframe
            className="aspect-video w-full"
            src={`https://www.youtube-nocookie.com/embed/${PROMO_VIDEO.id}?autoplay=1&rel=0`}
            title={PROMO_VIDEO.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <button
            onClick={() => setLoaded(true)}
            className="group relative flex aspect-video w-full !min-h-0 items-center justify-center overflow-hidden"
            aria-label={`Odtwórz film: ${PROMO_VIDEO.title}`}
          >
            <span
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_25%,#8ac95f_0%,#185122_72%)]"
            />
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 opacity-70">
              <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="h-full w-full">
                <path d="M0 120 L0 78 L70 34 L118 68 L182 18 L246 70 L310 40 L400 84 L400 120 Z" fill="#1c5527" />
                <path d="M0 120 L0 98 L88 62 L150 92 L232 52 L300 88 L400 60 L400 120 Z" fill="#14401f" />
              </svg>
            </span>
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-brand text-white shadow-xl transition group-hover:scale-105">
              <IconPlay className="ml-0.5 h-7 w-7" />
            </span>
          </button>
        )}
      </div>

      <p className="mt-2 text-sm font-medium">{PROMO_VIDEO.title}</p>
      <p className="mt-1 text-[11px] text-muted">
        {loaded
          ? 'Film odtwarza YouTube w trybie ograniczonych ciasteczek.'
          : 'Film ładuje się z YouTube dopiero po kliknięciu — do tego momentu strona nie wysyła żadnych zapytań do Google.'}{' '}
        <a href={PROMO_VIDEO.url} target="_blank" rel="noreferrer" className="text-brand underline">
          Otwórz w YouTube
        </a>
      </p>
    </Section>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card px-4 py-4">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-tint px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-sm font-semibold">{value}</dd>
      {hint && <dd className="text-[10px] text-muted">{hint}</dd>}
    </div>
  )
}

function Row({ href, icon, label, sub }: { href: string; icon: ReactNode; label: string; sub: string }) {
  const external = href.startsWith('http')
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className="flex items-center gap-3 rounded-lg bg-tint px-3 py-2.5 hover:bg-tint-strong"
    >
      <span className="shrink-0 text-brand">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted">{sub}</span>
      </span>
    </a>
  )
}

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="chip bg-tint text-ink-soft hover:bg-tint-strong">
      {children} <IconLink className="h-3 w-3" />
    </a>
  )
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-done-strong" />
      <span className="min-w-0">{children}</span>
    </li>
  )
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })

const sponsorDomain = SPONSOR.url.replace(/^https?:\/\//, '').replace(/\/$/, '')
