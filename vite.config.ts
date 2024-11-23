import { markdownPlugin } from './build/markdownPlugin';
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    define: {
      'process.env.TLDRAW_WORKER_URL': JSON.stringify('https://jeffemmett-canvas.jeffemmett.workers.dev'),
      'process.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_CLIENT_ID),
      'process.env.VITE_GOOGLE_API_KEY': JSON.stringify(env.VITE_GOOGLE_API_KEY)
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
    build: {
      sourcemap: true,
    },
    base: '/',
    publicDir: 'src/public',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      },
    },
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        'Cross-Origin-Embedder-Policy': 'require-corp'
      }
    },
  }
});
