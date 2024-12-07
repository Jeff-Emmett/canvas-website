import { markdownPlugin } from './build/markdownPlugin';
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    envPrefix: ['VITE_'],
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
    define: {
      'import.meta.env.VITE_TLDRAW_WORKER_URL': JSON.stringify(
        env.VITE_TLDRAW_WORKER_URL || 'https://jeffemmett-canvas.jeffemmett.workers.dev'
      )
    }
  };
});
