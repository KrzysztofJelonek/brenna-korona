import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/** Wersja pokazywana w aplikacji: numer z package.json oraz skrót i data ostatniego commita. */
function buildInfo() {
  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    version: string
  }
  const git = (args: string) => {
    try {
      return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    } catch {
      return ''
    }
  }
  return {
    version,
    commit: git('rev-parse --short HEAD'),
    // Data commita, nie budowania — ten sam kod ma zawsze tę samą datę, niezależnie od chwili deployu.
    date: git('log -1 --format=%cI') || new Date().toISOString(),
  }
}

export default defineConfig({
  base: './',
  define: {
    __APP_BUILD__: JSON.stringify(buildInfo()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Nowy service worker czeka na zgodę aplikacji (src/lib/useAppUpdate.ts) — samo przejęcie
      // w trakcie pracy potrafi przeładować stronę w środku nagrywania albo zgubić leniwe moduły.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Korona Gór Brennej',
        lang: 'pl',
        short_name: 'Korona Brennej',
        description: 'Pomocnik uczestnika wyzwania Korona Gór Brennej 2026',
        theme_color: '#226b31',
        background_color: '#f3f9ef',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: [
          {
            // Zdjęcia szczytów nie idą do precache (kilka MB) — zapisują się przy pierwszym obejrzeniu.
            urlPattern: /\/peaks\/[^/]+\.webp$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'peak-photos',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          map: ['leaflet', 'react-leaflet'],
        },
      },
    },
  },
})
