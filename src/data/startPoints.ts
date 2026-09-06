export interface StartPoint {
  id: string
  name: string
  /** Doprecyzowanie z materiałów gminy — szlak, adres, opłata. */
  detail?: string
  lat: number
  lon: number
  /** Wysokość z SRTM 30 m (api.opentopodata.org). */
  ele: number
}

/**
 * Punkty startowe wymienione w PDF-ie gminy, ze współrzędnymi z OpenStreetMap
 * i wysokościami z SRTM. To one zamykają dzień w pętlę — bez nich nie da się
 * policzyć ani dojścia, ani powrotu na parking.
 */
export const START_POINTS: StartPoint[] = [
  {
    id: 'gorki-kosciol',
    name: 'Górki Wielkie — parking przy kościele',
    detail: 'Kościół pw. Wszystkich Świętych, zielony szlak',
    lat: 49.77351,
    lon: 18.8555,
    ele: 338,
  },
  {
    id: 'brenna-ug',
    name: 'Brenna Centrum — parking przy Urzędzie Gminy',
    detail: 'ul. Wyzwolenia 77, czarny → zielony (ul. Jastrzębiec), ok. 20 zł/doba',
    lat: 49.72185,
    lon: 18.91697,
    ele: 414,
  },
  {
    id: 'dolina-lesnicy',
    name: 'Brenna Leśnica — ośrodek „Dolina Leśnicy”',
    detail: 'Duży bezpłatny parking',
    lat: 49.68528,
    lon: 18.91179,
    ele: 485,
  },
  {
    id: 'lesnica-szkola',
    name: 'Brenna Leśnica — parking przy szkole podstawowej',
    detail: 'Żółty szlak',
    lat: 49.69521,
    lon: 18.90439,
    ele: 468,
  },
  {
    id: 'holcyna',
    name: 'Brenna Hołcyna — skręt w Dolinę Hołcyny',
    detail: 'Parking przy wałach Brennicy, niebieski szlak',
    lat: 49.71963,
    lon: 18.92849,
    ele: 433,
  },
  {
    id: 'brenna-bukowa',
    name: 'Brenna Bukowa',
    detail: 'Dojazd autobusem od centrum, blisko przełęczy Karkoszczonka',
    lat: 49.71804,
    lon: 18.96436,
    ele: 496,
  },
  {
    id: 'brenna-skrzyzowanie',
    name: 'Brenna Skrzyżowanie',
    detail: 'Czarny i żółty szlak, ul. Żarnowiec',
    lat: 49.75236,
    lon: 18.87058,
    ele: 354,
  },
  {
    id: 'brenna-stacja',
    name: 'Brenna — okolice stacji paliw, ul. Wyzwolenia',
    detail: 'Zielony szlak, ul. Józefa Madzi',
    lat: 49.72619,
    lon: 18.90224,
    ele: 394,
  },
]

export const startPointById = (id?: string): StartPoint | undefined =>
  id ? START_POINTS.find((s) => s.id === id) : undefined
