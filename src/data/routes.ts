import type { RoutePreset } from '../types'

/**
 * Warianty tras zaproponowane przez OPKiS Brenna (kg-2025.pdf).
 *
 * Pełne rozbicie na dni PDF podaje tekstowo wyłącznie dla wariantu 6-dniowego —
 * i tylko ten wariant ma tu przypisane szczyty oraz oficjalne czasy i dystanse.
 * Warianty 1/2/4-dniowe istnieją w PDF jedynie jako mapy-obrazki, więc mają
 * udokumentowane punkty startowe, a podział szczytów jest naszą propozycją
 * (geograficznie spójną) — oznaczoną w UI jako szacunek.
 */

export const ROUTE_PRESETS: RoutePreset[] = [
  {
    id: 'p6',
    name: 'Sześć dni',
    days: 6,
    description:
      'Oficjalna propozycja gminy Brenna — jedyny wariant z pełnym opisem w PDF. Razem ok. 26 h marszu i 79,4 km.',
    plans: [
      {
        id: 'p6d1',
        name: 'Dzień I',
        startPoint: 'Parking przy skręcie w Dolinę Hołcyny',
        peakIds: ['kotarz', 'hyrca', 'beskidek'],
        officialDistanceKm: 16.7,
        officialTime: '5:17 h',
      },
      {
        id: 'p6d2',
        name: 'Dzień II',
        startPoint: 'Brenna Leśnica, ośrodek „Dolina Leśnicy”',
        peakIds: [
          'stary-gron',
          'horzelica',
          'grabowa',
          'bialy-krzyz',
          'jaworzyna',
          'gosciejow',
          'trzy-kopce-wislanskie',
        ],
        officialDistanceKm: 17.6,
        officialTime: '5:40 h',
      },
      {
        id: 'p6d3',
        name: 'Dzień III',
        startPoint: 'Górki Wielkie, parking przy kościele',
        peakIds: ['zebrzydka', 'czupel', 'maly-cisowy'],
        officialDistanceKm: 10.1,
        officialTime: '3:34 h',
      },
      {
        id: 'p6d4',
        name: 'Dzień IV',
        startPoint: 'Brenna Leśnica, parking przy szkole podstawowej',
        peakIds: ['orlowa', 'swiniorka'],
        officialDistanceKm: 12.2,
        officialTime: '3:56 h',
      },
      {
        id: 'p6d5',
        name: 'Dzień V',
        startPoint: 'Brenna Skrzyżowanie',
        peakIds: ['rownica'],
        officialDistanceKm: 10.7,
        officialTime: '3:35 h',
      },
      {
        id: 'p6d6',
        name: 'Dzień VI',
        startPoint: 'Parkingi Brenna Centrum (20 zł/doba)',
        peakIds: ['wielka-cisowa', 'blatnia', 'stolow', 'trzy-kopce'],
        officialDistanceKm: 12.1,
        officialTime: '4:20 h',
      },
    ],
  },
  {
    id: 'p4',
    name: 'Cztery dni',
    days: 4,
    description:
      'Punkty startowe z PDF gminy. Podział szczytów na dni to nasza propozycja — w PDF ten wariant jest wyłącznie mapą.',
    plans: [
      {
        id: 'p4d1',
        name: 'Dzień I',
        startPoint: 'Parking przy Urzędzie Gminy Brenna, ul. Wyzwolenia 77 (czarny → zielony, ul. Jastrzębiec)',
        peakIds: ['wielka-cisowa', 'blatnia', 'stolow', 'trzy-kopce'],
      },
      {
        id: 'p4d2',
        name: 'Dzień II',
        startPoint: 'Początek ul. Leśnica, okolice stacji benzynowej (czarny)',
        peakIds: ['kotarz', 'hyrca', 'beskidek'],
      },
      {
        id: 'p4d3',
        name: 'Dzień III',
        startPoint: 'Początek ul. Leśnica, okolice stacji benzynowej (zielony)',
        peakIds: [
          'stary-gron',
          'horzelica',
          'grabowa',
          'bialy-krzyz',
          'jaworzyna',
          'gosciejow',
          'trzy-kopce-wislanskie',
        ],
      },
      {
        id: 'p4d4',
        name: 'Dzień IV',
        startPoint: 'Okolice stacji benzynowej ul. Wyzwolenia (zielony, ul. Józefa Madzi)',
        peakIds: ['zebrzydka', 'czupel', 'maly-cisowy', 'rownica', 'orlowa', 'swiniorka'],
      },
    ],
  },
  {
    id: 'p2',
    name: 'Dwa dni',
    days: 2,
    description:
      'Mocne tempo. Punkty startowe z PDF gminy, podział szczytów to nasza propozycja.',
    plans: [
      {
        id: 'p2d1',
        name: 'Dzień I',
        startPoint: 'Początek ul. Leśnica, okolice stacji benzynowej i Ośrodka Zdrowia (czarny)',
        peakIds: [
          'kotarz',
          'hyrca',
          'beskidek',
          'stolow',
          'trzy-kopce',
          'blatnia',
          'wielka-cisowa',
          'maly-cisowy',
          'czupel',
          'zebrzydka',
        ],
      },
      {
        id: 'p2d2',
        name: 'Dzień II',
        startPoint: 'Górki Wielkie, parking przy kościele lub ośrodek „Pod Brandysem” (zielony)',
        peakIds: [
          'rownica',
          'orlowa',
          'swiniorka',
          'horzelica',
          'stary-gron',
          'grabowa',
          'bialy-krzyz',
          'jaworzyna',
          'gosciejow',
          'trzy-kopce-wislanskie',
        ],
      },
    ],
  },
  {
    id: 'p1',
    name: 'Jeden dzień',
    days: 1,
    description:
      'Wyzwanie dla bardzo mocnych. Wszystkie 20 szczytów za jednym razem — start z Górek Wielkich wg PDF gminy.',
    plans: [
      {
        id: 'p1d1',
        name: 'Cały dzień',
        startPoint:
          'Parking przy kościele pw. Wszystkich Świętych w Górkach Wielkich lub ośrodek „Pod Brandysem”, ul. Pod Zebrzydkę (zielony)',
        peakIds: [
          'zebrzydka',
          'czupel',
          'maly-cisowy',
          'wielka-cisowa',
          'blatnia',
          'stolow',
          'trzy-kopce',
          'hyrca',
          'beskidek',
          'kotarz',
          'grabowa',
          'bialy-krzyz',
          'jaworzyna',
          'gosciejow',
          'trzy-kopce-wislanskie',
          'stary-gron',
          'horzelica',
          'swiniorka',
          'orlowa',
          'rownica',
        ],
      },
    ],
  },
]

/** Pozostałe punkty startowe wymienione w PDF, przydatne przy własnym planie. */
export const START_POINTS = [
  'Parking przy kościele pw. Wszystkich Świętych w Górkach Wielkich',
  'Ośrodek „Pod Brandysem”, ul. Pod Zebrzydkę',
  'Początek ul. Leśnica (stacja benzynowa, Ośrodek Zdrowia)',
  'Parking przy Urzędzie Gminy Brenna, ul. Wyzwolenia 77',
  'Parking przy ul. Hołcyna (wały Brennicy)',
  'Brenna Skrzyżowanie',
  'Brenna Leśnica, ośrodek „Dolina Leśnicy”',
  'Brenna Leśnica, parking przy szkole podstawowej',
  'Parking przy skręcie w Dolinę Hołcyny',
  'Parkingi Brenna Centrum',
]
