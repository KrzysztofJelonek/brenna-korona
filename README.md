# Korona Gór Brennej — pomocnik uczestnika

Statyczna aplikacja webowa, która prowadzi uczestnika przez wyzwanie **Korona Gór Brennej 2026**: pozwala zaplanować trasę, odhaczyć zdobyte szczyty, podpiąć zdjęcie do każdego wierzchołka, zobaczyć postęp na mapie — i na koniec **wygenerować gotowy komplet zdjęć do weryfikacji**.

Bez logowania, bez rejestracji, bez backendu. Wszystkie dane zostają w przeglądarce użytkownika. Wgrywasz katalog na dowolny hosting i działa — na komputerze i na telefonie.

> Ten dokument jest jednocześnie opisem projektu i planem implementacji. Sekcje 1–5 mówią *co* powstaje, sekcje 6–8 *jak* to zbudować.

---

## 1. O wyzwaniu

**Korona Gór Brennej** to wydarzenie polegające na zdobyciu **20 szczytów** leżących na terenie gminy Brenna.

| | |
|---|---|
| **Termin edycji 2026** | 1–30 września 2026 |
| **Zapisy** | brak — wystarczą chęci i kondycja |
| **Kolejność** | dowolna; można wszystko w jeden dzień albo rozłożyć na cały miesiąc |
| **Sposób** | pieszo lub rowerem **bez wspomagania elektrycznego** |
| **Dowód** | zdjęcie uczestnika na tle tabliczki wysokościowej szczytu |
| **Weryfikacja** | publikacja kompletu zdjęć w dyskusji wydarzenia na Facebooku |
| **Zakończenie** | uroczyste wręczenie medali 17 października 2026, Park Turystyki |
| **Motyw edycji** | nietoperze — „Nietoperze przejmują tegoroczną edycję" |

Szczegóły, które wpływają na projekt aplikacji:

- **Liczą się tylko zdjęcia wykonane w terminie trwania wydarzenia.** Zdjęcie z sierpnia zostanie odrzucone → aplikacja waliduje datę EXIF i ostrzega.
- **Przy zdobywaniu rowerem zdjęcie musi obejmować także rower.** → model danych rozróżnia tryb wejścia.
- **Ślad GPS zaliczany tylko wyjątkowo**, po wcześniejszym ustaleniu z organizatorem, i nie dla wszystkich szczytów. → GPX w aplikacji jest wsparciem dla siebie, nie dowodem.
- **Koronę można zdobywać wielokrotnie** — przy kolejnym zgłoszeniu trzeba o tym poinformować.
- Wszystkie szczyty leżą na oznakowanych szlakach PTTK i są ogólnodostępne.

Źródła: [koronagorbrennej.pl](https://www.koronagorbrennej.pl/) · [checklist 2026 (PDF)](https://www.koronagorbrennej.pl/assets/checklist-2026.pdf) · [propozycje tras, OPKiS Brenna (PDF)](https://turysta.brenna.org.pl/uploads/gallery/kg-2025.pdf)

---

## 2. Co robi aplikacja

### Rdzeń

**Checklista 20 szczytów.** Karta każdego szczytu ze statusem (`do zdobycia` / `zaplanowany` / `zdobyty`), datą zdobycia, trybem wejścia (pieszo / rower) i własną notatką. Jedno kliknięcie = odhaczone. Pasek postępu 0/20 zawsze widoczny.

**Zdjęcie przy szczycie.** Dodajesz prosto z aparatu albo z galerii. Aplikacja:
- kompresuje zdjęcie w przeglądarce (`canvas` → WebP, ~300 KB) i zapisuje w IndexedDB,
- czyta EXIF: **datę** (auto-uzupełnia datę zdobycia) i **współrzędne GPS** (porównuje z pozycją szczytu),
- **ostrzega, jeśli data wypada poza 1–30.09.2026** — czyli zanim organizator odrzuci zgłoszenie,
- pozwala trzymać kilka zdjęć na szczyt i wybrać to jedno „do zgłoszenia".

**Planer trasy.** Cztery gotowe warianty przygotowane przez gminę (1, 2, 4 i 6 dni) plus własny plan: przeciągasz szczyty na kolejne dni, a aplikacja na bieżąco liczy dystans, sumę podejść i szacowany czas (reguła Naismitha z korektą Toblera). Dla każdego dnia widzisz profil wysokościowy.

**Mapa.** Leaflet + OpenStreetMap z nakładką szlaków turystycznych. Markery 20 szczytów kolorowane statusem, trasa zaplanowanego dnia jako linia, kliknięcie w marker otwiera panel szczytu (zdjęcie, notatka, odhaczenie).

### Eksport dowodu i udostępnianie

To najważniejsza funkcja użytkowa, bo odwzorowuje realny proces weryfikacji.

**Generator kolażu na Facebooka.** Aplikacja składa 20 zdjęć w czytelną siatkę z podpisami (nazwa szczytu, wysokość, data zdobycia) i eksportuje jako PNG albo wielostronicowy PDF — plik gotowy do wrzucenia w dyskusję wydarzenia.

**Karta podsumowania.** Ładny obrazek do udostępnienia: 20/20, suma przewyższenia, zakres dat, mapka trasy.

**Backup i przenoszenie.** Eksport całego stanu (postęp, plan, notatki, zdjęcia) do jednego pliku i import na innym urządzeniu. Bez tego wyczyszczenie danych przeglądarki oznacza utratę wszystkiego — dlatego aplikacja aktywnie przypomina o backupie po zdobyciu co piątego szczytu.

### W terenie

**PWA.** Instalacja na telefonie jak zwykła aplikacja, własna ikona, uruchamianie bez paska przeglądarki. Service Worker cache'uje aplikację i zdjęcia, więc checklista działa **bez zasięgu**; kafelki mapy wymagają internetu.

**Geolokalizacja.** „Jesteś 340 m od Hyrcy" — dystans i kierunek do najbliższych szczytów, lista posortowana od najbliższego. Po wejściu w promień ~150 m od wierzchołka aplikacja sama proponuje odhaczenie.

**Ślad wycieczki.** Zapis trasy w tle i eksport do GPX — do własnego archiwum albo do Stravy.

### Świadomie poza zakresem MVP

Grywalizacja (odznaki, rankingi, statystyki roczne), cache kafelków mapy offline, jakikolwiek backend, konta i synchronizacja między urządzeniami (rolę synchronizacji pełni eksport/import pliku).

---

## 3. Dane

### 3.1 Szczyty

Wysokości pochodzą z checklisty organizatora (wiążące — takie są na tabliczkach). Współrzędne z OpenStreetMap przez Overpass API. Plik: [`src/data/peaks.json`](src/data/peaks.json).

| # | Szczyt | m n.p.m. | lat | lon |
|---|---|---:|---|---|
| 1 | Zebrzydka | 557 | 49.77055 | 18.88253 |
| 2 | Świniorka | 700 | 49.68498 | 18.90001 |
| 3 | Czupel | 736 | 49.75607 | 18.90118 |
| 4 | Stary Groń | 792 | 49.69353 | 18.92349 |
| 5 | Horzelica | 797 | 49.70086 | 18.91576 |
| 6 | Jaworzyna | 802 | 49.65770 | 18.94223 |
| 7 | Trzy Kopce Wiślańskie | 810 | 49.66429 | 18.90730 |
| 8 | Orłowa | 813 | 49.69698 | 18.87847 |
| 9 | Gościejów | 818 | 49.65858 | 18.92162 |
| 10 | Mały Cisowy | 829 | 49.74966 | 18.91480 |
| 11 | Beskidek | 830 | 49.70635 | 18.94328 |
| 12 | Wielka Cisowa | 878 | 49.74511 | 18.93170 |
| 13 | Równica | 884 | 49.72470 | 18.85656 |
| 14 | Grabowa | 907 | 49.67780 | 18.95456 |
| 15 | Błatnia | 917 | 49.74835 | 18.94533 |
| 16 | Hyrca | 929 | 49.70080 | 18.98066 |
| 17 | Biały Krzyż | 940 | 49.67013 | 18.95904 |
| 18 | Kotarz | 974 | 49.68908 | 18.96364 |
| 19 | Stołów | 1035 | 49.74516 | 18.96529 |
| 20 | Trzy Kopce | 1082 | 49.73662 | 18.98631 |

### 3.2 Propozycja tras — wariant 6-dniowy

Jedyny wariant, dla którego PDF gminy podaje pełne rozbicie na dni w formie tekstu.

| Dzień | Start | Szczyty | Czas / dystans |
|---|---|---|---|
| I | parking przy skręcie w Dolinę Hołcyny | Kotarz, Hyrca, Beskidek | 5:17 h / 16,7 km |
| II | Brenna Leśnica, ośrodek „Dolina Leśnicy" | Stary Groń, Horzelica, Grabowa, Biały Krzyż, Jaworzyna, Gościejów, Trzy Kopce Wiślańskie | 5:40 h / 17,6 km |
| III | Górki Wielkie, parking przy kościele | Zebrzydka, Czupel, Mały Cisowy | 3:34 h / 10,1 km |
| IV | Brenna Leśnica, parking przy szkole podstawowej | Orłowa, Świniorka | 3:56 h / 12,2 km |
| V | Brenna Skrzyżowanie | Równica | 3:35 h / 10,7 km |
| VI | parkingi Brenna Centrum (20 zł/doba) | Wielka Cisowa, Błatnia, Stołów, Trzy Kopce | 4:20 h / 12,1 km |

Razem: 20 szczytów, ok. 26 h marszu, 79,4 km.

Znane punkty startowe pozostałych wariantów (z PDF, bez przypisania szczytów): Górki Wielkie — kościół Wszystkich Świętych (zielony) · ośrodek „Pod Brandysem", ul. Pod Zebrzydkę (zielony) · początek ul. Leśnica przy stacji benzynowej (czarny / zielony) · parking przy UG Brenna, ul. Wyzwolenia 77 (czarny → zielony, ul. Jastrzębiec) · ul. Hołcyna, wały Brennicy (niebieski) · Brenna Skrzyżowanie (czarny, żółty, ul. Żarnowiec).

### 3.3 Do weryfikacji ⚠

Trzy rzeczy, których **nie** dało się rozstrzygnąć z materiałów źródłowych — do potwierdzenia przed publikacją:

1. **Beskidek (830 m).** Węzeł OSM o nazwie „Beskidek" ma wysokość 700 m i leży w innej części gminy. W danych przyjęto nienazwany węzeł OSM 831 m na grani Karkoszczonka–Hyrca, bo zgadza się z opisem trasy z PDF (Kotarz → Hyrca → **Beskidek** → przełęcz Karkoszczonka). Wymaga potwierdzenia w terenie. Uwaga organizatora: liczy się **Beskidek 830 m, a nie Beskid 860 m**, przez który nie przechodzi szlak.
2. **Zebrzydka.** OSM podaje 577 m, checklist organizatora 557 m. Aplikacja pokazuje 557 m (tabliczka jest wiążąca).
3. **Warianty 1-, 2- i 4-dniowy.** W PDF istnieją wyłącznie jako mapy-obrazki — rozbicia na dni nie da się z nich wyciągnąć tekstowo. Do uzupełnienia ręcznie z map albo do wygenerowania algorytmicznie przez planer.

---

## 4. Architektura

**Stack:** Vite · React · TypeScript · Tailwind CSS · Leaflet (react-leaflet) · Framer Motion · zustand · idb · exifr · vite-plugin-pwa.

```
korona-gor-brennej/
├── index.html
├── vite.config.ts              # base: './' — działa też z podkatalogu na serwerze
├── src/
│   ├── data/
│   │   ├── peaks.json          # 20 szczytów: id, nazwa, wysokość, lat, lon
│   │   └── routes.json         # warianty 1/2/4/6-dniowe
│   ├── store/
│   │   ├── progress.ts         # zustand + persist → localStorage
│   │   └── media.ts            # idb → IndexedDB (zdjęcia, ślady GPX)
│   ├── features/
│   │   ├── checklist/
│   │   ├── map/
│   │   ├── planner/
│   │   ├── export/             # kolaż FB, karta podsumowania, backup
│   │   └── field/              # geolokalizacja, GPX
│   └── ui/                     # komponenty współdzielone
└── dist/                       # ← to wgrywasz na serwer
```

### Model danych

```ts
type PeakId = 'zebrzydka' | 'swiniorka' | /* … */ 'trzy-kopce';
type PeakStatus = 'todo' | 'planned' | 'done';
type AscentMode = 'foot' | 'bike';

interface Peak {            // statyczne, z peaks.json
  id: PeakId; no: number; name: string;
  ele: number; lat: number; lon: number;
  note?: string; verify?: string;
}

interface PeakProgress {    // stan użytkownika, localStorage
  peakId: PeakId;
  status: PeakStatus;
  conqueredAt?: string;     // ISO
  ascentMode?: AscentMode;
  photoIds: string[];       // klucze w IndexedDB
  primaryPhotoId?: string;  // to zdjęcie idzie do kolażu
  note?: string;
}

interface DayPlan {
  id: string; name: string; date?: string;
  startPoint?: string;
  peakIds: PeakId[];
}

interface Photo {           // IndexedDB
  id: string; peakId: PeakId;
  blob: Blob;               // WebP po kompresji
  takenAt?: string;         // z EXIF
  gps?: { lat: number; lon: number };
}
```

### Podział pamięci — świadomy i istotny

| Co | Gdzie | Dlaczego |
|---|---|---|
| postęp, plan, notatki, ustawienia | **localStorage** (przez `zustand/persist`) | kilkanaście kB, synchroniczny odczyt przy starcie |
| zdjęcia, ślady GPX | **IndexedDB** (przez `idb`) | localStorage ma limit ~5 MB i trzyma tylko stringi; 20 zdjęć × ~300 KB ≈ 6 MB — nie zmieściłoby się |

Wpychanie zdjęć do localStorage (choćby jako base64) to najczęstszy błąd w takich projektach — kończy się cichym `QuotaExceededError` i utratą danych. Zdjęcia idą do IndexedDB jako `Blob`, bez konwersji.

### Design

Mobile-first, bo aplikacja jest używana w terenie, na telefonie, często w rękawiczkach: duże cele dotykowe, dolna nawigacja, kluczowe akcje w zasięgu kciuka. Tryb ciemny domyślny, w motywie nietoperzowym edycji 2026. Na desktopie układ bento-grid. Płynne przejścia (View Transitions API), animacje sprężynowe (Framer Motion), zmienne fonty.

---

## 5. Uruchomienie i wdrożenie

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
npm run preview  # podgląd builda lokalnie
```

Wdrożenie: skopiuj zawartość `dist/` na dowolny hosting statyczny (FTP, GitHub Pages, Netlify, Cloudflare Pages). Dzięki `base: './'` w `vite.config.ts` działa również z podkatalogu, np. `example.com/korona/`.

**Wymagany HTTPS** — geolokalizacja, aparat i Service Worker nie działają po HTTP (poza `localhost`).

---

## 6. Plan implementacji

| Etap | Zakres | Gotowe, gdy |
|---|---|---|
| **E1** | Szkielet: Vite + React + TS + Tailwind, `peaks.json`, routing, layout mobilny, motyw | aplikacja startuje, widać listę 20 szczytów z danych |
| **E2** | Checklista + store: odhaczanie, `zustand/persist`, tryb pieszo/rower, notatki, pasek postępu | postęp przeżywa odświeżenie strony |
| **E3** | Zdjęcia: upload z aparatu/galerii, kompresja `canvas`→WebP, IndexedDB, EXIF (data + GPS), walidacja terminu wydarzenia | zdjęcie z sierpnia pokazuje ostrzeżenie o terminie |
| **E4** | Mapa: Leaflet + OSM, nakładka szlaków, markery wg statusu, panel szczytu | z mapy da się odhaczyć szczyt |
| **E5** | Planer: warianty z PDF, własny plan (drag&drop), dystans / przewyższenie / czas (Naismith+Tobler), profil wysokościowy | wariant 6-dniowy zgadza się z tabelą 3.2 |
| **E6** | Eksport: kolaż na FB (PNG/PDF), karta podsumowania, backup i import stanu | plik z backupu odtwarza pełny stan na czystej przeglądarce |
| **E7** | Teren: PWA + Service Worker, geolokalizacja, promień odhaczenia, zapis i eksport GPX | aplikacja działa w trybie samolotowym (bez kafelków mapy) |
| **E8** | Szlif: animacje, dostępność, Lighthouse, deploy | Lighthouse ≥ 90 w każdej kategorii na mobile |

**Kolejność ma znaczenie.** E1–E3 dają produkt już użyteczny na wyzwaniu (checklista + zdjęcia to minimum). E6 to funkcja o najwyższej wartości — warto go zrobić przed E7, jeśli czasu jest mało.

---

## 7. Weryfikacja

- **Dane:** `peaks.json` ma 20 wpisów, unikalne `id`, wysokości 557…1082 rosnąco, każdy wpis z `lat`/`lon`.
- **Trasy:** suma szczytów w wariancie 6-dniowym = 20, bez powtórzeń.
- **Persystencja:** odhaczenie szczytu + dodanie zdjęcia → twardy refresh → stan zachowany.
- **Limity:** 20 zdjęć naraz nie wywala `QuotaExceededError`; sprawdzić w DevTools → Application → Storage.
- **Offline:** DevTools → Network → Offline; checklista i zdjęcia działają, mapa pokazuje komunikat o braku kafelków.
- **Mobile:** test na realnym telefonie po HTTPS — aparat, geolokalizacja, instalacja PWA.
- **Backup:** eksport → tryb prywatny → import → stan identyczny.

---

## 8. Zastrzeżenia

Projekt **nieoficjalny i fanowski**. Nie jest powiązany z organizatorem wyzwania ani z Gminą Brenna. Jedyną wiążącą procedurą zaliczenia jest ta opisana przez organizatora na [koronagorbrennej.pl](https://www.koronagorbrennej.pl/) — aplikacja niczego nie zgłasza za Ciebie i nie zastępuje weryfikacji.

Wszystkie dane (postęp, zdjęcia, notatki) są przechowywane **wyłącznie lokalnie w Twojej przeglądarce**. Nic nie jest wysyłane na serwer. Oznacza to również, że **wyczyszczenie danych przeglądarki kasuje postęp** — korzystaj z eksportu backupu.

Dane szczytów pochodzą z materiałów organizatora i OpenStreetMap (© kontrybutorzy OpenStreetMap, ODbL). W górach kieruj się oznakowaniem szlaków PTTK, nie aplikacją.
