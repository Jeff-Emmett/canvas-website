import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import wasm from "vite-plugin-wasm"
import topLevelAwait from "vite-plugin-top-level-await"

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')
  
  // Debug: Log what we're getting
  console.log('🔧 Vite config - Environment variables:')
  console.log('Mode:', mode)
  console.log('WSL2_IP from env:', process.env.WSL2_IP)
  console.log('process.env.VITE_TLDRAW_WORKER_URL:', process.env.VITE_TLDRAW_WORKER_URL)
  console.log('env.VITE_TLDRAW_WORKER_URL:', env.VITE_TLDRAW_WORKER_URL)

  // Get the WSL2 IP for HMR configuration
  const wslIp = process.env.WSL2_IP || '172.22.168.84'
  
  // Set the worker URL to localhost for local development
  const workerUrl = 'http://localhost:5172'
  process.env.VITE_TLDRAW_WORKER_URL = workerUrl
  console.log('🌐 Setting worker URL to:', workerUrl)

  return {
    envPrefix: ["VITE_"],
    plugins: [react(), wasm(), topLevelAwait()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      // Force IPv4 to ensure compatibility with WSL2 and remote devices
      listen: "0.0.0.0",
      // Configure HMR to use the correct hostname for WebSocket connections
      hmr: {
        host: wslIp,
        port: 5173,
      },
      // Proxy API requests to the worker server
      proxy: {
        '/api': {
          target: 'http://localhost:5172',
          changeOrigin: true,
        },
      },
    },
    build: {
      sourcemap: false, // Disable sourcemaps in production to reduce bundle size
      rollupOptions: {
        output: {
          // Manual chunk splitting for large libraries to improve load times
          manualChunks: {
            // Core React libraries
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],

            // tldraw - large drawing library (split into separate chunk)
            'tldraw': ['tldraw', '@tldraw/tldraw', '@tldraw/tlschema'],

            // Automerge - CRDT sync library
            'automerge': [
              '@automerge/automerge',
              '@automerge/automerge-repo',
              '@automerge/automerge-repo-react-hooks'
            ],

            // AI SDKs (lazy load)
            'ai-sdks': ['@anthropic-ai/sdk', 'openai', 'ai'],

            // ML/transformers (VERY large, lazy loaded)
            'ml-libs': ['@xenova/transformers'],

            // Markdown editors
            'markdown': ['@uiw/react-md-editor', 'cherry-markdown', 'marked', 'react-markdown'],

            // Large P2P utilities
            'large-utils': ['gun', 'webnative', 'holosphere'],
          },
        },
      },
      chunkSizeWarningLimit: 1000, // Warn on chunks larger than 1MB
    },
    base: "/",
    publicDir: "src/public",
    resolve: {
      alias: {
        "@": "/src",
      },
    },
    define: {
      // Worker URL is now handled dynamically in Board.tsx based on window.location.hostname
      // This ensures remote devices connect to the correct worker IP
      __DAILY_API_KEY__: JSON.stringify(process.env.VITE_DAILY_API_KEY || env.VITE_DAILY_API_KEY)
    },
    optimizeDeps: {
      include: [
        '@xenova/transformers',
        '@xterm/xterm',
        '@xterm/addon-fit'
      ],
      exclude: [
        // Exclude problematic modules from pre-bundling
      ]
    },
    assetsInclude: [
      // Include WebAssembly files
      '**/*.wasm',
      '**/*.onnx',
      '**/*.bin'
    ]
  }
})
