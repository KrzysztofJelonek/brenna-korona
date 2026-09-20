# Materiały promocyjne

Grafiki i wideo o aplikacji — wszystko powstaje ze zrzutów prawdziwej aplikacji,
nie z mockupów. Katalog jest niezależny od aplikacji: ma własny `package.json`
i nie wchodzi do builda ani do PWA.

## Gotowe pliki

| Plik | Format | Do czego |
| --- | --- | --- |
| `korona-apka-post.jpg` / `.png` | 1080×1350 (4:5) | obrazek do długiego posta na stronie |
| `korona-apka.mp4` | 1080×1920 (9:16), 21 s | rolka / Stories |
| `korona-apka-cover.jpg` | 1080×1920 (9:16) | okładka rolki wgrywana ręcznie na TikToku |
| `screens/*.png` | 1170×2532 | pojedyncze zrzuty, np. do komentarza |

Wideo i długi post publikuje się osobno: wideo dodane do posta zamienia go w rolkę
i długi tekst przestaje być widoczny.

## Jak to odtworzyć

```bash
npm install                 # playwright-core + ffmpeg-static, tylko tutaj

# 1. zrzuty aplikacji (wymaga zbudowanej aplikacji wystawionej na 4178)
cd .. && npm run build && (cd dist && python3 -m http.server 4178 --bind 127.0.0.1) &
cd promo && npm run shots

# 2. serwer dla stron renderujących (kolejne kroki czytają z niego zrzuty)
npm run serve &

npm run card                # grafika 4:5 do posta → korona-apka-post.png/.jpg
npm run cover               # okładka rolki → korona-apka-cover.jpg
npm run preview             # 8 klatek kontrolnych rolki → build/preview/
npm run frames              # 637 klatek rolki → build/frames/ (kilka minut)
npm run video               # klatki + podkład → korona-apka.mp4
```

`shots.mjs` przed startem aplikacji wstrzykuje do `localStorage` stan: 10 zaliczonych
szczytów i dwie trasy „na dziś” (Górki Wielkie → Bukowa z osobną metą oraz pętla
z Bukowej przez Halę Jaworową). Dzięki temu zrzuty pokazują realną sytuację,
a nie pustą aplikację po instalacji. Datę i zestaw szczytów zmienia się na górze pliku.

## Co jest czym

- `src/render.html` — scenariusz rolki: `window.renderAt(t)` ustawia cały kadr dla
  zadanej sekundy, więc klatki renderują się deterministycznie. Cięcia są dopasowane
  do taktu podkładu (132,5 BPM, takt 1,81 s — jedna scena to półtora taktu).
- `src/card.html` — grafika do posta.
- `src/cover.html` — okładka rolki; treść trzyma się pasa y 430–1420, bo siatka profilu
  przycina miniaturkę od góry i od dołu, a w feedzie dół zasłania opis.
- `src/shots.mjs`, `src/card.mjs`, `src/frames.mjs`, `src/video.mjs` — sterowanie
  przeglądarką i ffmpegiem.
- `audio/` — podkład muzyczny (poza repo).
- `build/` — klatki pośrednie (poza repo).

Zmiana długości podkładu wymaga poprawienia `D` w `frames.mjs` i `FADE_AT` w `video.mjs`.
