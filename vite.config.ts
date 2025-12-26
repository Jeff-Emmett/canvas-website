import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import wasm from "vite-plugin-wasm"
import topLevelAwait from "vite-plugin-top-level-await"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')

  // Set the worker URL to localhost for local development
  process.env.VITE_TLDRAW_WORKER_URL = 'http://localhost:5172'

  return {
    envPrefix: ["VITE_"],
    plugins: [
      react(),
      wasm(),
      topLevelAwait(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        workbox: {
          // Force the service worker to take control immediately
          skipWaiting: true,
          clientsClaim: true,
          // Cache all static assets
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm}'],
          // Increase the limit for large chunks (Board is ~8MB with tldraw, automerge, etc.)
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
          // Runtime caching for dynamic requests
          runtimeCaching: [
            {
              // Cache API responses with network-first strategy
              urlPattern: /^https?:\/\/.*\/api\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24, // 24 hours
                },
                networkTimeoutSeconds: 10,
              },
            },
            {
              // Cache fonts
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
              },
            },
          ],
        },
        manifest: {
          name: 'Jeff Emmett Canvas',
          short_name: 'Canvas',
          description: 'Collaborative canvas for research and creativity',
          theme_color: '#1a1a2e',
          background_color: '#1a1a2e',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: '/pwa-192x192.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
            },
            {
              src: '/pwa-512x512.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
            },
            {
              src: '/pwa-512x512.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'maskable',
            },
          ],
        },
        devOptions: {
          // Enable SW in development for testing
          enabled: true,
          type: 'module',
        },
      }),
    ],
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      // Force IPv4 to ensure compatibility with WSL2 and remote devices
      listen: "0.0.0.0",
      // Configure HMR to use the client's hostname for WebSocket connections
      // This allows HMR to work from any network (localhost, LAN, Tailscale)
      hmr: {
        // Use 'clientPort' to let client determine the correct host
        clientPort: 5173,
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
          manualChunks(id) {
            // Core React libraries - load first
            if (id.includes('node_modules/react') ||
                id.includes('node_modules/react-dom') ||
                id.includes('node_modules/react-router')) {
              return 'react-vendor';
            }

            // tldraw core - split from shapes
            if (id.includes('node_modules/tldraw') ||
                id.includes('node_modules/@tldraw')) {
              return 'tldraw';
            }

            // Automerge - CRDT sync library
            // Note: automerge-repo-react-hooks must NOT be in this chunk as it depends on React
            if (id.includes('node_modules/@automerge') &&
                !id.includes('automerge-repo-react-hooks')) {
              return 'automerge';
            }

            // AI SDKs (lazy load)
            if (id.includes('node_modules/@anthropic-ai') ||
                id.includes('node_modules/openai') ||
                id.includes('node_modules/ai/')) {
              return 'ai-sdks';
            }

            // ML/transformers (VERY large, lazy loaded)
            if (id.includes('node_modules/@xenova')) {
              return 'ml-libs';
            }

            // Markdown editors
            if (id.includes('node_modules/@uiw/react-md-editor') ||
                id.includes('node_modules/cherry-markdown') ||
                id.includes('node_modules/marked') ||
                id.includes('node_modules/react-markdown')) {
              return 'markdown';
            }

            // CodeMirror (used by markdown editors)
            if (id.includes('node_modules/@codemirror') ||
                id.includes('node_modules/codemirror')) {
              return 'codemirror';
            }

            // Daily video chat
            if (id.includes('node_modules/@daily-co')) {
              return 'daily-video';
            }

            // html2canvas (screenshots)
            if (id.includes('node_modules/html2canvas')) {
              return 'html2canvas';
            }

            // ONNX runtime (ML inference)
            if (id.includes('node_modules/onnxruntime')) {
              return 'onnx';
            }

            // DOMPurify and sanitizers
            if (id.includes('node_modules/dompurify') ||
                id.includes('node_modules/isomorphic-dompurify')) {
              return 'sanitizers';
            }
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
