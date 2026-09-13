/// <reference types="vite-plugin-pwa/react" />

/** Wersja aplikacji wstrzykiwana przy budowaniu (vite.config.ts). */
declare const __APP_BUILD__: { version: string; commit: string; date: string }
