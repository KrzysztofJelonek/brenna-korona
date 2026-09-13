import { useCallback, useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** PWA na telefonie potrafi wisieć otwarta całymi dniami — wtedy sprawdzamy wersję co jakiś czas. */
const CHECK_EVERY_MS = 30 * 60_000
/** Powroty do aplikacji sprawdzają wersję najwyżej raz na minutę. */
const MIN_CHECK_GAP_MS = 60_000

/**
 * Pilnuje, żeby działała najnowsza wersja aplikacji.
 *
 * Nowa wersja sprawdzana jest przy starcie, po powrocie do aplikacji i co pół godziny.
 * Znaleziona wersja podmienia się sama, jeśli nic to nie przerwie: zanim użytkownik
 * czegokolwiek dotknie albo gdy aplikacja schodzi z ekranu lub na niego wraca.
 * Przy włączonej lokalizacji lub nagrywaniu (`busy`) tylko sygnalizujemy aktualizację —
 * przeładowanie wyłączyłoby GPS i skasowało nagrany ślad.
 */
export function useAppUpdate(busy: boolean) {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const {
    needRefresh: [available],
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      if (!registration) return
      registrationRef.current = registration
      let lastCheck = 0
      const check = async () => {
        if (!navigator.onLine || registration.installing || Date.now() - lastCheck < MIN_CHECK_GAP_MS) return
        lastCheck = Date.now()
        try {
          // `reload` omija cache przeglądarki, więc update() porównuje najświeższy sw.js, jaki da serwer.
          // CDN GitHub Pages i tak trzyma sw.js do 10 minut — nowa wersja może pojawić się z takim opóźnieniem.
          const res = await fetch(swUrl, { cache: 'reload' })
          if (res.ok) await registration.update()
        } catch {
          // Offline albo serwer niedostępny — spróbujemy przy następnej okazji.
        }
      }
      check()
      setInterval(check, CHECK_EVERY_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })

  // Dopóki użytkownik niczego nie dotknął, przeładowanie niczego mu nie zabiera.
  const touched = useRef(false)
  useEffect(() => {
    const mark = () => {
      touched.current = true
    }
    window.addEventListener('pointerdown', mark, { capture: true, once: true })
    window.addEventListener('keydown', mark, { capture: true, once: true })
    return () => {
      window.removeEventListener('pointerdown', mark, { capture: true })
      window.removeEventListener('keydown', mark, { capture: true })
    }
  }, [])

  const reloading = useRef(false)
  /**
   * Przełącza na nową wersję. Nie polegamy na zdarzeniu „controlling” z workbox-window: karta,
   * której nie kontroluje service worker (pierwsza wizyta, twarde odświeżenie — częste na PC),
   * nigdy go nie dostaje, a nowa wersja jest w niej zwykle od razu aktywna, bez czekania.
   */
  const apply = useCallback(() => {
    if (reloading.current) return
    reloading.current = true
    const reload = () => window.location.reload()
    const waiting = registrationRef.current?.waiting
    if (!waiting) {
      reload()
      return
    }
    navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true })
    waiting.addEventListener('statechange', () => {
      if (waiting.state === 'activated') reload()
    })
    waiting.postMessage({ type: 'SKIP_WAITING' })
    // Awaryjnie, gdyby nowy service worker nie przejął strony.
    setTimeout(reload, 3000)
  }, [])

  useEffect(() => {
    if (!available || busy) return
    if (!touched.current || document.visibilityState === 'hidden') {
      apply()
      return
    }
    // W trakcie korzystania nie przeładowujemy pod palcem — dopiero przy zmianie widoczności.
    document.addEventListener('visibilitychange', apply)
    return () => document.removeEventListener('visibilitychange', apply)
  }, [available, busy, apply])

  return { available, apply }
}
