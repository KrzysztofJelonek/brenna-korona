import { useEffect, useState } from 'react'
import type { TrackPoint } from '../../types'

export interface GeoState {
  position: { lat: number; lon: number; accuracy: number } | null
  error: string | null
  watching: boolean
}

/** Śledzenie pozycji + opcjonalny zapis śladu. */
export function useGeolocation(enabled: boolean, recordTrack = false) {
  const [state, setState] = useState<GeoState>({ position: null, error: null, watching: false })
  // Ślad trzymamy w stanie, a nie w refie — mapa rysuje go na bieżąco.
  const [track, setTrack] = useState<TrackPoint[]>([])

  useEffect(() => {
    if (!enabled) {
      // Po wyłączeniu nie pokazujemy starej pozycji jak aktualnej.
      setState({ position: null, error: null, watching: false })
      return
    }
    if (!('geolocation' in navigator)) {
      setState({ position: null, error: 'Przeglądarka nie udostępnia geolokalizacji.', watching: false })
      return
    }

    setState((s) => ({ ...s, watching: true, error: null }))
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const point = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }
        setState({ position: point, error: null, watching: true })
        if (recordTrack) {
          setTrack((t) => [
            ...t,
            { lat: point.lat, lon: point.lon, ele: pos.coords.altitude ?? undefined, t: pos.timestamp },
          ])
        }
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED
        const msg = denied
          ? 'Brak zgody na dostęp do lokalizacji.'
          : err.code === err.POSITION_UNAVAILABLE
            ? 'Pozycja niedostępna — słaby sygnał GPS.'
            : 'Nie udało się ustalić pozycji.'
        // Chwilowa utrata sygnału (las, dolina) nie kasuje ostatniej znanej pozycji —
        // przeglądarka dalej próbuje, a znacznik nie miga na mapie.
        setState((s) => ({ position: denied ? null : s.position, error: msg, watching: !denied }))
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )

    return () => navigator.geolocation.clearWatch(id)
  }, [enabled, recordTrack])

  return { ...state, track }
}
