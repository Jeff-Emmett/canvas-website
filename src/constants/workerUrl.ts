// Environment-based worker URL configuration
// You can easily switch between environments by changing the WORKER_ENV variable

// Available environments:
// - 'local': Use local worker running on port 5172 (for local development)
// - 'dev': Use Cloudflare dev worker (jeffemmett-canvas-automerge-dev)
// - 'staging': Use Cloudflare dev worker (same as dev, for Netcup staging)
// - 'production': Use production worker (jeffemmett-canvas)

const WORKER_ENV = import.meta.env.VITE_WORKER_ENV || 'production' // Default to production

const WORKER_URLS = {
  local: `http://${window.location.hostname}:5172`,
  dev: "https://jeffemmett-canvas-automerge-dev.jeffemmett.workers.dev",
  staging: "https://jeffemmett-canvas-automerge-dev.jeffemmett.workers.dev",
  production: "https://jeffemmett-canvas.jeffemmett.workers.dev"
}

// Main worker URL - automatically switches based on environment
export const WORKER_URL = WORKER_URLS[WORKER_ENV as keyof typeof WORKER_URLS] || WORKER_URLS.dev

// Legacy support for existing code
export const LOCAL_WORKER_URL = WORKER_URLS.local

// Helper function to get current environment info
export const getWorkerInfo = () => ({
  environment: WORKER_ENV,
  url: WORKER_URL,
  isLocal: WORKER_ENV === 'local',
  isDev: WORKER_ENV === 'dev',
  isStaging: WORKER_ENV === 'staging',
  isProduction: WORKER_ENV === 'production'
})

// Log current environment on import (for debugging)
