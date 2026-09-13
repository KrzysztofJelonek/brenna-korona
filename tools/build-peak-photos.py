#!/usr/bin/env python3
"""Zdjęcia szczytów z Wikimedia Commons → public/peaks/*.webp.

Opisy i wybór zdjęć (pola `commons` i `caption`) redaguje się ręcznie
w src/data/peakInfo.json. Skrypt uzupełnia w tym pliku pola pochodne:
wiki.url oraz photos[].src/thumb/w/h/author/license/licenseUrl/page,
pobiera zdjęcia i zapisuje je jako WebP w dwóch rozmiarach: pełny do podglądu
i miniaturę do paska w panelu szczytu (ładowaną od razu, więc lekką).

Uruchamiany ręcznie, wynik jest wersjonowany w repo.
"""

import html
import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
INFO = ROOT / 'src' / 'data' / 'peakInfo.json'
OUT = ROOT / 'public' / 'peaks'
API = 'https://commons.wikimedia.org/w/api.php'
# Wikimedia odrzuca zapytania bez opisowego User-Agent.
UA = {'User-Agent': 'korona-gor-brennej-tools/1.0 (static fan app; one-off data build)'}

# Zdjęcia służą wyłącznie do podglądu na smartfonie: ekran ma ~400 px szerokości
# przy gęstości 2–3×, więc dłuższy bok 960 px wystarcza z zapasem.
MAX_W, MAX_H = 960, 960
MAX_PANO_W = 1280  # panoramy (proporcje > 2,2:1) mogą być szersze
QUALITY = 60
THUMB_H = 360  # pasek ma 176 px wysokości — ×2 na ekranach o dużej gęstości
THUMB_QUALITY = 55


def fetch(url: str) -> bytes:
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if attempt == 4:
                raise
            print(f'  ponawiam ({e})')
            time.sleep(2 + attempt * 3)
    raise RuntimeError('unreachable')


def clean_author(raw: str) -> str:
    text = html.unescape(re.sub(r'<[^>]+>', '', raw)).strip()
    text = re.sub(r'\s*\((?:talk|User:[^)]*)\)', '', text)
    text = re.sub(r'\s+at Polish Wikipedia$', '', text)
    return text or 'autor nieznany'


def target_size(w: int, h: int) -> tuple[int, int]:
    limit_w = MAX_PANO_W if w / h > 2.2 else MAX_W
    s = min(1.0, limit_w / w, MAX_H / h)
    return round(w * s), round(h * s)


def main() -> None:
    data = json.loads(INFO.read_text(encoding='utf-8'))
    peaks = data['peaks']

    files = sorted({p['commons'] for info in peaks.values() for p in info['photos']})
    meta = {}
    for i in range(0, len(files), 40):
        q = {
            'action': 'query',
            'format': 'json',
            'prop': 'imageinfo',
            'iiprop': 'url|size|extmetadata',
            'iiurlwidth': 1920,
            'iiextmetadatafilter': 'Artist|LicenseShortName|LicenseUrl',
            'titles': '|'.join('File:' + f for f in files[i : i + 40]),
        }
        r = json.loads(fetch(API + '?' + urllib.parse.urlencode(q)))
        for page in r['query']['pages'].values():
            if 'imageinfo' not in page:
                sys.exit(f'Brak pliku na Commons: {page["title"]}')
            meta[page['title'].removeprefix('File:')] = page['imageinfo'][0]
    print(f'{len(files)} plików, metadane pobrane')

    OUT.mkdir(parents=True, exist_ok=True)
    saved: dict[str, tuple[str, int, int]] = {}

    for pid, info in peaks.items():
        if info.get('wiki'):
            title = info['wiki']['title'].replace(' ', '_')
            info['wiki']['url'] = 'https://pl.wikipedia.org/wiki/' + urllib.parse.quote(title, safe='()')

        for n, photo in enumerate(info['photos'], 1):
            name = photo['commons']
            ii = meta[name]
            m = ii['extmetadata']

            if name not in saved:
                out = f'{pid}-{n}.webp'
                img = Image.open(io.BytesIO(fetch(ii.get('thumburl') or ii['url'])))
                img = ImageOps.exif_transpose(img).convert('RGB')
                size = target_size(*img.size)
                if size != img.size:
                    img = img.resize(size, Image.LANCZOS)
                img.save(OUT / out, 'WEBP', quality=QUALITY, method=6)
                thumb = out.replace('.webp', '.thumb.webp')
                th = min(THUMB_H, img.height)
                img.resize((round(img.width * th / img.height), th), Image.LANCZOS).save(
                    OUT / thumb, 'WEBP', quality=THUMB_QUALITY, method=6
                )
                saved[name] = (out, *img.size)
                print(
                    f'  {out:32} {img.size[0]}×{img.size[1]}  {(OUT / out).stat().st_size // 1024} KB'
                    f'  miniatura {(OUT / thumb).stat().st_size // 1024} KB'
                )
                time.sleep(0.5)

            photo['src'], photo['w'], photo['h'] = saved[name]
            photo['thumb'] = photo['src'].replace('.webp', '.thumb.webp')
            photo['author'] = clean_author(m.get('Artist', {}).get('value', ''))
            photo['license'] = m['LicenseShortName']['value']
            if m.get('LicenseUrl'):
                photo['licenseUrl'] = m['LicenseUrl']['value']
            photo['page'] = ii['descriptionurl']

    keep = {s[0] for s in saved.values()} | {s[0].replace('.webp', '.thumb.webp') for s in saved.values()}
    for f in OUT.glob('*.webp'):
        if f.name not in keep:
            f.unlink()
            print(f'  usunięto nieużywany {f.name}')

    INFO.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    full = sum((OUT / s[0]).stat().st_size for s in saved.values())
    thumbs = sum((OUT / s[0].replace('.webp', '.thumb.webp')).stat().st_size for s in saved.values())
    print(f'{len(saved)} zdjęć: pełne {full / 1024 / 1024:.1f} MB, miniatury {thumbs / 1024:.0f} KB → {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
