/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TLDRAW_WORKER_URL: string
  readonly VITE_GOOGLE_MAPS_API_KEY: string
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_DAILY_DOMAIN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
