import type { TrackPoint } from '../types'
import { PEAKS } from '../data/peaks'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Ślad wycieczki + wszystkie 20 szczytów jako waypointy. */
export function buildGpx(points: TrackPoint[], name: string): string {
  const wpts = PEAKS.map(
    (p) =>
      `  <wpt lat="${p.lat}" lon="${p.lon}"><ele>${p.ele}</ele><name>${esc(p.name)}</name><sym>Summit</sym></wpt>`,
  ).join('\n')

  const trkpts = points
    .map(
      (pt) =>
        `      <trkpt lat="${pt.lat}" lon="${pt.lon}">${
          pt.ele != null ? `<ele>${pt.ele.toFixed(1)}</ele>` : ''
        }<time>${new Date(pt.t).toISOString()}</time></trkpt>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Korona Gór Brennej" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(name)}</name><time>${new Date().toISOString()}</time></metadata>
${wpts}
${
  points.length
    ? `  <trk><name>${esc(name)}</name><trkseg>\n${trkpts}\n    </trkseg></trk>`
    : ''
}
</gpx>`
}
