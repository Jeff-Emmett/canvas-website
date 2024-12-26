// the contents of the environment should mostly be determined by wrangler.toml. These entries match
// the bindings defined there.
/// <reference types="@cloudflare/workers-types" />

export interface Environment {
  TLDRAW_BUCKET: R2Bucket
  TLDRAW_DURABLE_OBJECT: DurableObjectNamespace
  DAILY_API_KEY: string
  VITE_DAILY_API_KEY: string
  VITE_DAILY_DOMAIN: string
  VITE_GOOGLE_CLIENT_ID: string
  VITE_GOOGLE_MAPS_API_KEY: string
}
