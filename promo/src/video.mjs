/**
 * Skleja klatki z promo/build/frames z podkładem muzycznym w gotową rolkę (9:16, h.264).
 * Klatki: `npm run frames`. Ścieżka audio zostaje poza repo (promo/audio/ jest w .gitignore).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ffmpeg from 'ffmpeg-static'

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url))
const FRAMES = here('../build/frames')
const AUDIO = process.env.PROMO_AUDIO ?? here('../audio/Góry w Rytmie.mp3')
const OUT = here('../korona-apka.mp4')

if (!existsSync(FRAMES) || readdirSync(FRAMES).length === 0) {
  console.error('Brak klatek w promo/build/frames — najpierw `npm run frames`.')
  process.exit(1)
}
if (!existsSync(AUDIO)) {
  console.error(`Brak podkładu: ${AUDIO}`)
  process.exit(1)
}

// Wyciszenie obrazu i dźwięku na ostatnich 0,4 s — ścieżka urywa się w 21,24 s.
const FADE_AT = 20.84
const args = [
  '-v', 'error', '-y',
  '-framerate', '30', '-i', `${FRAMES}/f%04d.jpg`,
  '-i', AUDIO,
  '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'slow',
  '-vf', `fade=t=out:st=${FADE_AT}:d=0.4`,
  '-af', `afade=t=out:st=${FADE_AT}:d=0.4`,
  '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest',
  OUT,
]
const r = spawnSync(ffmpeg, args, { stdio: 'inherit' })
process.exit(r.status ?? 1)
