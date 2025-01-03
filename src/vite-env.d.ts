/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TLDRAW_WORKER_URL: string
  readonly VITE_GOOGLE_MAPS_API_KEY: string
  readonly VITE_DAILY_API_KEY: string
  readonly VITE_CLOUDFLARE_API_TOKEN: string
  readonly VITE_CLOUDFLARE_ACCOUNT_ID: string
  readonly VITE_CLOUDFLARE_ZONE_ID: string
  readonly VITE_R2_BUCKET_NAME: string
  readonly VITE_R2_PREVIEW_BUCKET_NAME: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
