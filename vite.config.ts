import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')

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
      __WORKER_URL__: JSON.stringify(env.VITE_TLDRAW_WORKER_URL),
      __DAILY_API_KEY__: JSON.stringify(env.VITE_DAILY_API_KEY),
      __STRIPE_PUBLISHABLE_KEY__: JSON.stringify(env.VITE_STRIPE_PUBLISHABLE_KEY)
    }
  }
})
