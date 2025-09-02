import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')
  
  // Debug: Log what we're getting
  console.log('🔧 Vite config - Environment variables:')
  console.log('Mode:', mode)
  console.log('process.env.VITE_TLDRAW_WORKER_URL:', process.env.VITE_TLDRAW_WORKER_URL)
  console.log('env.VITE_TLDRAW_WORKER_URL:', env.VITE_TLDRAW_WORKER_URL)
  console.log('Final worker URL:', process.env.VITE_TLDRAW_WORKER_URL || env.VITE_TLDRAW_WORKER_URL)

  return {
    envPrefix: ["VITE_"],
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5173,
    },
    build: {
      sourcemap: true,
    },
    base: "/",
    publicDir: "src/public",
    resolve: {
      alias: {
        "@": "/src",
      },
    },
    define: {
      // Use process.env for production builds, fallback to .env files for development
      __WORKER_URL__: JSON.stringify(process.env.VITE_TLDRAW_WORKER_URL || env.VITE_TLDRAW_WORKER_URL),
      __DAILY_API_KEY__: JSON.stringify(process.env.VITE_DAILY_API_KEY || env.VITE_DAILY_API_KEY)
    }
  }
})
