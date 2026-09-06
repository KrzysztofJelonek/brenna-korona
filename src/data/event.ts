/**
 * Informacje o wydarzeniu — wszystkie pochodzą z materiałów organizatora
 * (koronagorbrennej.pl, checklist-2026.pdf, kg-2025.pdf OPKiS Brenna).
 * Aplikacja jest nieoficjalna, więc nic tu nie jest domysłem.
 */

export const ORGANIZER = {
  email: 'kontakt@koronagorbrennej.pl',
  site: 'https://www.koronagorbrennej.pl/',
  contact: 'https://www.koronagorbrennej.pl/kontakt.php',
  rules: 'https://www.koronagorbrennej.pl/regulamin.php',
  partners: 'https://www.koronagorbrennej.pl/partnerzy.php',
  news: 'https://www.koronagorbrennej.pl/aktualnosci.php',
  checklistPdf: 'https://www.koronagorbrennej.pl/assets/checklist-2026.pdf',
  routesPdf: 'https://turysta.brenna.org.pl/uploads/gallery/kg-2025.pdf',
  facebook: 'https://www.facebook.com/KoronaGorBrennej',
  instagram: 'https://www.instagram.com/korona_gor_brennej/',
  youtube: 'https://www.youtube.com/@KoronaG%C3%B3rBrennej',
  foundation: 'Fundacja Własny Szlak',
  foundationFb: 'https://www.facebook.com/wlasnyszlak',
  commune: 'Gmina Brenna',
  communeSite: 'https://brenna.org.pl',
}

/** Informacja Turystyczna w Brennej — z PDF-u OPKiS. */
export const TOURIST_INFO = {
  address: '43-438 Brenna, ul. Malinowa 2b',
  phone: '(33) 858 69 71',
  phoneHref: '+48338586971',
  email: 'it@brenna.org.pl',
}

export const PROMO_VIDEO = {
  id: 's6Ix_uaRTXk',
  title: 'Korona Gór Brennej 2026 — zapowiedź',
  url: 'https://www.youtube.com/watch?v=s6Ix_uaRTXk',
}

export interface SideEvent {
  date: string
  name: string
}

/** Imprezy towarzyszące — daty wg strony organizatora, godziny mają być podawane osobno. */
export const SIDE_EVENTS: SideEvent[] = [
  { date: '05.09', name: 'Ognisko w Ranczo Błatnia' },
  { date: '11.09', name: 'Spotkanie z Tomaszem Kobielskim' },
  { date: '12.09', name: 'Wycieczka z przewodnikiem i zwiedzanie Obserwatorium Nietoperzy' },
  { date: '20.09', name: 'Placki u Gazdy' },
  { date: '26.09', name: 'Spacer zielarski z Jankiem Michalikiem' },
  { date: '26.09', name: 'Koncert „Muzyka Cóż To” w schronisku na Błatniej' },
]

export const CONTESTS = [
  {
    name: 'Korona Gór Brennej w obiektywie',
    kind: 'konkurs fotograficzny',
    url: 'https://www.koronagorbrennej.pl/aktualnosc.php?slug=konkurs-fotograficzny-korona-gor-brennej-w-obiektywie',
  },
  {
    name: 'Korona Gór Brennej Waszym okiem',
    kind: 'konkurs wideo',
    url: 'https://www.koronagorbrennej.pl/aktualnosc.php?slug=konkurs-wideo-korona-gor-brennej-waszym-okiem',
  },
]

export interface Faq {
  q: string
  a: string
}

/** Pytania i odpowiedzi przepisane z materiałów organizatora. */
export const FAQ: Faq[] = [
  {
    q: 'Kto może wziąć udział?',
    a: 'Każda osoba, której zdrowie, kondycja fizyczna oraz psychiczna pozwalają na samodzielne zdobywanie szczytów górskich. Nie ma zapisów ani wpisowego.',
  },
  {
    q: 'Jak zdobyć Koronę?',
    a: 'Wejść w terminie wydarzenia na wszystkie 20 szczytów, wykonać na każdym zdjęcie uczestnika na tle tabliczki wysokościowej i przesłać komplet do weryfikacji. Liczą się wyłącznie zdjęcia wykonane w czasie trwania wydarzenia.',
  },
  {
    q: 'Jak wygląda weryfikacja?',
    a: 'Komplet zdjęć publikuje się w dyskusji wydarzenia na Facebooku. Każdy zweryfikowany post zostaje skomentowany i oznaczony numerem. Bez konta na Facebooku należy skontaktować się bezpośrednio z organizatorem.',
  },
  {
    q: 'Czy kolejność ma znaczenie?',
    a: 'Nie. Można zdobyć wszystkie szczyty w jeden dzień albo wchodzić na każdy osobno w dowolnym dniu trwania wydarzenia.',
  },
  {
    q: 'Czy można jechać rowerem?',
    a: 'Tak, ale wyłącznie rowerem bez wspomagania elektrycznego. Zdjęcie potwierdzające musi wtedy obejmować także rower, obok uczestnika i tabliczki.',
  },
  {
    q: 'Czy ślad GPS wystarczy zamiast zdjęcia?',
    a: 'Tylko w wyjątkowych okolicznościach i nie dla wszystkich szczytów. Taką możliwość trzeba wcześniej ustalić z organizatorem.',
  },
  {
    q: 'Dlaczego akurat te szczyty?',
    a: 'Wszystkie są ogólnodostępne, leżą na oznakowanych szlakach PTTK i w granicach administracyjnych gminy Brenna.',
  },
  {
    q: 'Czy Koronę można zdobywać wielokrotnie?',
    a: 'Można. Przy każdym kolejnym przesłaniu zdjęć należy o tym poinformować organizatora.',
  },
  {
    q: 'Czy będą gadżety?',
    a: 'Tak. Uczestnicy mogą kupić koszulki, kominy i opaski dedykowane wydarzeniu.',
  },
  {
    q: 'Kiedy odbiór medalu?',
    a: 'Podczas Wielkiego Finału 17 października 2026 w Parku Turystyki w Brennej.',
  },
]

/** Autor aplikacji i sponsor — aplikacja jest nieoficjalna i niekomercyjna. */
export const AUTHOR = {
  name: 'Krzysztof Jelonek',
}

export const SPONSOR = {
  name: 'FaceLove®',
  city: 'Jaworze',
  /** Dopełniacz do zdania „z ...” — mianownik brzmiałby „z Jaworze”. */
  cityGenitive: 'Jaworza',
  tagline: 'Visage & Permanent Makeup',
  url: 'https://facelove.pl',
  /** Logo trzymamy lokalnie — wczytywanie z serwera firmy byłoby zapytaniem do zewnętrznej domeny. */
  logo: 'facelove-logo.png',
}
