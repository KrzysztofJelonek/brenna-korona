#!/usr/bin/env python3
"""
Buduje sieć szlaków dla routingu w aplikacji.

Wejście: Overpass API (ścieżki i drogi w gminie Brenna + relacje szlaków PTTK).
Wyjście: src/data/trails.json — geometria w kodowaniu delta na siatce ~1 m.

Uruchamiać ręcznie, gdy trzeba odświeżyć dane z OSM:
    python3 tools/build-trails.py
"""
import json, pathlib, urllib.parse, urllib.request

BBOX = (49.645, 18.830, 49.800, 19.010)  # lat_min, lon_min, lat_max, lon_max
OUT = pathlib.Path(__file__).resolve().parent.parent / 'src' / 'data' / 'trails.json'
API = 'https://overpass-api.de/api/interpreter'

HIGHWAYS = 'path|footway|track|bridleway|steps|unclassified|residential|service|tertiary|secondary|living_street|pedestrian'


# Overpass odrzuca żądania bez User-Agenta (HTTP 406).
UA = 'korona-gor-brennej/1.0 (build script; https://github.com/KrzysztofJelonek/brenna-korona)'


def overpass(query: str) -> dict:
    data = urllib.parse.urlencode({'data': query}).encode()
    req = urllib.request.Request(API, data=data, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)


def main() -> None:
    b = ','.join(str(x) for x in BBOX)
    print('pobieram sieć dróg i ścieżek…')
    ways = overpass(f'[out:json][timeout:180];way["highway"~"^({HIGHWAYS})$"]({b});out geom;')['elements']

    print('pobieram relacje znakowanych szlaków…')
    rel = overpass(f'[out:json][timeout:180];rel["route"="hiking"]({b});(._;>>;);out geom;')['elements']
    marked_ids = {e['id'] for e in rel if e['type'] == 'way'}
    marked_ways = [e for e in rel if e['type'] == 'way']

    inside = lambda p: BBOX[0] <= p['lat'] <= BBOX[2] and BBOX[1] <= p['lon'] <= BBOX[3]

    seen, out = set(), []
    for src in (ways, marked_ways):
        for w in src:
            if w['id'] in seen:
                continue
            g = w.get('geometry') or []
            if len(g) < 2 or not any(inside(p) for p in g):
                continue
            seen.add(w['id'])

            lat = round(g[0]['lat'] * 1e5)
            lon = round(g[0]['lon'] * 1e5)
            enc = [1 if w['id'] in marked_ids else 0, lat, lon]
            pl, pn = lat, lon
            for p in g[1:]:
                la, lo = round(p['lat'] * 1e5), round(p['lon'] * 1e5)
                if la == pl and lo == pn:
                    continue
                enc += [la - pl, lo - pn]
                pl, pn = la, lo
            if len(enc) > 3:
                out.append(enc)

    payload = {
        'note': 'Sieć dróg i ścieżek z OpenStreetMap (ODbL). Kodowanie delta, siatka 1e-5 stopnia (~1 m).',
        'bbox': list(BBOX),
        'scale': 100000,
        'format': '[oznakowany, lat0, lon0, dlat, dlon, ...]',
        'ways': out,
    }
    OUT.write_text(json.dumps(payload, separators=(',', ':')))
    pts = sum((len(w) - 3) // 2 + 1 for w in out)
    print(f'zapisano {OUT}: {len(out)} odcinków, {pts} punktów, {OUT.stat().st_size / 1024:.0f} KB')
    print(f'oznakowanych szlaków: {sum(w[0] for w in out)}')


if __name__ == '__main__':
    main()
