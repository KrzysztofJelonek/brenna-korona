import type { Peak } from '../../types'
import { haversine, TERRAIN_FACTOR } from '../../lib/geo'

interface Props {
  peaks: Peak[]
  color: string
}

/**
 * Profil szczytów dnia: wysokości wierzchołków rozłożone wzdłuż szacowanego
 * dystansu. To nie jest profil realnego szlaku — do tego trzeba by geometrii
 * tras, której materiały organizatora nie zawierają.
 */
export function ElevationProfile({ peaks, color }: Props) {
  if (peaks.length < 2) return null

  const W = 320
  const H = 88
  const PAD = 10

  const dists: number[] = [0]
  for (let i = 1; i < peaks.length; i++) {
    dists.push(dists[i - 1] + haversine(peaks[i - 1].lat, peaks[i - 1].lon, peaks[i].lat, peaks[i].lon) * TERRAIN_FACTOR)
  }
  const total = dists[dists.length - 1] || 1
  const eles = peaks.map((p) => p.ele)
  const min = Math.min(...eles) - 60
  const max = Math.max(...eles) + 40

  const x = (i: number) => PAD + (dists[i] / total) * (W - 2 * PAD)
  const y = (e: number) => H - PAD - ((e - min) / (max - min)) * (H - 2 * PAD)

  const line = peaks.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.ele).toFixed(1)}`).join(' ')
  const area = `${line} L${x(peaks.length - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`
  const gid = `prof-${color.replace('#', '')}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Profil wysokości dnia">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {peaks.map((p, i) => (
        <g key={p.id}>
          <circle cx={x(i)} cy={y(p.ele)} r="3" fill={color} stroke="#0b1120" strokeWidth="1.5" />
          <text x={x(i)} y={y(p.ele) - 7} textAnchor="middle" fontSize="8" fill="#94a3b8">
            {p.ele}
          </text>
        </g>
      ))}
    </svg>
  )
}
