# Korona Gór Brennej — dokumentacja projektowa

Statyczna aplikacja webowa dla uczestników wyzwania **Korona Gór Brennej 2026**: checklista 20 szczytów, zdjęcia z walidacją EXIF, planer tras liczonych po realnych szlakach, mapa i generator kompletu zdjęć do weryfikacji u organizatora.

Bez backendu, bez kont, bez śledzenia. Wszystkie dane użytkownika zostają w jego przeglądarce. Build to zwykłe pliki statyczne.

**Projekt nieoficjalny i fanowski** — nie jest powiązany z organizatorem ani z Gminą Brenna.

| | |
|---|---|
| Stack | Vite · React · TypeScript · Tailwind v4 · Leaflet · zustand · idb · exifr · Framer Motion |
| Kod | 33 pliki źródłowe, ~4 600 linii |
| Bundle startowy | 99 KB gzip |
| Pełny payload offline | 2,1 MB (16 plików w precache) |
| Autor | Krzysztof Jelonek · sponsor: FaceLove® z Jaworza |

---

## Spis treści

1. [O wyzwaniu i co z niego wynika](#1-o-wyzwaniu-i-co-z-niego-wynika)
2. [Funkcje](#2-funkcje)
3. [Dane i ich pochodzenie](#3-dane-i-ich-pochodzenie)
4. [Jak powstają ślady tras](#4-jak-powstają-ślady-tras) ← *pipeline routingu*
5. [Model obliczeniowy i jego kalibracja](#5-model-obliczeniowy-i-jego-kalibracja)
6. [Generator planów](#6-generator-planów)
7. [Architektura](#7-architektura)
8. [Warstwa wizualna](#8-warstwa-wizualna)
9. [Prywatność — jak jest zrobiona technicznie](#9-prywatność--jak-jest-zrobiona-technicznie)
10. [Narzędzia budujące dane](#10-narzędzia-budujące-dane)
11. [Uruchomienie i wdrożenie](#11-uruchomienie-i-wdrożenie)
12. [Metodyka testów](#12-metodyka-testów)
13. [Znane ograniczenia i dług techniczny](#13-znane-ograniczenia-i-dług-techniczny)

---

## 1. O wyzwaniu i co z niego wynika

**Korona Gór Brennej** to zdobycie **20 szczytów** w gminie Brenna.

| | |
|---|---|
| Termin edycji 2026 | 1–30 września 2026 |
| Zapisy | brak |
| Kolejność | dowolna |
| Sposób | pieszo lub rowerem bez wspomagania elektrycznego |
| Dowód | zdjęcie uczestnika na tle tabliczki wysokościowej |
| Weryfikacja | publikacja kompletu zdjęć w dyskusji wydarzenia na Facebooku |
| Finał | 17 października 2026, Park Turystyki w Brennej |
| Motyw edycji | nietoperze |

Każda z tych zasad wymusiła konkretną decyzję w kodzie:

| Zasada organizatora | Konsekwencja w aplikacji |
|---|---|
| Liczą się tylko zdjęcia z okresu wydarzenia | odczyt daty z EXIF i ostrzeżenie, gdy wypada poza 1–30.09.2026 |
| Przy rowerze zdjęcie musi obejmować rower | `ascentMode: 'foot' \| 'bike'` w modelu i przypomnienie w UI |
| Weryfikacja = komplet zdjęć na Facebooku | generator kolażu jako główna funkcja eksportu |
| Ślad GPS uznawany tylko wyjątkowo | GPX jest wsparciem dla użytkownika, UI mówi wprost, że nie jest dowodem |
| Szczyty leżą na oznakowanych szlakach PTTK | router preferuje szlaki znakowane (kara ×4 za pozostałe) |
| Koronę można zdobywać wielokrotnie | brak blokad, postęp da się wyzerować |

Źródła: [koronagorbrennej.pl](https://www.koronagorbrennej.pl/) · [checklist 2026 (PDF)](https://www.koronagorbrennej.pl/assets/checklist-2026.pdf) · [propozycje tras, OPKiS Brenna (PDF)](https://turysta.brenna.org.pl/uploads/gallery/kg-2025.pdf)

---

## 2. Funkcje

Sześć zakładek: **Szczyty · Mapa · Plan · Teren · Dowód · Info**.

### Szczyty

Lista 20 wierzchołków ze statusem (`do zdobycia` / `zaplanowany` / `zdobyty`), datą, trybem wejścia i notatką. Sortowanie po wysokości, alfabetycznie, po tym co zostało, albo po odległości od aktualnej pozycji. Pierścień postępu w nagłówku.

Panel szczytu obsługuje zdjęcia:

- upload z aparatu lub galerii (`capture="environment"`),
- kompresja w `canvas` → WebP ~300 KB, z fallbackiem na JPEG dla starszego Safari,
- odczyt EXIF przez `exifr`: **data** uzupełnia datę zdobycia, **GPS** porównywany ze współrzędnymi szczytu (ostrzeżenie powyżej 500 m),
- ostrzeżenie, gdy data wypada poza terminem wydarzenia,
- wiele zdjęć na szczyt, jedno oznaczone gwiazdką jako to, które trafi do kolażu.

### Mapa

Leaflet + OpenStreetMap albo OpenTopoMap, z nakładką szlaków z Waymarked Trails (przyciemnioną do 0,55, żeby nie konkurowała z trasą).

Nad mapą **pasek dni pełniący jednocześnie rolę legendy i filtru**:

- *Wszystkie* — każdy dzień innym kolorem, widok dopasowany do całego planu,
- wybrany dzień — tylko jego trasa, szczyty ponumerowane w kolejności przejścia, pozostałe przygaszone do małych kropek,
- marker `P` w miejscu startu, trasa domknięta do niego przy trybie pętli,
- pasek pod mapą: liczba szczytów, dystans, czas, suma podejść.

### Plan

Cztery gotowe warianty gminy (1, 2, 4, 6 dni), generator własnych wariantów oraz ręczna edycja: dodawanie szczytów dotknięciem, zmiana kolejności strzałkami, wybór parkingu z listy, przełącznik **Pętla / Punkt-punkt**, data dnia.

Przycisk **Na mapie** przy każdym dniu przenosi na mapę z tym dniem już wybranym.

### Teren

Odległość i kierunek do najbliższych szczytów, propozycja zaliczenia po wejściu w promień 150 m, zapis śladu i eksport do GPX. Ograniczenia tej zakładki opisuje [sekcja 13](#13-znane-ograniczenia-i-dług-techniczny).

### Dowód

Najważniejsza funkcja użytkowa, bo odwzorowuje realny proces weryfikacji:

- **kolaż** — 20 zdjęć w siatce 4×5 z podpisami (nazwa, wysokość, data), JPG gotowy do wklejenia na Facebooka,
- **PDF** — sześć zdjęć na stronę, jsPDF ładowany dynamicznie,
- **karta podsumowania** — kwadrat 1080×1080 z licznikiem, sumą wysokości i zakresem dat, na tle rysowanej sylwetki gór (to grafika, nie mapa), z `navigator.share` gdy dostępne,
- **backup** — cały stan wraz ze zdjęciami do jednego pliku JSON i import z powrotem.

Aplikacja przypomina o backupie po zdobyciu co piątego szczytu, nie częściej niż raz na dobę.

### Info

Zasady, zapowiedź wideo, przegląd wariantów, 10 pytań i odpowiedzi z materiałów organizatora, imprezy towarzyszące, konkursy, komplet kontaktów oraz informacja o autorze i sponsorze.

### Świadomie poza zakresem

Grywalizacja, cache kafelków mapy offline, backend, konta i synchronizacja między urządzeniami — jej rolę pełni eksport i import pliku.

---

## 3. Dane i ich pochodzenie

Wszystko, co aplikacja wie o terenie, powstało z trzech źródeł: materiałów organizatora, OpenStreetMap i SRTM. Żadna wartość nie jest zmyślona — tam, gdzie musiałem coś przyjąć, jest to oznaczone.

| Plik | Zawartość | Skąd | Rozmiar |
|---|---|---|---|
| [`peaks.json`](src/data/peaks.json) | 20 szczytów: nazwa, wysokość, współrzędne | wysokości z checklisty organizatora, współrzędne z OSM (Overpass, `natural=peak`) | 3 KB |
| [`startPoints.ts`](src/data/startPoints.ts) | 8 punktów startowych ze współrzędnymi i wysokością | nazwy z PDF gminy, współrzędne z OSM, wysokości z SRTM | 2 KB |
| [`routes.ts`](src/data/routes.ts) | 4 warianty tras, przypisanie szczytów do dni, punkty startowe, flagi pętli | wariant 6-dniowy z PDF, pozostałe to propozycja własna | 7 KB |
| [`event.ts`](src/data/event.ts) | kontakt, FAQ, imprezy, konkursy, sponsor | strona i PDF-y organizatora | 5 KB |
| [`trails.json`](src/data/trails.json) | sieć dróg i ścieżek, 8 400 odcinków | OSM przez [`tools/build-trails.py`](tools/build-trails.py) | 633 KB (229 KB gzip) |
| [`elevation.json`](src/data/elevation.json) | siatka wysokości ~90 m | SRTM 30 m przez [`tools/build-elevation.py`](tools/build-elevation.py) | 109 KB (39 KB gzip) |

### 3.1 Szczyty

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

Wysokości pochodzą z checklisty organizatora i są wiążące — takie widnieją na tabliczkach, przy których robi się zdjęcie.

### 3.2 Punkty startowe

PDF gminy podaje starty słownie („parking przy kościele pw. Wszystkich Świętych w Górkach Wielkich"). Żeby dało się policzyć dojście i powrót, każdy trzeba było zamienić na współrzędne.

Zapytanie do Overpass o obiekty nazwane w tym rejonie — kościoły, urzędy, szkoły, stacje paliw, przystanki, ośrodki — dało dopasowanie dla wszystkich ośmiu. Wysokości pobrane punktowo z SRTM przez `api.opentopodata.org`.

| Punkt | lat, lon | m n.p.m. |
|---|---|---:|
| Górki Wielkie — parking przy kościele | 49.77351, 18.85550 | 338 |
| Brenna Centrum — parking przy Urzędzie Gminy | 49.72185, 18.91697 | 414 |
| Brenna Leśnica — ośrodek „Dolina Leśnicy” | 49.68528, 18.91179 | 485 |
| Brenna Leśnica — parking przy szkole | 49.69521, 18.90439 | 468 |
| Brenna Hołcyna — skręt w Dolinę Hołcyny | 49.71963, 18.92849 | 433 |
| Brenna Bukowa | 49.71804, 18.96436 | 496 |
| Brenna Skrzyżowanie | 49.75236, 18.87058 | 354 |
| Brenna — okolice stacji paliw | 49.72619, 18.90224 | 394 |

Zapytanie o `amenity=parking` w tym samym obszarze zwróciło 213 obiektów, ale tylko 7 z nazwą i żaden nie pokrywał się z listą organizatora — dlatego geokodowanie poszło przez punkty orientacyjne, nie przez same parkingi.

### 3.3 Warianty tras

Wariant 6-dniowy jest jedynym, który PDF opisuje tekstem. Reszta istnieje tam wyłącznie jako mapy-obrazki.

| Dzień | Start | Szczyty | Gmina |
|---|---|---|---|
| I | Dolina Hołcyny | Kotarz, Hyrca, Beskidek | 5:17 h / 16,7 km |
| II | Dolina Leśnicy | Stary Groń, Horzelica, Grabowa, Biały Krzyż, Jaworzyna, Gościejów, Trzy Kopce Wiślańskie | 5:40 h / 17,6 km |
| III | Górki Wielkie, kościół | Zebrzydka, Czupel, Mały Cisowy | 3:34 h / 10,1 km |
| IV | Leśnica, szkoła | Orłowa, Świniorka | 3:56 h / 12,2 km |
| V | Brenna Skrzyżowanie | Równica | 3:35 h / 10,7 km |
| VI | Brenna Centrum | Wielka Cisowa, Błatnia, Stołów, Trzy Kopce | 4:20 h / 12,1 km |

Razem 79,4 km i ok. 26 h marszu.

**Flagi pętli** wynikają wprost z opisów w PDF. Dni I, II, IV i V wracają na miejsce startu (dzień V wprost: „wracamy tą samą trasą"). Dni III i VI kończą się gdzie indziej — PDF mówi o powrocie autobusem albo spacerem wzdłuż Brennicy — więc mają `loop: false`.

**Warianty 1-, 2- i 4-dniowy** mają udokumentowane punkty startowe z PDF, ale podział szczytów na dni jest **moją propozycją**, geograficznie spójną. UI mówi to wprost w opisie każdego wariantu.

### 3.4 Rozbieżności wymagające potwierdzenia

1. **Beskidek (830 m).** Węzeł OSM o nazwie „Beskidek" ma `ele=700` i leży w innej części gminy. Przyjąłem nienazwany węzeł 831 m na grani Karkoszczonka–Hyrca, bo zgadza się z opisem trasy z PDF (Kotarz → Hyrca → Beskidek → przełęcz Karkoszczonka). Organizator ostrzega osobno: liczy się **Beskidek 830 m, a nie Beskid 860 m**, przez który nie przechodzi szlak. Do potwierdzenia w terenie.
2. **Zebrzydka.** OSM podaje 577 m, checklist 557 m. Aplikacja pokazuje 557 m.
3. **Czupel.** W rejonie są dwa; wybrany ten o wysokości 736 m, zgodnej z checklistą.

---

## 4. Jak powstają ślady tras

**Kluczowa rzecz: ślady nie są nigdzie zapisane.** W repozytorium nie ma ani jednej gotowej trasy. Aplikacja dostaje wyłącznie *listę przystanków* (parking + szczyty w kolejności) i **wylicza przebieg w przeglądarce** przy każdym pokazaniu dnia.

Dotyczy to tak samo wariantów gminy, jak i planów wygenerowanych czy ułożonych ręcznie — ta sama ścieżka kodu.

### Pipeline

```
  ETAP BUDOWANIA DANYCH (raz, ręcznie, skryptami w tools/)
  ─────────────────────────────────────────────────────────
  Overpass API                          opentopodata (SRTM 30 m)
  ├─ highway=path|track|footway|…       └─ siatka ~90 m nad bbox gminy
  └─ relation[route=hiking]  ────┐                    │
         (62 relacje PTTK)       │                    │
                                 ▼                    ▼
                       trails.json (633 KB)   elevation.json (109 KB)
                       delta-kodowana geometrię,   Int16 na siatce
                       flaga „oznakowany"


  ETAP URUCHOMIENIOWY (w przeglądarce, przy pierwszym liczeniu)
  ─────────────────────────────────────────────────────────────
  trails.json ──► budowa grafu ──► największa spójna składowa (98,5%)
                  76 tys. węzłów      (odrzucenie fragmentów bez połączenia)
                        │
  parking + szczyty ────┼──► snap: najbliższy węzeł sieci (wszystkie < 120 m)
                        │
                        ▼
              Dijkstra dla każdej pary kolejnych przystanków
              koszt = długość × (oznakowany ? 1 : 4)
                        │
                        ├──► geometria  ──► polilinia na mapie
                        ├──► długość    ──► dystans dnia
                        └──► profil SRTM ──► suma podejść ──► czas
```

### Szczegóły każdego kroku

**1. Sieć ścieżek** — [`tools/build-trails.py`](tools/build-trails.py) pobiera z Overpass wszystkie drogi i ścieżki w prostokącie `49.645–49.800 N, 18.830–19.010 E` (`path`, `footway`, `track`, `bridleway`, `steps`, plus drogi lokalne potrzebne do dojazdu od parkingów), a osobnym zapytaniem 62 relacje `route=hiking` — to z nich wiadomo, które odcinki są oznakowanymi szlakami PTTK. Wynik: 8 400 odcinków, 87 tys. punktów, z czego 833 odcinki należą do szlaków znakowanych.

Geometria zapisywana jest **delta-kodowaniem na siatce 1e-5 stopnia (~1 m)**: pierwszy punkt bezwzględnie, kolejne jako przyrosty. Format jednego odcinka to `[oznakowany, lat0, lon0, dlat, dlon, …]`. Surowa odpowiedź Overpass ma 7,5 MB; po tym kodowaniu 633 KB, a po gzipie **229 KB**.

**2. Siatka wysokości** — [`tools/build-elevation.py`](tools/build-elevation.py) próbkuje SRTM 30 m na regularnej siatce co ~90 m, w paczkach po 100 punktów (limit publicznego API to jedno zapytanie na sekundę). 27 648 punktów, ok. 5 minut, 109 KB.

**3. Graf** — [`trailRouter.ts`](src/lib/trailRouter.ts) buduje z `trails.json` listę sąsiedztwa w tablicach typowanych (`Int32Array`, `Float32Array`), leniwie, przy pierwszym liczeniu trasy. Potem zostawia **tylko największą spójną składową** (98,5% węzłów). Bez tego przyciągnięcie szczytu do odizolowanego fragmentu sieci kończyłoby się brakiem trasy i cichym powrotem do linii prostej — czyli błędem, którego nikt by nie zauważył.

**4. Snapowanie** — każdy parking i szczyt przyciągany jest do najbliższego węzła. Sprawdzone: wszystkie 20 szczytów i 8 parkingów trafiają w sieć w promieniu poniżej 120 m.

**5. Routing** — Dijkstra na kopcu binarnym, osobno dla każdej pary kolejnych przystanków. Koszt krawędzi to jej długość razy 1 dla szlaku znakowanego i razy **4** dla pozostałych. Router liczy równolegle dwie wartości: koszt (do wyboru trasy) i rzeczywistą długość (do pokazania użytkownikowi) — bo kara zniekształca koszt, ale nie może zniekształcić dystansu.

**6. Sklejenie dnia** — [`dayRoute.ts`](src/lib/dayRoute.ts) łączy odcinki w jedną polilinię, sumuje długości, liczy profil i czas. Gdy któregoś odcinka nie da się poprowadzić po sieci, ten jeden odcinek spada na linię prostą z dawnym mnożnikiem, a wynik niesie licznik `straightLegs` — UI pokazuje, ile odcinków tak potraktowano, zamiast udawać, że wszystko się udało.

**7. Cache i wątek** — [`useDayRoute.ts`](src/lib/useDayRoute.ts) trzyma wyniki w cache'u modułowym pod kluczem `(parking, pętla, kolejność szczytów)` i liczy poza ścieżką renderowania. Dla planu wielodniowego dni liczone są **po kolei, nie równolegle** — sześć Dijkstr naraz zablokowałoby wątek na dobrą sekundę. Do czasu policzenia mapa rysuje przebieg orientacyjny linią kropkowaną, a paski pokazują „liczę trasę…".

### Dlaczego kara ×4

Sam najkrótszy przejazd po sieci daje trasy **o 24% krótsze** niż propozycje gminy — Dijkstra tnie na skróty drogami leśnymi, a PTTK prowadzi grzbietami. Kara za odcinki nieoznakowane wypycha router na szlaki. Zmierzone na sześciu dniach gminy:

| Kara | Suma dystansu vs gmina |
|---|---|
| ×1 (najkrótsza droga) | −22% |
| ×2 | −13% |
| **×4** | **−5%** |
| ×8 | −5% (bez poprawy) |

Powyżej ×4 wynik przestaje się poprawiać, więc tam została ustawiona.

---

## 5. Model obliczeniowy i jego kalibracja

Aplikacja liczy trzy wielkości: **dystans**, **sumę podejść** i **czas**. Model przeszedł trzy wersje i warto opisać dlaczego, bo dwie pierwsze były błędne w sposób, który łatwo przeoczyć.

### Wersja 1 — linia prosta × 1,35

Pierwsze podejście: odległość w linii prostej razy współczynnik krętości, przewyższenie jako suma dodatnich różnic wysokości między kolejnymi szczytami, czas z reguły Naismitha.

Dwa błędy:

- dystans zaniżony o **18%** względem gminy,
- przewyższenie **absurdalnie niskie** — cała Korona w dwa dni wychodziła na 1 556 m. Powód: różnice wysokości między szczytami gubią wszystkie podejścia pośrednie. Na grani z Kotarza na Hyrcę schodzi się i podchodzi kilka razy, a model widział tylko `929 − 974 = −45 m`.

### Wersja 2 — dopasowane współczynniki

Zamiast zgadywać, dopasowałem oba parametry naraz do sześciu dni gminy — jedynych danych, gdzie znam prawdziwe dystanse i czasy. Wyszło: krętość **1,65** i dodatkowe **32 m podejścia na każdy kilometr**.

Suma dystansu zgadzała się wtedy w granicach 1%, ale błąd pojedynczego dnia sięgał ±30%. To wciąż był mnożnik maskujący brak wiedzy o przebiegu trasy.

### Wersja 3 — realny routing (obecna)

Dystans z geometrii trasy, przewyższenie z profilu SRTM próbkowanego **co 40 m** wzdłuż całej polilinii, z progiem 3 m odsiewającym szum siatki.

Zostaje pytanie o tempo. I tutaj wpadłem w pułapkę, którą warto zapisać:

> Sprawdzałem jakość przewyższeń, porównując je z „przewyższeniem wynikającym z czasu gminy" wyliczonym z reguły Naismitha. Wychodziło, że zaniżam o 36%. Zanim zacząłem to naprawiać, sprawdziłem samo założenie — i okazało się, że **to Naismith był zły, nie przewyższenia**. Gmina po prostu chodzi wolniej. Gdybym poszedł za pierwszym odczytem, „naprawiłbym" poprawne dane, żeby pasowały do złego wzoru na czas.

Po dopasowaniu tempa do sześciu dni gminy — przy ich dystansach i moich przewyższeniach z SRTM:

**4,45 km/h w poziomie · 455 m podejścia na godzinę**

| Dzień | czas gminy | model | błąd |
|---|---|---|---|
| I | 5:17 | 5:36 | +6% |
| II | 5:40 | 5:36 | −1% |
| III | 3:34 | 3:32 | −1% |
| IV | 3:56 | 3:56 | 0% |
| V | 3:35 | 3:37 | +1% |
| VI | 4:20 | 4:20 | 0% |

Dla porównania klasyczny Naismith (5 km/h, 600 m/h) mylił się na tych samych danych o **−10% do −17%**, konsekwentnie w jedną stronę.

Współczynniki z wersji 2 zostały w kodzie — służą wyłącznie jako zapasowa ścieżka dla odcinków, których nie dało się poprowadzić po sieci, oraz dla wstępnego szacunku pokazywanego zanim router policzy trasę.

### Czego model nie zrobi

Nie odgadnie redakcyjnych decyzji autora trasy. Gdy gmina świadomie prowadzi dłuższą drogą powrotną (dzień IV: „wracamy szlakiem przez Zakrzosek i Gronik") albo daje wybór między Klimczokiem a skrótem leśnym, najkrótsza sensowna trasa po szlakach będzie inna.

Dlatego **dla wariantów gminy UI pokazuje ich dystanse i czasy**, a wartości policzone służą planom własnym i generowanym.

---

## 6. Generator planów

Propozycje gminy dzielą szczyty tak, jak wygodnie było je opisać. Generator wychodzi od innego założenia: prawie każdy zostawia samochód na parkingu i musi po niego wrócić, więc **dzień jest pętlą**.

Suwak 1–8 dni, [`planGenerator.ts`](src/lib/planGenerator.ts):

1. **Grupowanie** — k-means po współrzędnych, deterministyczny: centroidy startowe rozłożone po długości geograficznej, więc ten sam wybór zawsze daje ten sam plan.
2. **Dobór parkingu** — dla każdej grupy ten z ośmiu punktów startowych, z którego cała grupa jest średnio najbliżej.
3. **Kolejność** — najbliższy sąsiad od parkingu, potem **2-opt** na zamkniętej pętli (odwracanie fragmentów trasy, dopóki skraca całość).
4. **Wyrównanie** — przenoszenie pojedynczych szczytów z najcięższego dnia do najlżejszego, dopóki skraca to najdłuższy dzień. Do 12 rund.
5. **Sortowanie dni** z północy na południe, żeby numeracja była przewidywalna.

Podgląd przed wczytaniem pokazuje sumę dystansu, podejść, najdłuższy dzień i skład każdego etapu.

Przykładowe wyniki (przed policzeniem po szlakach — sam generator pracuje na liniach prostych, bo N² Dijkstr przy każdym ruchu suwaka byłoby zbyt kosztowne):

| Dni | Dystans | Podejścia | Najdłuższy dzień |
|---|---|---|---|
| 1 | ~72 km | ~3 500 m | ~20:13 h |
| 3 | ~93 km | ~4 839 m | ~9:30 h |
| 6 | ~94 km | ~5 840 m | ~6:38 h |
| 8 | ~115 km | ~7 387 m | ~4:55 h |

Więcej dni oznacza więcej kilometrów i więcej podejść — bo każdy dzień powtarza dojście od parkingu. To poprawne zachowanie, nie błąd.

Po wczytaniu planu dni są przeliczane po realnych szlakach i liczby się zmieniają.

---

## 7. Architektura

```
korona-gor-brennej/
├── index.html
├── vite.config.ts                 # base: './' — działa z podkatalogu
├── tools/
│   ├── build-trails.py            # sieć ścieżek z OSM → trails.json
│   └── build-elevation.py         # siatka SRTM → elevation.json
└── src/
    ├── App.tsx                    # 6 zakładek, wspólny stan wybranego dnia
    ├── types.ts
    ├── index.css                  # tokeny motywu, warstwa komponentów
    ├── data/
    │   ├── peaks.json  peaks.ts   # 20 szczytów
    │   ├── startPoints.ts         # 8 parkingów ze współrzędnymi i wysokością
    │   ├── routes.ts              # 4 warianty gminy
    │   ├── event.ts               # kontakt, FAQ, imprezy, sponsor
    │   ├── trails.json            # sieć ścieżek (osobny chunk)
    │   └── elevation.json         # siatka wysokości (osobny chunk)
    ├── lib/
    │   ├── geo.ts                 # haversine, azymut, tempo, szacunek zapasowy
    │   ├── trailRouter.ts         # graf + Dijkstra z preferencją szlaków
    │   ├── elevation.ts           # próbkowanie siatki, profil trasy
    │   ├── dayRoute.ts            # sklejenie dnia: dystans, podejścia, czas
    │   ├── useDayRoute.ts         # cache i liczenie poza renderem
    │   ├── planGenerator.ts       # k-means + 2-opt + wyrównanie dni
    │   ├── photo.ts               # kompresja canvas→WebP, EXIF
    │   ├── gpx.ts                 # zapis GPX 1.1
    │   └── download.ts
    ├── store/
    │   ├── progress.ts            # zustand + persist → localStorage
    │   └── media.ts               # idb → IndexedDB (zdjęcia)
    ├── features/
    │   ├── checklist/             # Checklist, PeakCard, PeakSheet
    │   ├── map/                   # MapView + DayTrack + DaySummary
    │   ├── planner/               # Planner, ElevationProfile
    │   ├── export/                # ExportView, collage, backup
    │   ├── field/                 # FieldView, useGeolocation
    │   └── info/                  # InfoView
    └── ui/                        # Icons, Sheet, ProgressRing
```

### Model danych

```ts
type PeakStatus = 'todo' | 'planned' | 'done'
type AscentMode = 'foot' | 'bike'

interface Peak {              // statyczne, z peaks.json
  id: string; no: number; name: string
  ele: number; lat: number; lon: number
  note?: string; verify?: string    // verify = rozbieżność do potwierdzenia
}

interface PeakProgress {      // localStorage
  status: PeakStatus
  conqueredAt?: string        // ISO
  ascentMode?: AscentMode
  photoIds: string[]          // klucze w IndexedDB
  primaryPhotoId?: string     // to zdjęcie idzie do kolażu
  note?: string
}

interface DayPlan {
  id: string; name: string; date?: string
  startPoint?: string         // wolny tekst, zgodność wstecz
  startPointId?: string       // referencja do startPoints.ts
  loop?: boolean              // powrót na start; domyślnie true
  peakIds: string[]
  officialDistanceKm?: number // z PDF gminy — ma pierwszeństwo przed szacunkiem
  officialTime?: string
}

interface StoredPhoto {       // IndexedDB
  id: string; peakId: string
  blob: Blob                  // WebP po kompresji
  takenAt?: string            // z EXIF
  gps?: { lat: number; lon: number }
  addedAt: string
}
```

### Podział pamięci

| Co | Gdzie | Dlaczego |
|---|---|---|
| postęp, plan, ustawienia | **localStorage** (`zustand/persist`) | kilkanaście kB, synchroniczny odczyt przy starcie |
| zdjęcia | **IndexedDB** (`idb`) | localStorage ma limit ~5 MB i trzyma tylko stringi; 20 zdjęć × ~300 KB ≈ 6 MB |
| trasy | **cache w pamięci** | wynik deterministyczny, przeliczalny w każdej chwili |

Wpychanie zdjęć do localStorage, choćby jako base64, to najczęstszy błąd w takich projektach — kończy się cichym `QuotaExceededError`. Zdjęcia idą do IndexedDB jako `Blob`, bez konwersji.

### Podział na chunki

| Chunk | Rozmiar | gzip | Kiedy się ładuje |
|---|---|---|---|
| `index` | 295 KB | **99 KB** | start |
| `index.css` | 51 KB | 14 KB | start |
| `map` (Leaflet) | 299 KB | 91 KB | zakładka Mapa |
| `trails` | 648 KB | 229 KB | pierwsze liczenie trasy |
| `elevation` | 112 KB | 39 KB | pierwsze liczenie trasy |
| `jspdf` + `html2canvas` + `purify` | 742 KB | 173 KB | dopiero przy eksporcie PDF |

jsPDF ciągnął 380 KB zależności do bundla startowego, dopóki nie trafił na dynamiczny import. Dane routingu tak samo — statyczny import wpychał je do `index` i podnosił start do 341 KB gzip.

Service Worker precache'uje 16 plików, łącznie **2,1 MB** — czyli po pierwszym uruchomieniu routing i cała aplikacja działają offline. Kafelki OSM mają osobną regułę `CacheFirst` z ważnością 30 dni.

---

## 8. Warstwa wizualna

Mobile-first, bo aplikacja jest używana w terenie, na telefonie, często w rękawiczkach: cele dotykowe minimum 44 px wymuszone globalnie w CSS, dolna nawigacja, kluczowe akcje w zasięgu kciuka, pola formularzy z `font-size: 16px`, żeby iOS nie zoomował przy focusie.

**Kolorystyka przejęta z materiałów organizatora** — plakatu 2026 i strony koronagorbrennej.pl:

| Rola | Kolor |
|---|---|
| kolor wiodący | ciemna zieleń `#226b31` |
| zaliczone, akcent | zieleń liścia `#72bb43` |
| wyróżnienie | złoto `#ffd84d` |
| tło | krem `#f3f9ef` |
| ostrzeżenia | pomarańcz `#e26c3b` |

Pierwsza wersja miała motyw granatowo-fioletowy, „nocny", bo motywem edycji są nietoperze. To było nieporozumienie: organizator ten sam motyw pokazuje jako **czarne sylwetki na zieleni**, w jasnej kolorystyce. Aplikacja nie tyle interpretowała markę, co się z nią rozjeżdżała.

**Motyw jasny jest domyślny**, bo aplikacja działa we wrześniu, w dzień, w terenie — ciemne tło wypłowiałoby w słońcu. Wersja ciemna włącza się automatycznie przy systemowym trybie nocnym.

**Kolory żyją w tokenach semantycznych** (`--s-bg`, `--s-surface`, `--s-brand`, `--s-done`, `--s-warn`…) zdefiniowanych w [`index.css`](src/index.css) i wystawionych Tailwindowi przez `@theme`. Komponenty używają nazw znaczeniowych (`bg-surface`, `text-brand`, `border-line`), nie konkretnych barw — zmiana motywu to edycja jednego pliku. Przejście z motywu granatowego na markowy sprowadziło się do mechanicznej podmiany ~250 klas i przedefiniowania tokenów.

Uwaga o Tailwindzie v4: `@apply` nie działa na klasach z `@layer components`, więc bazowy przycisk musiał trafić do `@utility btn`, a warianty (`btn-primary`, `btn-ghost`) dopiero go składają.

**Kolaż i karta podsumowania zostają jasne niezależnie od motywu.** Trafiają na Facebooka, gdzie kremowo-zielona wersja odpowiada plakatowi — byłoby dziwne, gdyby dowód wyglądał inaczej u kogoś z trybem nocnym.

---

## 9. Prywatność — jak jest zrobiona technicznie

Deklaracja „zero śledzenia" musi mieć pokrycie w kodzie, nie tylko w opisie:

- **brak kont, logowania, analityki, ciasteczek i skryptów zewnętrznych** — aplikacja nie ma backendu, do którego mogłaby cokolwiek wysłać,
- postęp, zdjęcia i notatki żyją wyłącznie w `localStorage` i IndexedDB przeglądarki użytkownika,
- **film z YouTube ładuje się dopiero po kliknięciu.** Zwykły embed odpytuje Google przy samym otwarciu strony; tutaj podgląd to własna grafika SVG, a po kliknięciu ładowany jest `youtube-nocookie.com`. Zweryfikowane w headless: na zakładce Info **nie ma żadnego zasobu z obcej domeny** przed kliknięciem,
- **logo sponsora leży lokalnie** w `public/`, nie jest wczytywane z `facelove.pl` — inaczej każde otwarcie aplikacji byłoby zapytaniem do serwera firmy. Przy okazji zmniejszone z 1400 px / 56 KB do 600 px / 11 KB i działa offline,
- jedyne zapytania sieciowe w normalnej pracy to **kafelki map** (OpenStreetMap, OpenTopoMap, Waymarked Trails).

Konsekwencja, o której UI mówi wprost: **wyczyszczenie danych przeglądarki kasuje postęp**. Stąd przypomnienia o backupie i eksport całego stanu do pliku.

---

## 10. Narzędzia budujące dane

Oba skrypty uruchamia się **ręcznie**, tylko gdy trzeba odświeżyć dane z OSM. Nie są częścią builda — wynik jest wersjonowany w repo.

```bash
python3 tools/build-trails.py      # ~15 s, → src/data/trails.json
python3 tools/build-elevation.py   # ~5 min, → src/data/elevation.json
```

Pułapki, na które warto uważać przy modyfikacji:

- **Overpass odrzuca zapytania bez nagłówka `User-Agent`** — zwraca HTTP 406 bez treści błędu.
- Przynależność do szlaku PTTK jest tagiem **relacji**, nie odcinka. Zapytanie o `marked_trail:*` na samych odcinkach znajduje ich 47; przez relacje `route=hiking` — 833.
- `api.opentopodata.org` przyjmuje 100 punktów na zapytanie i jedno zapytanie na sekundę. Skrypt ma pauzę 1,1 s i pięć prób ponowienia.
- Zmiana `STEP_M` w skrypcie wysokości zmienia rozdzielczość i czas pobierania kwadratowo: 180 m to 6 912 punktów i minuta, 90 m to 27 648 punktów i pięć minut.

---

## 11. Uruchomienie i wdrożenie

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
npm run preview  # podgląd builda
```

Wdrożenie: zawartość `dist/` na dowolny hosting statyczny. Dzięki `base: './'` działa również z podkatalogu, np. `example.com/korona/`.

**Wymagany HTTPS** — geolokalizacja, aparat i Service Worker nie działają po HTTP poza `localhost`.

### GitHub Pages

W repo jest [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): przy każdym pushu na `main` buduje projekt i publikuje `dist/`. Wymaga jednorazowego włączenia w **Settings → Pages → Source: `GitHub Actions`**.

Dla repozytorium prywatnego Pages wymaga płatnego planu.

### Ograniczenie miejsca na dysku

Repozytorium leży na zaszyfrowanym wolumenie `/mnt/l` (2 GB, wolne ~40 MB); ścieżka `~/CODE/priv-brenna-korona` to dowiązanie do tego samego katalogu, nie druga kopia. `node_modules` tego stacku waży ~400 MB i **tam się nie zmieści**. Symlink nie wystarcza — npm go usuwa i tworzy katalog w miejscu docelowym.

Obejście użyte przy budowaniu tego projektu — workspace poza wolumenem, z dowiązaniami do źródeł w repo, dzięki czemu edycja plików w repo działa na żywo:

```bash
WS=~/.kgb-workspace
mkdir -p "$WS" && cd "$WS"
for f in src public index.html package.json vite.config.ts \
         tsconfig.json tsconfig.app.json tsconfig.node.json; do
  ln -sf /mnt/l/CODE/priv-brenna-korona/$f .
done
# Vite rozwiązuje symlinki do ścieżek w repo, gdzie nie ma node_modules:
sed 's|^export default defineConfig({|&\n  resolve: { preserveSymlinks: true },|' \
  /mnt/l/CODE/priv-brenna-korona/vite.config.ts > vite.config.ts
npm install && npm run build
cp -r dist /mnt/l/CODE/priv-brenna-korona/dist
```

W CI ten problem nie występuje — GitHub Actions buduje z czystego checkoutu zwykłym `npm ci`.

---

## 12. Metodyka testów

Projekt nie ma testów jednostkowych. Weryfikacja szła przez **sterowanie zbudowaną aplikacją w headless Chrome**: strona-sonda ładuje `dist/index.html` w iframe, klika w interfejs jak użytkownik i wypisuje odczyty do `<pre>`, które trafia do `--dump-dom`.

To testuje realny build, a nie kod źródłowy — łapie błędy konfiguracji, bundlowania i Service Workera, których test jednostkowy by nie zobaczył.

Sprawdzone tą drogą:

| Co | Wynik |
|---|---|
| `peaks.json`: 20 wpisów, unikalne `id`, wysokości 557…1082 rosnąco, komplet współrzędnych | ✅ |
| Tabela szczytów w README zgodna z `peaks.json` co do nazw, wysokości i współrzędnych | ✅ |
| Wariant 6-dniowy: 20 szczytów, bez powtórzeń i braków | ✅ |
| Odhaczenie szczytu → zapis w `localStorage` wraz z datą | ✅ |
| Wczytanie wariantu nie kasuje już zaliczonych szczytów | ✅ |
| Wszystkie 6 zakładek montuje właściwą treść | ✅ |
| Panel szczytu otwiera się i zamyka | ✅ |
| Mapa: 20 markerów, marker startu, linie tras, filtr dni, dopasowanie widoku | ✅ |
| Trasy policzone po szlakach dla wszystkich 6 dni wariantu gminy | ✅ |
| Generator: pełne pokrycie 20 szczytów bez powtórzeń dla 1, 2, 3, 4, 6 i 8 dni | ✅ |
| Zakładka Info: zero zasobów z obcych domen przed kliknięciem w film | ✅ |
| Brak poziomego przewijania przy 360 i 390 px | ✅ |
| Sześć zakładek mieści się na 360 px bez ucinania tekstu | ✅ |
| `tsc -b` bez błędów, `vite build` przechodzi | ✅ |

### Ograniczenia tej metody

- **`requestAnimationFrame` w tym headless w ogóle nie tyka** (0 klatek na 2 s). Animacji Framer Motion nie da się w nim zweryfikować, a zrzuty ekranu wymagają wymuszenia stanu końcowego przez wstrzyknięcie `opacity: 1 !important`. Raz doprowadziło mnie to do fałszywego wniosku, że `AnimatePresence` blokuje nawigację — to był artefakt środowiska, nie błąd aplikacji.
- **Headless zawsze raportuje `prefers-color-scheme: dark`** i ignoruje flagę wymuszającą schemat. Motyw jasny testowany był na wariancie builda z wyciętym blokiem `@media (prefers-color-scheme: dark)` — przechodzi przez prawdziwą kaskadę CSS, ale nie przez samo przełączenie schematu.
- **Geolokalizacja nie ma pokrycia w testach** — headless nie nadaje uprawnień. Cała zakładka Teren jest zweryfikowana wyłącznie przez lekturę kodu.

### Do sprawdzenia ręcznie na urządzeniu

Aparat, EXIF i geolokalizacja na telefonie · instalacja PWA i praca w trybie samolotowym · 20 zdjęć bez `QuotaExceededError` · backup: eksport → tryb prywatny → import → stan identyczny · Lighthouse na mobile.

---

## 13. Znane ograniczenia i dług techniczny

Uczciwa lista tego, co jest niedokończone albo obiecuje więcej, niż robi.

### Zapis śladu GPS — najsłabsze miejsce

Sam zapis GPX w [`gpx.ts`](src/lib/gpx.ts) jest poprawny: GPX 1.1, 20 szczytów jako `<wpt>` z wysokością i `<sym>Summit</sym>`, ślad jako `<trk>` z `<ele>` i `<time>`, escapowanie XML. Taki plik wczyta Strava czy Garmin. Ale wokół niego:

1. **Ślad żyje wyłącznie w pamięci RAM.** W [`media.ts`](src/store/media.ts) są gotowe `putTrack`, `getAllTracks`, `deleteTrack` — i **żadna nie jest wywoływana**. Odświeżenie strony albo ubicie aplikacji przez system kasuje cały ślad.
2. **Nagrywanie działa tylko przy aktywnym ekranie.** Przeglądarka wstrzymuje `watchPosition` w tle. Opis „zapis śladu z wycieczki" obiecuje więcej, niż aplikacja robi.
3. **Ślady nie wchodzą do backupu.**
4. **Brak filtrowania skoków GPS** — jeden zły fix pod lasem zrobi kilometrowy zygzak i zawyży dystans.
5. `takeTrack` w [`useGeolocation.ts`](src/features/field/useGeolocation.ts) to martwy kod.

### Pozostałe

- **Profil wysokości w planerze rysuje wierzchołki, nie trasę.** [`ElevationProfile`](src/features/planner/ElevationProfile.tsx) rozkłada wysokości szczytów wzdłuż szacowanego dystansu. Od czasu wprowadzenia routingu prawdziwy profil SRTM jest już dostępny w `dayRoute` — komponent go po prostu jeszcze nie używa. Komentarz w pliku jest w tym miejscu nieaktualny.
- **Podział szczytów w wariantach 1-, 2- i 4-dniowym jest mój**, nie gminy. Oznaczone w UI, ale warto by odczytać go z map w PDF.
- **Beskidek i Zebrzydka** — rozbieżności opisane w [3.4](#34-rozbieżności-wymagające-potwierdzenia), do potwierdzenia w terenie.
- **Dzień VI wariantu gminy** różni się od trasy policzonej po szlakach o ~30%, bo gmina daje tam wybór drogi. To ograniczenie z założenia, nie usterka.
- **Aplikacja nie była uruchomiona na realnym telefonie.** Wszystko powyżej pochodzi z headless Chrome i lektury kodu.
- **Brak testów jednostkowych.** Logika obliczeniowa (`geo`, `trailRouter`, `elevation`, `planGenerator`) jest czysta i dobrze się do nich nadaje.
- **E8 z pierwotnego planu** — Lighthouse i test na urządzeniu — czeka na wdrożenie po HTTPS.

---

## Zastrzeżenia

Projekt nieoficjalny. Jedyną wiążącą procedurą zaliczenia jest ta opisana przez organizatora na [koronagorbrennej.pl](https://www.koronagorbrennej.pl/) — aplikacja niczego nie zgłasza za Ciebie i nie zastępuje weryfikacji.

Dane szczytów i sieci ścieżek pochodzą z materiałów organizatora oraz OpenStreetMap (© kontrybutorzy OpenStreetMap, [ODbL](https://www.openstreetmap.org/copyright)). Wysokości: SRTM przez [opentopodata.org](https://www.opentopodata.org/). Szlaki na mapie: [waymarkedtrails.org](https://hiking.waymarkedtrails.org) (CC-BY-SA).

**W górach kieruj się oznakowaniem szlaków PTTK, nie aplikacją.** Trasy liczone przez router są propozycją opartą na danych OSM, a nie gwarancją przejezdności.
