import { useCallback, useEffect, useRef, useState } from 'react'
import type { TrackPoint } from '../../types'

export interface GeoState {
  position: { lat: number; lon: number; accuracy: number } | null
  error: string | null
  watching: boolean
}

/** Śledzenie pozycji + opcjonalny zapis śladu. */
export function useGeolocation(enabled: boolean, recordTrack = false) {
  const [state, setState] = useState<GeoState>({ position: null, error: null, watching: false })
  const trackRef = useRef<TrackPoint[]>([])
  const idRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) {
      if (idRef.current !== null) {
        navigator.geolocation.clearWatch(idRef.current)
        idRef.current = null
      }
      setState((s) => ({ ...s, watching: false }))
      return
    }
    if (!('geolocation' in navigator)) {
      setState({ position: null, error: 'Przeglądarka nie udostępnia geolokalizacji.', watching: false })
      return
    }

    setState((s) => ({ ...s, watching: true, error: null }))
    idRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }
        setState({ position: point, error: null, watching: true })
        if (recordTrack) {
          trackRef.current.push({
            lat: point.lat,
            lon: point.lon,
            ele: pos.coords.altitude ?? undefined,
            t: pos.timestamp,
          })
        }
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Brak zgody na dostęp do lokalizacji.'
            : err.code === err.POSITION_UNAVAILABLE
              ? 'Pozycja niedostępna — słaby sygnał GPS.'
              : 'Nie udało się ustalić pozycji.'
        setState({ position: null, error: msg, watching: false })
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )

    const id = idRef.current
    return () => {
      if (id !== null) navigator.geolocation.clearWatch(id)
      idRef.current = null
    }
  }, [enabled, recordTrack])

  const takeTrack = useCallback(() => {
    const points = trackRef.current
    trackRef.current = []
    return points
  }, [])

  const currentTrack = useCallback(() => trackRef.current, [])

  return { ...state, takeTrack, currentTrack }
}
