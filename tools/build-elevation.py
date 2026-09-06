#!/usr/bin/env python3
"""
Buduje siatkę wysokości dla gminy Brenna (SRTM 30 m przez api.opentopodata.org).

Dzięki niej przewyższenie liczy się z realnego profilu trasy, a nie z różnicy
wysokości między szczytami. Siatka ~180 m to kompromis: dokładność wystarczająca
do planowania, rozmiar akceptowalny dla aplikacji działającej offline.

    python3 tools/build-elevation.py
"""
import json, pathlib, time, urllib.request

BBOX = (49.645, 18.830, 49.800, 19.010)
STEP_M = 90
OUT = pathlib.Path(__file__).resolve().parent.parent / 'src' / 'data' / 'elevation.json'
API = 'https://api.opentopodata.org/v1/srtm30m'
UA = 'korona-gor-brennej/1.0 (build script)'

M_PER_DEG_LAT = 111_320
M_PER_DEG_LON = 71_900  # na szerokości ~49.7 stopnia


def main() -> None:
    d_lat = STEP_M / M_PER_DEG_LAT
    d_lon = STEP_M / M_PER_DEG_LON
    rows = int((BBOX[2] - BBOX[0]) / d_lat) + 1
    cols = int((BBOX[3] - BBOX[1]) / d_lon) + 1
    print(f'siatka {cols} x {rows} = {cols * rows} punktów, krok ~{STEP_M} m')

    points = [(BBOX[0] + r * d_lat, BBOX[1] + c * d_lon) for r in range(rows) for c in range(cols)]
    values: list[int] = []
    for i in range(0, len(points), 100):
        chunk = points[i:i + 100]
        loc = '|'.join(f'{a:.6f},{b:.6f}' for a, b in chunk)
        req = urllib.request.Request(f'{API}?locations={loc}', headers={'User-Agent': UA})
        for attempt in range(5):
            try:
                with urllib.request.urlopen(req, timeout=90) as r:
                    res = json.load(r)
                break
            except Exception as e:  # limit zapytań albo chwilowy błąd serwera
                if attempt == 4:
                    raise
                print(f'   ponawiam ({e})')
                time.sleep(5)
        if res.get('status') != 'OK':
            raise SystemExit(f'API zwróciło: {res}')
        values += [int(round(p['elevation'])) if p['elevation'] is not None else 0 for p in res['results']]
        print(f'\r  {len(values)}/{len(points)}', end='', flush=True)
        time.sleep(1.1)  # publiczne API: 1 zapytanie na sekundę
    print()

    payload = {
        'note': 'Wysokości SRTM 30 m (api.opentopodata.org), próbkowane na regularnej siatce.',
        'lat0': BBOX[0], 'lon0': BBOX[1],
        'dLat': d_lat, 'dLon': d_lon,
        'cols': cols, 'rows': rows,
        'data': values,
    }
    OUT.write_text(json.dumps(payload, separators=(',', ':')))
    print(f'zapisano {OUT}: {OUT.stat().st_size / 1024:.0f} KB, zakres {min(values)}–{max(values)} m')


if __name__ == '__main__':
    main()
