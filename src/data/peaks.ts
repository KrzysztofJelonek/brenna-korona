import raw from './peaks.json'
import type { Peak } from '../types'

interface PeaksFile {
  edition: number
  challengeStart: string
  challengeEnd: string
  peaks: Peak[]
}

const data = raw as unknown as PeaksFile

export const PEAKS: Peak[] = data.peaks
export const EDITION = data.edition
export const CHALLENGE_START = data.challengeStart
export const CHALLENGE_END = data.challengeEnd
export const FINALE_DATE = '2026-10-17'

export const peakById = (id: string): Peak | undefined => PEAKS.find((p) => p.id === id)

/** Czy data (ISO lub YYYY-MM-DD) mieści się w oknie wydarzenia. */
export function isWithinChallenge(iso: string | undefined): boolean {
  if (!iso) return false
  const d = iso.slice(0, 10)
  return d >= CHALLENGE_START && d <= CHALLENGE_END
}

export function daysLeft(from = new Date()): number {
  const end = new Date(CHALLENGE_END + 'T23:59:59')
  return Math.ceil((end.getTime() - from.getTime()) / 86_400_000)
}
