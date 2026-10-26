import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import fs from 'node:fs'

/** Stamp the service worker with a build id so each release gets fresh caches and old ones are removed. */
const stampServiceWorker = () => ({
  name: 'stamp-service-worker',
  apply: 'build' as const,
  closeBundle() {
    const file = path.resolve('dist/web/sw.js')
    if (fs.existsSync(file)) fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('__BUILD_ID__', Date.now().toString(36)))
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), stampServiceWorker()],
  root: '.',
  publicDir: 'public',
  resolve: {
    alias: { '@shared': path.resolve('src/shared'), '@': path.resolve('src/web') }
  },
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (/recharts|d3-|victory/.test(id)) return 'charts'
          if (/react-dom|react-router|@tanstack|scheduler|\/react\//.test(id)) return 'vendor'
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: false
      }
    }
  }
})