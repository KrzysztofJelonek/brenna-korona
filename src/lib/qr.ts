/**
 * Kod QR z adresem aplikacji — liczony na urządzeniu, bez żadnego generatora w sieci.
 * Posłanie adresu do obcego serwisu po obrazek byłoby jedynym takim zapytaniem w całej
 * aplikacji, a na szlaku i tak nie byłoby na nie zasięgu.
 *
 * Biblioteka (~14 KB gzip) wchodzi dynamicznie, dopiero przy otwarciu okna udostępniania,
 * więc nie obciąża startu. Service Worker trzyma ją w precache, więc offline też działa.
 */

export interface QrCode {
  /** Bok kodu w modułach, razem z obowiązkową białą ramką. */
  size: number
  /** Ciemne moduły jako jedna ścieżka SVG w układzie współrzędnych `size × size`. */
  path: string
}

/** Biała ramka wokół kodu. Norma mówi o 4 modułach; skanery w telefonach czytają też z mniejszą. */
const MARGIN = 4

export async function makeQr(text: string): Promise<QrCode> {
  const { default: qrcode } = await import('qrcode-generator')
  // 0 = wersja dobrana automatycznie do długości tekstu, 'M' = korekcja błędów ~15%,
  // czyli kod czytelny również z ekranu w słońcu albo z lekko zabrudzonego wydruku.
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()

  const count = qr.getModuleCount()
  let path = ''
  for (let row = 0; row < count; row++) {
    // Ciemne moduły w rzędzie łączymy w jeden prostokąt — ścieżka jest kilka razy krótsza
    // od wersji „kwadrat na moduł”, a przy okazji znikają włoskowate szpary między nimi.
    let start = -1
    for (let col = 0; col <= count; col++) {
      const dark = col < count && qr.isDark(row, col)
      if (dark && start < 0) start = col
      if (!dark && start >= 0) {
        path += `M${start + MARGIN} ${row + MARGIN}h${col - start}v1h-${col - start}z`
        start = -1
      }
    }
  }

  return { size: count + MARGIN * 2, path }
}
