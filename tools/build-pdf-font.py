#!/usr/bin/env python3
"""Font z polskimi znakami do eksportu PDF → src/features/export/pdfFont.ts.

Wbudowane fonty jsPDF (Helvetica w kodowaniu WinAnsi) nie mają ą, ć, ę, ł, ń,
ś, ź, ż — w PDF zamieniają się w krzaki. Bierzemy Liberation Sans (SIL OFL 1.1,
metrycznie zgodny z Helvetica/Arial), zostawiamy tylko łacinę z polskimi znakami
i typograficzną interpunkcję (~21 kB na odmianę) i zmieniamy nazwę rodziny:
OFL zastrzega nazwę „Liberation” dla oryginału, a podzbiór jest wersją zmienioną.
Pełny tekst licencji (tools/fonts/OFL.txt) trafia do metadanych fontu.

Uruchamiany ręcznie, wynik jest wersjonowany w repo.
Wymaga: pip install fonttools; pliki fontu z pakietu fonts-liberation
(albo katalog z LiberationSans-{Regular,Bold}.ttf podany w argumencie).
"""

import base64
import io
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'src' / 'features' / 'export' / 'pdfFont.ts'
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/usr/share/fonts/truetype/liberation')

FAMILY = 'KGB Sans'
PS_FAMILY = 'KGBSans'
COPYRIGHT = (
    'Digitized data copyright (c) 2010 Google Corporation with Reserved Font Arimo, Tinos and Cousine. '
    'Copyright (c) 2012 Red Hat, Inc. with Reserved Font Name Liberation. '
    'Modified (subset, renamed) for the Korona Gór Brennej app.'
)
LICENSE_TEXT = (Path(__file__).resolve().parent / 'fonts' / 'OFL.txt').read_text(encoding='utf-8').strip()
UNICODES = [
    *range(0x20, 0x7F),  # ASCII
    *range(0xA0, 0x180),  # Latin-1 + Latin Extended-A (polskie litery)
    0x2013, 0x2014,  # – —
    *range(0x2018, 0x201F),  # ‘ ’ ‚ “ ” „
    0x2022, 0x2026,  # • …
    0x2191, 0x2192, 0x2212,  # ↑ → −
]


def build(style: str) -> tuple[str, str]:
    font = TTFont(SRC / f'LiberationSans-{style}.ttf')
    version = font['name'].getDebugName(5)

    opts = subset.Options()
    opts.layout_features = []
    opts.hinting = False
    opts.desubroutinize = True
    opts.name_IDs = ['*']  # zostają prawa autorskie i treść licencji
    opts.drop_tables += ['FFTM']
    subsetter = subset.Subsetter(opts)
    subsetter.populate(unicodes=UNICODES)
    subsetter.subset(font)

    # OFL 1.1: wersja zmieniona nie może używać zastrzeżonych nazw (Liberation,
    # Arimo, Tinos, Cousine), a każda kopia fontu musi mieć notę copyright i pełny
    # tekst licencji — trzymamy je w tabeli name, więc idą z fontem także do PDF.
    ps_name = f'{PS_FAMILY}-{style}'
    renamed = {
        0: COPYRIGHT,
        1: FAMILY,
        3: f'{ps_name};{version}',
        4: f'{FAMILY} {style}',
        6: ps_name,
        13: LICENSE_TEXT,
        14: 'https://openfontlicense.org',
        16: FAMILY,
        17: style,
    }
    for rec in font['name'].names:
        if rec.nameID in renamed:
            rec.string = renamed[rec.nameID]

    buf = io.BytesIO()
    font.save(buf)
    print(f'{style}: {len(buf.getvalue())} B')
    return base64.b64encode(buf.getvalue()).decode('ascii'), version


def main() -> None:
    regular, version = build('Regular')
    bold, _ = build('Bold')
    OUT.write_text(
        '// Wygenerowane przez tools/build-pdf-font.py — nie edytować ręcznie.\n'
        f'// Podzbiór Liberation Sans ({version}): Copyright (c) 2010 Google Corporation,\n'
        '// Copyright (c) 2012 Red Hat, Inc. Licencja SIL Open Font License 1.1\n'
        '// (https://openfontlicense.org). Nazwa rodziny zmieniona na „KGB Sans”.\n\n'
        f"export const PDF_FONT = '{PS_FAMILY}'\n\n"
        f"export const REGULAR = '{regular}'\n\n"
        f"export const BOLD = '{bold}'\n",
        encoding='utf-8',
    )
    print(f'→ {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
