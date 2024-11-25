import { markdownPlugin } from './build/markdownPlugin';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  define: {
    'process.env.TLDRAW_WORKER_URL': JSON.stringify(process.env.TLDRAW_WORKER_URL || 'https://jeffemmett-canvas.jeffemmett.workers.dev')
  },
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
    markdownPlugin,
    viteStaticCopy({
      targets: [
        {
          src: 'src/posts/',
          dest: '.'
        }
      ]
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    sourcemap: true,
  },
  base: '/',
  publicDir: 'src/public',
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
