# Korona Gór Brennej — dokumentacja projektowa

Statyczna aplikacja webowa dla uczestników wyzwania **Korona Gór Brennej 2026**: checklista 20 szczytów, zdjęcia z walidacją EXIF, planer tras liczonych po realnych szlakach, mapa i generator kompletu zdjęć do weryfikacji u organizatora.

Bez backendu, bez kont, bez śledzenia. Wszystkie dane użytkownika zostają w jego przeglądarce. Build to zwykłe pliki statyczne.

**Projekt nieoficjalny i fanowski** — nie jest powiązany z organizatorem ani z Gminą Brenna.

| | |
|---|---|
| Stack | Vite · React · TypeScript · Tailwind v4 · Leaflet · zustand · idb · exifr · Framer Motion |
| Kod | 36 plików źródłowych, ~5 600 linii |
| Bundle startowy | 104 KB gzip |
| Pełny payload offline | 2,1 MB (17 plików w precache) + zdjęcia szczytów zapisywane przy obejrzeniu |
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

Źródła: [koronagorbrennej.pl](https://www.koronagorbrennej.pl/) · [checklist 2026 (PDF)](https://www.koronagorbrennej.pl/assets/checklist-2026.pdf) · [propozycje tras, OPKiS Brenna (PDF)](https://turysta.brenna.org.pl/uploads/gallery/kg-2026.pdf)

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

Panel pokazuje też **informacje o samej górze**: pasek zdjęć z Wikimedia Commons (dotknięcie otwiera pełny podgląd z podpisem, autorem i licencją), krótki opis zredagowany na podstawie Wikipedii (pasmo, co jest na szczycie, szlaki, historia, ciekawostki) oraz linki do Wikipedii i Mapy.com. Skąd są te treści, opisuje [3.5](#35-opisy-i-zdjęcia-szczytów).

### Mapa

Leaflet + OpenStreetMap albo OpenTopoMap, z nakładką szlaków z Waymarked Trails (przyciemnioną do 0,55, żeby nie konkurowała z trasą).

Nad mapą **pasek dni pełniący jednocześnie rolę legendy i filtru**:

- *Wszystkie* — każdy dzień innym kolorem, widok dopasowany do całego planu,
- wybrany dzień — tylko jego trasa, szczyty ponumerowane w kolejności przejścia, pozostałe przygaszone do małych kropek,
- marker `P` w miejscu startu, trasa domknięta do niego przy trybie pętli,
- pasek pod mapą: liczba szczytów, dystans, czas, suma podejść.

Kontrolka warstw siedzi w prawym górnym rogu, pod paskiem dni — dół mapy zajmuje panel trasy.

#### Trasa na dziś

Przycisk **Na dziś** na pasku nad mapą przełącza mapę w tryb układania trasy na bieżący dzień, bez zakładania planu:

- **dotknięcie szczytu** dodaje go do trasy albo z niej usuwa — bez dymka, jeden wybór to jedno dotknięcie,
- po każdym wyborze aplikacja **sama układa kolejność** i liczy przebieg po szlakach. Użytkownik wybiera zbiór szczytów, nie kolejność. Kolejność układa ta sama funkcja co w generatorze planów (najbliższy sąsiad + 2-opt, [sekcja 6](#6-generator-planów)),
- **parking** domyślnie dobierany jest automatycznie: z ośmiu punktów gminy wygrywa ten, z którego wybrane szczyty najszybciej się przejdzie. Liczone z pełnym ułożeniem kolejności, więc z uwzględnieniem powrotu. Można też dotknąć dowolnego `P` na mapie, wybrać parking z listy, **wskazać własne miejsce** dotknięciem mapy (marker da się potem przeciągnąć, wysokość pochodzi z siatki SRTM) albo zrezygnować z parkingu,
- **Powrót / Bez powrotu** — z powrotem optymalizowana jest zamknięta pętla, bez powrotu droga od parkingu do ostatniego szczytu,
- **⇄** odwraca kierunek przejścia. Działa dla pętli i dla trasy bez parkingu; dla trasy bez powrotu jest zablokowany, bo zmieniłby miejsce startu. Dystans się nie zmienia, ale czas i podejścia tak: Kotarz–Hyrca–Beskidek bez parkingu to 1:09 h i ↑ 202 m w jedną stronę, a 0:51 h i ↑ 70 m w drugą,
- panel pod mapą: dystans, czas, podejścia i kolejność przejścia. Dotknięcie nazwy otwiera panel szczytu, × usuwa szczyt z trasy.

Wybór zapisuje się w `localStorage` i nie zmienia statusów szczytów ani planu dni. Wyczyszczenie listy zostawia parking i ustawienie powrotu, bo to raczej stały zwyczaj niż wybór na jeden dzień.

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
| [`peaks.json`](src/data/peaks.json) | 20 szczytów: nazwa, wysokość, współrzędne, link do Mapy.com | wysokości z checklisty organizatora, współrzędne z OSM (Overpass, `natural=peak`), zweryfikowane z Mapy.com | 6 KB |
| [`peakInfo.json`](src/data/peakInfo.json) | opisy szczytów, wybór zdjęć z podpisami, autorzy i licencje | opisy zredagowane na podstawie polskiej Wikipedii, zdjęcia z Wikimedia Commons | 38 KB |
| [`public/peaks/`](public/peaks) | 39 zdjęć szczytów + miniatury, WebP | Wikimedia Commons przez [`tools/build-peak-photos.py`](tools/build-peak-photos.py) | 4,8 MB |
| [`startPoints.ts`](src/data/startPoints.ts) | 8 punktów startowych ze współrzędnymi i wysokością | nazwy z PDF gminy, współrzędne z OSM, wysokości z SRTM | 2 KB |
| [`routes.ts`](src/data/routes.ts) | 4 warianty tras, przypisanie szczytów do dni, punkty startowe, flagi pętli | wariant 6-dniowy z PDF, pozostałe to propozycja własna | 7 KB |
| [`event.ts`](src/data/event.ts) | kontakt, FAQ, imprezy, konkursy, sponsor | strona i PDF-y organizatora | 5 KB |
| [`trails.json`](src/data/trails.json) | sieć dróg i ścieżek, 8 400 odcinków | OSM przez [`tools/build-trails.py`](tools/build-trails.py) | 633 KB (229 KB gzip) |
| [`elevation.json`](src/data/elevation.json) | siatka wysokości ~90 m | SRTM 30 m przez [`tools/build-elevation.py`](tools/build-elevation.py) | 109 KB (39 KB gzip) |

### 3.1 Szczyty

| # | Szczyt | m n.p.m. | lat | lon | Mapy.com |
|---|---|---:|---|---|---|
| 1 | Zebrzydka | 557 | 49.77055 | 18.88253 | [mapa](https://mapy.com/pl/turisticka?source=osm&id=1048265841&ds=1&x=18.8825289&y=49.7705507&z=17) |
| 2 | Świniorka | 700 | 49.68498 | 18.90001 | [mapa](https://mapy.com/pl/turisticka?q=%C5%9Bwiniorka&source=osm&id=1069138014&ds=2&x=18.9000142&y=49.6849811&z=17) |
| 3 | Czupel | 736 | 49.75607 | 18.90118 | [mapa](https://mapy.com/pl/turisticka?q=Czupel&source=osm&id=1047951914&ds=1&x=18.9011836&y=49.7560719&z=17) |
| 4 | Stary Groń | 792 | 49.69353 | 18.92349 | [mapa](https://mapy.com/pl/turisticka?q=Stary%20Gro%C5%84%20(792%C2%A0m)&source=osm&id=1047944035&ds=1&x=18.9234889&y=49.6935322&z=17) |
| 5 | Horzelica | 797 | 49.70086 | 18.91576 | [mapa](https://mapy.com/pl/turisticka?q=Horzelica%20(797%C2%A0m)&source=osm&id=1047944036&ds=1&x=18.9157534&y=49.7008605&z=17) |
| 6 | Jaworzyna | 802 | 49.65770 | 18.94223 | [mapa](https://mapy.com/pl/turisticka?q=Jaworzyna&source=osm&id=1047942529&ds=1&x=18.9422321&y=49.6577005&z=17) |
| 7 | Trzy Kopce Wiślańskie | 810 | 49.66429 | 18.90730 | [mapa](https://mapy.com/pl/turisticka?q=Trzy%20Kopce%20Wi%C5%9Bla%C5%84skie%20(810%C2%A0m)&source=osm&id=149224400&ds=1&x=18.9072990&y=49.6642842&z=17) |
| 8 | Orłowa | 813 | 49.69698 | 18.87847 | [mapa](https://mapy.com/pl/turisticka?q=Or%C5%82owa&source=osm&id=6392518&ds=2&x=18.8784707&y=49.6969813&z=17) |
| 9 | Gościejów | 818 | 49.65858 | 18.92162 | [mapa](https://mapy.com/pl/turisticka?q=Go%C5%9Bciej%C3%B3w&source=osm&id=1084551714&ds=2&x=18.9216220&y=49.6585825&z=17) |
| 10 | Mały Cisowy | 829 | 49.74966 | 18.91480 | [mapa](https://mapy.com/pl/turisticka?q=Ma%C5%82y%20Cisowy&source=osm&id=1047951915&ds=2&x=18.9147985&y=49.7496600&z=17) |
| 11 | Beskidek | 830 | 49.70870 | 18.99054 | [mapa](https://mapy.com/pl/turisticka?q=Beskidek&source=osm&id=1051306155&ds=1&x=18.9905441&y=49.7087011&z=17) |
| 12 | Wielka Cisowa | 878 | 49.74511 | 18.93170 | [mapa](https://mapy.com/pl/turisticka?q=Wielka%20Cisowa%20(878%C2%A0m)&source=osm&id=1047951920&ds=1&x=18.9316964&y=49.7451054&z=17) |
| 13 | Równica | 884 | 49.72470 | 18.85656 | [mapa](https://mapy.com/pl/turisticka?q=R%C3%B3wnica&source=osm&id=1048167481&ds=1&x=18.8565516&y=49.7246977&z=17) |
| 14 | Grabowa | 907 | 49.67780 | 18.95456 | [mapa](https://mapy.com/pl/turisticka?q=Grabowa%20(907%C2%A0m)&source=osm&id=6375953&ds=1&x=18.9545596&y=49.6777961&z=17) |
| 15 | Błatnia | 917 | 49.74835 | 18.94533 | [mapa](https://mapy.com/pl/turisticka?q=B%C5%82atnia%20(917%C2%A0m)&source=osm&id=6315089&ds=1&x=18.9453328&y=49.7483498&z=17) |
| 16 | Hyrca | 929 | 49.70080 | 18.98066 | [mapa](https://mapy.com/pl/turisticka?q=Hyrca&source=osm&id=1051306174&ds=2&x=18.9806628&y=49.7007980&z=17) |
| 17 | Biały Krzyż | 940 | 49.67013 | 18.95904 | [mapa](https://mapy.com/pl/turisticka?q=Bia%C5%82y%20Krzy%C5%BC%20(940%C2%A0m)&source=osm&id=1048126439&ds=1&x=18.9590442&y=49.6701310&z=17) |
| 18 | Kotarz | 974 | 49.68908 | 18.96364 | [mapa](https://mapy.com/pl/turisticka?q=Kotarz%20(974%C2%A0m)&source=osm&id=149224136&ds=1&x=18.9636362&y=49.6890763&z=17) |
| 19 | Stołów | 1035 | 49.74516 | 18.96529 | [mapa](https://mapy.com/pl/turisticka?q=Sto%C5%82%C3%B3w%20(1035%C2%A0m)&source=osm&id=1056394345&ds=1&x=18.9652944&y=49.7451617&z=17) |
| 20 | Trzy Kopce | 1082 | 49.73662 | 18.98631 | [mapa](https://mapy.com/pl/turisticka?q=Trzy%20Kopce%20(1082%C2%A0m)&source=osm&id=6419453&ds=1&x=18.9863062&y=49.7366188&z=17) |

Wysokości pochodzą z checklisty organizatora i są wiążące — takie widnieją na tabliczkach, przy których robi się zdjęcie.

**Weryfikacja położenia (2026-09-13).** Każdy punkt porównany z obiektem szczytu w Mapy.com (warstwa turystyczna, dane OSM) — linki w ostatniej kolumnie, zapisane też w `peaks.json` jako pole `mapy`. Największa różnica to 0,7 m (Równica), czyli samo zaokrąglenie do pięciu miejsc po przecinku. Niezależnie od tego każdy punkt sprawdzony na siatce SRTM z `elevation.json`: wszystkie leżą na lokalnym maksimum albo najwyżej 300 m od niego, z różnicą do 5 m — w granicach dokładności siatki 90 m. Współrzędne z artykułów Wikipedii różnią się od OSM o 1–150 m, z dwoma wyjątkami opisanymi w [3.4](#34-rozbieżności-wymagające-potwierdzenia).

**Beskidek** leży na grzbiecie Karkoszczonka–Hyrca (granica Szczyrku i Brennej), tam gdzie węzeł OSM `natural=peak` o `ele=830` — zgodnie z checklistą. Przez szczyt biegnie czerwony szlak z Przełęczy Salmopolskiej; niżej, po szczyrkowskiej stronie, jest Beskid Sport Arena ze stokiem slalomowym „Beskidek”. Organizator ostrzega osobno: liczy się **Beskidek 830 m, a nie Beskid 860 m**, przez który nie przechodzi szlak.

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

1. **Zebrzydka.** OSM podaje 577 m, Wikipedia 578 m, checklist 557 m. Aplikacja pokazuje 557 m.
2. **Czupel.** W rejonie są dwa; wybrany ten o wysokości 736 m, zgodnej z checklistą.
3. **Gościejów.** Ma dwa wierzchołki: południowy 818 m i północno-zachodni 811,5 m. Punkt z OSM i Mapy.com leży ok. 450 m na południowy wschód od współrzędnych z Wikipedii, czyli — zgodnie z opisem — na wyższym wierzchołku, tym z checklisty.
4. **Beskidek.** Wikipedia ma tylko artykuł „Beskidek (860 m)”, którego współrzędne leżą ok. 775 m na północny wschód od punktu 830 m z checklisty. To właśnie ten wierzchołek, przed którym ostrzega organizator. Opis w aplikacji ogranicza się do faktów o grzbiecie, a link do artykułu ma dopisek, że dotyczy sąsiedniego szczytu.
5. **Stary Groń i Horzelica.** Geoportal ma ich nazwy zamienione. Aplikacja trzyma się OSM, Mapy.com i Wikipedii: Stary Groń 792 m od południa, Horzelica 797 m od północy.
6. **Wielka Cisowa.** Tabliczka na niedatowanym zdjęciu z Commons pokazuje 872 m, checklist podaje 878 m.
7. **Jaworzyna.** Na mapach i w przewodnikach zwykle Jawierzny; Geoportal podaje 802 m, mapa Compassu 799 m. Nazwa urzędowa (PRNG) i checklist: Jaworzyna, 802 m.

### 3.5 Opisy i zdjęcia szczytów

**Opisy** w [`peakInfo.json`](src/data/peakInfo.json) są zredagowane ręcznie na podstawie artykułów polskiej Wikipedii (stan na 2026-09-13), a nie z nich skopiowane: krótkie podsumowanie plus 2–4 punkty przydatne na szlaku. Aplikacja podaje źródło i licencję (CC BY-SA 4.0) pod każdym opisem. Nie ma w nich informacji spoza artykułów. Tam, gdzie artykuł był niepewny albo dotyczył innego miejsca, fakt pominąłem.

Dopasowanie artykułów wymagało uwagi, bo nazwy się powtarzają:

| Szczyt | Artykuł | Uwagi |
|---|---|---|
| Orłowa | Orłowa (szczyt) | samo „Orłowa” to miasto w Czechach |
| Świniorka | Świniarka (Beskid Śląski) | inna forma nazwy; „Świniorka” to przekierowanie |
| Czupel | Czupel (736 m) | jest też Czupel 882 m |
| Biały Krzyż | Biały Krzyż (szczyt) | nie mylić z przełęczą i dawnym schroniskiem |
| Beskidek | Beskidek (860 m) | opisuje sąsiedni wierzchołek — patrz 3.4 |
| Jaworzyna | Jawierzny | „Jaworzyna (Beskid Śląski)” przekierowuje na Skałkę w masywie Baraniej Góry |
| pozostałe | nazwa szczytu, ew. z dopiskiem „(Beskid Śląski)” | każdy artykuł sprawdzony po współrzędnych |

**Zdjęcia** wybierałem po obejrzeniu wszystkich kandydatów: zdjęcia z artykułów, obraz główny z Wikidata (P18), kategoria Commons szczytu (P373) i pliki z geotagiem w promieniu 400 m. Z ok. 100 kandydatów zostało 39. Odrzucone: panoramy z naniesionymi opisami, zdjęcia z innych miejsc wrzucone do kategorii (chrząszcze i restauracje z Ustronia w kategorii *Równica*, staw w Goczałkowicach w kategorii *Stołów*) i widoki, na których szczyt jest nie do rozpoznania. Dla sześciu szczytów Commons ma tylko jedno sensowne zdjęcie.

Decyzje techniczne:

- **Zdjęcia leżą w repo**, a nie są wczytywane z `upload.wikimedia.org` — z tego samego powodu co logo sponsora ([sekcja 9](#9-prywatność--jak-jest-zrobiona-technicznie)).
- **Dwa rozmiary.** Pasek w panelu ładuje miniatury o wysokości 360 px (1,0 MB za wszystkie), a pełne zdjęcie dopiero w podglądzie. W terenie, na słabym zasięgu, różnica jest odczuwalna.
- **Rozmiar pod smartfon.** Zdjęcia służą wyłącznie do podglądu na telefonie, więc dłuższy bok ma 960 px (panoramy do 1280 px szerokości), a jakość WebP to 60, dla miniatur 55. Ekran telefonu ma ~400 px szerokości przy gęstości 2–3×, więc to wystarcza z zapasem. Pełne zdjęcia zajmują 3,7 MB; przy 1200 px i jakości 70 zajmowały 6,6 MB.
- **Poza precache.** Service Worker zapisuje zdjęcie przy pierwszym obejrzeniu (`CacheFirst`, 90 dni), zamiast dokładać kilka MB do instalacji.
- **`peakInfo.json` jest osobnym chunkiem** ładowanym przy pierwszym otwarciu panelu, więc bundle startowy go nie niesie.
- **Atrybucja** — autor na każdej miniaturze, a w podglądzie autor, licencja i link do strony pliku. Pełna lista poniżej.

<details>
<summary>Autorzy zdjęć i licencje</summary>

| Szczyt | Zdjęcie | Autor | Licencja |
|---|---|---|---|
| Zebrzydka | [Zebrzydka z ulicy Spacerowej w Górkach Wielkich](https://commons.wikimedia.org/wiki/File:POL_G%C3%B3rki_Wielkie_Zebrzydka_ze_Spacerowej.JPG) | D T G | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0) |
| Orłowa | [Orłowa z Trzech Kopców Wiślańskich, w tle Równica](https://commons.wikimedia.org/wiki/File:Orlowa.jpg) | Adrian Tync | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Orłowa | [Orłowa widziana z Czantorii Wielkiej](https://commons.wikimedia.org/wiki/File:Or%C5%82owa_B%C5%9A3_(2).jpg) | Jerzy Opioła | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Orłowa | [Widok na Równicę z hali pod Orłową](https://commons.wikimedia.org/wiki/File:Or%C5%82owa_Beskid_%C5%9Al%C4%85ski.JPG) | Pudelek | [CC BY-SA 3.0](http://creativecommons.org/licenses/by-sa/3.0/) |
| Błatnia | [Wierzchołek Błatniej](https://commons.wikimedia.org/wiki/File:B%C5%82atnia_2024.jpg) | Kamil Czaiński | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Błatnia | [Schronisko PTTK na Błatniej](https://commons.wikimedia.org/wiki/File:Schronisko_na_B%C5%82atniej_B%C5%9A4.jpg) | Jerzy Opioła | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Błatnia | [Symboliczny tron na szczycie](https://commons.wikimedia.org/wiki/File:B%C5%82atnia,_tron_na_szczycie_01.jpg) | Kamil Czaiński | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Świniorka | [Widok z Trzech Kopców Wiślańskich na północ — z lewej Świniorka, w głębi Pasmo Błatniej](https://commons.wikimedia.org/wiki/File:Widok_z_Trzech_Kopc%C3%B3w_B%C5%9A3.jpg) | Jerzy Opioła | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Gościejów | [Wierzchołek zimą, na żółtym szlaku](https://commons.wikimedia.org/wiki/File:Wierch_Go%C5%9Bciej%C3%B3w_summit_winter_2022.jpg) | Adrian Tync | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Gościejów | [Rzeźba Raspazjana pamięci Arkadiusza Kremzy](https://commons.wikimedia.org/wiki/File:Wierch_Go%C5%9Bciej%C3%B3w_Arkadiusz_Kremza_memorial_close-up.jpg) | Adrian Tync | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Hyrca | [Hyrca (Beskid Mały)](https://commons.wikimedia.org/wiki/File:Hyrca-Beskidy_2009_r._833.jpg) | Bastet78 | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| Czupel | [Czupel widziany z Trzech Kopców Wiślańskich](https://commons.wikimedia.org/wiki/File:Brenna_Czupel.jpg) | Adrian Tync | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Mały Cisowy | [Widok z Trzech Kopców Wiślańskich — Mała Cisowa w głębi, pośrodku](https://commons.wikimedia.org/wiki/File:Widok_z_Trzech_Kopc%C3%B3w_B%C5%9A3.jpg) | Jerzy Opioła | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Mały Cisowy | [Mały Cisowy i Czupel znad stawu Maciek w Goczałkowicach-Zdroju](https://commons.wikimedia.org/wiki/File:Ma%C5%82y_Cisowy_Maciek.jpg) | Adrian Tync | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Biały Krzyż | [Słup graniczny Brennej i Szczyrku na Białym Krzyżu](https://commons.wikimedia.org/wiki/File:POL_Brenna_Szczyrk_kamie%C5%84_graniczny_na_Bia%C5%82ym_Krzy%C5%BCu.jpg) | D T G | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| Biały Krzyż | [Przełęcz Salmopolska pod szczytem](https://commons.wikimedia.org/wiki/File:Prze%C5%82%C4%99cz_Salmopolska_BS2.jpg) | Jerzy Opioła | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Stary Groń | [Wieża widokowa na Starym Groniu](https://commons.wikimedia.org/wiki/File:Stary_Gro%C5%84_tower.jpg) | Adrian Tync | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Stary Groń | [Zimowy widok z wieży: dolina Hołcyny i pasmo Kotarza](https://commons.wikimedia.org/wiki/File:View_from_Stary_Gro%C5%84_(Beskid_%C5%9Al%C4%85ski).jpg) | Jendrusk | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Beskidek | [Masyw Beskidka od strony Szczyrku (osiedle Podmagura)](https://commons.wikimedia.org/wiki/File:Beskidek_widziany_z_Osiedla_Podmagura.jpg) | Viroitu | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) |
| Kotarz | [Kotarz z masztem przekaźnika, widziany z Przełęczy Salmopolskiej](https://commons.wikimedia.org/wiki/File:Salmopolska_saddle_view_on_Kotarz_2.jpg) | Andrzej Kępys | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Kotarz | [Kamienny ołtarz na Kotarzu](https://commons.wikimedia.org/wiki/File:Kamienny_o%C5%82tarz_na_g%C3%B3rze_Kotarz_2009_r._914.jpg) | Bastet78 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Kotarz | [Kotarz od wschodu](https://commons.wikimedia.org/wiki/File:Kotarz_B%C5%9A3.jpg) | Jerzy Opioła | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Horzelica | [Punkt triangulacyjny na szczycie Horzelicy](https://commons.wikimedia.org/wiki/File:Horzelica_trig_point.jpg) | Adrian Tync | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Wielka Cisowa | [Bezleśny grzbiet Wielkiej Cisowej](https://commons.wikimedia.org/wiki/File:Wielka_Cisowa_B%C5%9A4_(2).jpg) | Jerzy Opioła | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Wielka Cisowa | [Łubin przy krzyżu na grzbiecie](https://commons.wikimedia.org/wiki/File:Wielka_Cisowa_B%C5%9A4.jpg) | Jerzy Opioła | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Wielka Cisowa | [Tabliczka na szczycie](https://commons.wikimedia.org/wiki/File:Wielka_Cisowa_872.JPG) | Jacek downey | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) |
| Stołów | [Stołów (pośrodku) widziany z Hyrcy](https://commons.wikimedia.org/wiki/File:Sto%C5%82%C3%B3w.jpg) | Adrian Tync | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Stołów | [Szlak przez Stołów](https://commons.wikimedia.org/wiki/File:Sto%C5%82%C3%B3w_w_Beskidzie_%C5%9Alaskim.jpg) | Mariuszjbie | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| Jaworzyna | [Jawierzny (Jaworzyna) widziane z Czupla nad Wisłą](https://commons.wikimedia.org/wiki/File:Wisla_Jawierzny_799.jpg) | Adrian Tync | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Równica | [Polana pod szczytem Równicy](https://commons.wikimedia.org/wiki/File:R%C3%B3wnica_szczyt_p.jpg) | Przykuta | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Równica | [Równica](https://commons.wikimedia.org/wiki/File:R%C3%B3wnica_p.jpg) | Przykuta | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Równica | [Restauracja Dwór Skibówki na Równicy](https://commons.wikimedia.org/wiki/File:R%C3%B3wnica_B%C5%9A5.jpg) | Jerzy Opioła | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Trzy Kopce | [Wierzchołek Trzech Kopców](https://commons.wikimedia.org/wiki/File:Trzy_Kopce_Beskid_Slaski.jpg) | Adrian Tync | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Trzy Kopce | [Ruiny schroniska na Trzech Kopcach (2005)](https://commons.wikimedia.org/wiki/File:Ruiny_schroniska_na_Trzech_Kopcach_w_Beskidzie_Slaskim.jpg) | Ela Lesiak | [CC BY-SA 3.0](http://creativecommons.org/licenses/by-sa/3.0/) |
| Trzy Kopce Wiślańskie | [Trzy głazy w miejscu styku granic Ustronia, Wisły i Brennej](https://commons.wikimedia.org/wiki/File:G%C5%82azy_na_szczycie_Trzech_Kopc%C3%B3w_Wi%C5%9Bla%C5%84skich_w_Beskidzie_%C5%9Al%C4%85skim,_20260412_1033_0042.jpg) | Jakub Hałun | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) |
| Trzy Kopce Wiślańskie | [Na grzbiecie Trzech Kopców Wiślańskich](https://commons.wikimedia.org/wiki/File:Trzy_Kopce_Wi%C5%9Bla%C5%84skie_B%C5%9A3_(3).jpg) | Jerzy Opioła | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Trzy Kopce Wiślańskie | [Owce na szczycie, kwiecień 2026](https://commons.wikimedia.org/wiki/File:Stado_owiec_na_Trzech_Kopcach_Wi%C5%9Bla%C5%84skich_w_Beskidzie_%C5%9Al%C4%85skim,_20260412_1055_0052.jpg) | Jakub Hałun | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) |
| Trzy Kopce Wiślańskie | [Cumulonimbus o zachodzie słońca](https://commons.wikimedia.org/wiki/File:Trzy_Kopce_Wi%C5%9Bla%C5%84skie_-_Cumulonimbus.jpg) | Mstudnicki | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Grabowa | [Szczyt Grabowej](https://commons.wikimedia.org/wiki/File:POL_Grabowa_w_Beskidzie_%C5%9Al%C4%85skim.jpg) | D T G | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| Grabowa | [Oznaczenie szczytu zimą](https://commons.wikimedia.org/wiki/File:Grabowa_peak_guidepost.jpg) | Jendrusk | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |

</details>

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

**7. Cache i wątek** — [`useDayRoute.ts`](src/lib/useDayRoute.ts) trzyma wyniki w cache'u modułowym pod kluczem `(parking, pętla, kolejność szczytów)` i liczy poza ścieżką renderowania. Dla planu wielodniowego dni liczone są **po kolei, nie równolegle** — sześć Dijkstr naraz zablokowałoby wątek na dobrą sekundę. Do czasu policzenia mapa rysuje przebieg orientacyjny linią kropkowaną, a paski pokazują „liczę trasę…". Kiedy pasek i linia na mapie proszą o tę samą trasę naraz, dzielą jedno liczenie.

Niżej, w [`dayRoute.ts`](src/lib/dayRoute.ts), jest drugi cache: **pojedynczych odcinków**, pod kluczem współrzędnych obu końców. Trasa na dziś przelicza się po każdym dotknięciu szczytu, a dołożenie szczytu zmienia zwykle jeden–dwa odcinki. Zmierzone: trzeci szczyt dolicza się w 5 ms (zimny odcinek to ok. 15 ms), a odwrócenie kierunku zajmuje 0 ms. Sieć jest nieskierowana, więc odcinek B→A to po prostu odwrócony A→B.

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
├── public/peaks/                  # zdjęcia szczytów z Commons (WebP + miniatury)
├── tools/
│   ├── build-trails.py            # sieć ścieżek z OSM → trails.json
│   ├── build-elevation.py         # siatka SRTM → elevation.json
│   └── build-peak-photos.py       # zdjęcia i licencje z Commons → public/peaks/
└── src/
    ├── App.tsx                    # 6 zakładek, wspólny stan wybranego dnia
    ├── types.ts
    ├── index.css                  # tokeny motywu, warstwa komponentów
    ├── data/
    │   ├── peaks.json  peaks.ts   # 20 szczytów
    │   ├── peakInfo.json          # opisy i zdjęcia szczytów (osobny chunk)
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
    │   ├── todayRoute.ts          # trasa na dziś: parking, kolejność, kierunek
    │   ├── photo.ts               # kompresja canvas→WebP, EXIF
    │   ├── gpx.ts                 # zapis GPX 1.1
    │   └── download.ts
    ├── store/
    │   ├── progress.ts            # zustand + persist → localStorage
    │   └── media.ts               # idb → IndexedDB (zdjęcia)
    ├── features/
    │   ├── checklist/             # Checklist, PeakCard, PeakSheet, PeakInfo
    │   ├── map/                   # MapView + DayTrack + DaySummary + TodayPanel
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
  mapy?: string               // link do obiektu w Mapy.com
}

interface PeakInfo {          // statyczne, z peakInfo.json (klucz = Peak.id)
  range?: string              // pasmo
  summary: string
  highlights: string[]
  wiki?: { title: string; url: string; note?: string }
  photos: PeakPhoto[]
}

interface PeakPhoto {
  commons: string; caption: string        // redagowane ręcznie
  src: string; thumb: string; w: number; h: number
  author: string; license: string; licenseUrl?: string; page: string  // z Commons, przez skrypt
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

interface TodayPlan {         // localStorage — trasa na dziś
  peakIds: string[]           // zbiór; kolejność liczona za każdym razem
  parking: { kind: 'auto' } | { kind: 'none' } | { kind: 'point'; id: string }
         | { kind: 'custom'; lat: number; lon: number; ele: number }
  loop: boolean               // powrót na parking
  reversed: boolean           // kierunek przejścia
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
| postęp, plan, trasa na dziś, ustawienia | **localStorage** (`zustand/persist`) | kilkanaście kB, synchroniczny odczyt przy starcie |
| zdjęcia | **IndexedDB** (`idb`) | localStorage ma limit ~5 MB i trzyma tylko stringi; 20 zdjęć × ~300 KB ≈ 6 MB |
| trasy | **cache w pamięci** | wynik deterministyczny, przeliczalny w każdej chwili |

Wpychanie zdjęć do localStorage, choćby jako base64, to najczęstszy błąd w takich projektach — kończy się cichym `QuotaExceededError`. Zdjęcia idą do IndexedDB jako `Blob`, bez konwersji.

### Podział na chunki

| Chunk | Rozmiar | gzip | Kiedy się ładuje |
|---|---|---|---|
| `index` | 310 KB | **104 KB** | start |
| `index.css` | 56 KB | 15 KB | start |
| `map` (Leaflet) | 299 KB | 91 KB | zakładka Mapa |
| `trails` | 648 KB | 229 KB | pierwsze liczenie trasy |
| `elevation` | 112 KB | 39 KB | pierwsze liczenie trasy |
| `peakInfo` | 30 KB | 8 KB | pierwsze otwarcie panelu szczytu |
| `jspdf` + `html2canvas` + `purify` | 742 KB | 173 KB | dopiero przy eksporcie PDF |

jsPDF ciągnął 380 KB zależności do bundla startowego, dopóki nie trafił na dynamiczny import. Dane routingu tak samo — statyczny import wpychał je do `index` i podnosił start do 341 KB gzip.

Service Worker precache'uje 17 plików, łącznie **2,1 MB** — czyli po pierwszym uruchomieniu routing i cała aplikacja działają offline. Kafelki OSM mają osobną regułę `CacheFirst` z ważnością 30 dni, zdjęcia szczytów — `CacheFirst` z ważnością 90 dni (w trybie offline widać te, które się już raz obejrzało).

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
- **zdjęcia szczytów też leżą lokalnie** w `public/peaks/`. Otwarcie panelu szczytu nie wysyła nic do Wikimedia, a Wikipedia i Commons otwierają się dopiero po kliknięciu w link,
- jedyne zapytania sieciowe w normalnej pracy to **kafelki map** (OpenStreetMap, OpenTopoMap, Waymarked Trails).

Konsekwencja, o której UI mówi wprost: **wyczyszczenie danych przeglądarki kasuje postęp**. Stąd przypomnienia o backupie i eksport całego stanu do pliku.

---

## 10. Narzędzia budujące dane

Skrypty uruchamia się **ręcznie**, tylko gdy trzeba odświeżyć dane z OSM, SRTM albo Commons. Nie są częścią builda — wynik jest wersjonowany w repo.

```bash
python3 tools/build-trails.py        # ~15 s, → src/data/trails.json
python3 tools/build-elevation.py     # ~5 min, → src/data/elevation.json
python3 tools/build-peak-photos.py   # ~1 min, → public/peaks/*.webp + metadane w peakInfo.json (wymaga Pillow)
```

`build-peak-photos.py` niczego nie wybiera sam. Czyta z `peakInfo.json` ręcznie wpisane pola `commons` (nazwa pliku) i `caption`, a uzupełnia tylko pola pochodne: wymiary, miniatury, autora, licencję, link do strony pliku i `wiki.url`. Żeby zmienić zdjęcie, podmienia się nazwę pliku w JSON i uruchamia skrypt. Pliki, które przestały być używane, skrypt usuwa.

Pułapki, na które warto uważać przy modyfikacji:

- **Overpass odrzuca zapytania bez nagłówka `User-Agent`** — zwraca HTTP 406 bez treści błędu.
- Przynależność do szlaku PTTK jest tagiem **relacji**, nie odcinka. Zapytanie o `marked_trail:*` na samych odcinkach znajduje ich 47; przez relacje `route=hiking` — 833.
- `api.opentopodata.org` przyjmuje 100 punktów na zapytanie i jedno zapytanie na sekundę. Skrypt ma pauzę 1,1 s i pięć prób ponowienia.
- Zmiana `STEP_M` w skrypcie wysokości zmienia rozdzielczość i czas pobierania kwadratowo: 180 m to 6 912 punktów i minuta, 90 m to 27 648 punktów i pięć minut.
- **Commons zwraca miniatury tylko w stałych rozmiarach** — prośba o 800 px daje 960 px. Skrypt pobiera wariant 1920 px i zmniejsza lokalnie.
- Pole `Artist` w metadanych Commons to **HTML** z linkami do stron użytkowników i dopiskami typu „(talk)” — skrypt zdejmuje znaczniki, zanim zapisze autora.

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
| Współrzędne 20 szczytów zgodne z punktami Mapy.com (maks. 0,7 m) i z lokalnymi maksimami SRTM | ✅ |
| Panel każdego z 20 szczytów: opis, link Mapy.com, wszystkie miniatury załadowane | ✅ |
| Pasek ładuje miniatury, pełne zdjęcie dopiero w podglądzie | ✅ |
| Podgląd: autor i licencja widoczne, strzałka przełącza zdjęcie, Escape zamyka podgląd, a nie panel | ✅ |
| Otwarcie panelu szczytu: zero zapytań do obcych domen | ✅ |
| Każdy plik wskazany w `peakInfo.json` istnieje w `dist/peaks` | ✅ |
| Trasa na dziś: 20 szczytów + 8 parkingów na mapie, wybór dotknięciem markera, przeliczenie i nowa kolejność po każdym wyborze | ✅ |
| Parking: automatyczny, dotknięcie `P`, lista, własne miejsce dotknięciem mapy (wysokość z SRTM, marker przeciągalny), bez parkingu | ✅ |
| Powrót / bez powrotu; odwrócenie kierunku zablokowane dla trasy bez powrotu; × usuwa szczyt z trasy | ✅ |
| Wybór na dziś zapisany w `localStorage`, wyjście z trybu przywraca pasek dni | ✅ |
| Panel trasy na dziś przy 390 px: bez poziomego przewijania, kontrolka warstw nie wchodzi pod pasek | ✅ |
| Logika (jednorazowy skrypt w Node przez esbuild): generator po wydzieleniu `orderPeaks` nadal daje 20 szczytów dla 1–8 dni; automatyczny parking, odwracanie, własny parking; cache odcinków | ✅ |
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
- **Trasa na dziś układa kolejność po linii prostej**, tak jak generator, a nie po czasie przejścia po szlakach. Gdy szczyty leżą po dwóch stronach doliny, wybrana kolejność po szlakach nie musi być najkrótsza. Kolejności nie da się też przestawić ręcznie, a trasy — zapisać jako dnia planu ani wyeksportować do GPX.
- **Podział szczytów w wariantach 1-, 2- i 4-dniowym jest mój**, nie gminy. Oznaczone w UI, ale warto by odczytać go z map w PDF.
- **Zebrzydka** — rozbieżność wysokości opisana w [3.4](#34-rozbieżności-wymagające-potwierdzenia), do potwierdzenia w terenie.
- **Dzień VI wariantu gminy** różni się od trasy policzonej po szlakach o ~30%, bo gmina daje tam wybór drogi. To ograniczenie z założenia, nie usterka.
- **Aplikacja nie była uruchomiona na realnym telefonie.** Wszystko powyżej pochodzi z headless Chrome i lektury kodu.
- **Brak testów jednostkowych.** Logika obliczeniowa (`geo`, `trailRouter`, `elevation`, `planGenerator`) jest czysta i dobrze się do nich nadaje.
- **E8 z pierwotnego planu** — Lighthouse i test na urządzeniu — czeka na wdrożenie po HTTPS.

---

## Zastrzeżenia

Projekt nieoficjalny. Jedyną wiążącą procedurą zaliczenia jest ta opisana przez organizatora na [koronagorbrennej.pl](https://www.koronagorbrennej.pl/) — aplikacja niczego nie zgłasza za Ciebie i nie zastępuje weryfikacji.

Dane szczytów i sieci ścieżek pochodzą z materiałów organizatora oraz OpenStreetMap (© kontrybutorzy OpenStreetMap, [ODbL](https://www.openstreetmap.org/copyright)). Wysokości: SRTM przez [opentopodata.org](https://www.opentopodata.org/). Szlaki na mapie: [waymarkedtrails.org](https://hiking.waymarkedtrails.org) (CC-BY-SA).

**W górach kieruj się oznakowaniem szlaków PTTK, nie aplikacją.** Trasy liczone przez router są propozycją opartą na danych OSM, a nie gwarancją przejezdności.
