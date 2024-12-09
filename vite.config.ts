import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
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
    "import.meta.env.VITE_WORKER_URL": JSON.stringify(
      process.env.VITE_WORKER_URL,
    ),
    "import.meta.env.VITE_DAILY_DOMAIN": JSON.stringify(
      "https://pc-bcedd8ead7044c64902f3c18973485b4.daily.co",
    ),
    "import.meta.env.VITE_DAILY_API_KEY": JSON.stringify(
      process.env.VITE_DAILY_API_KEY,
    ),
  },
})
