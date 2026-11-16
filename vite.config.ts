import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * PWA: stamps public/sw.js (copied to dist/sw.js) with a unique build id and
 * the list of hashed JS/CSS files from this build, so the service worker can
 * precache them and the browser sees a new worker on every deploy.
 * No extra dependency needed.
 */
function pwaServiceWorker(): Plugin {
  let outDir = 'dist'
  let files: string[] = []
  return {
    name: 'pwa-sw',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    generateBundle(_options, bundle) {
      files = Object.keys(bundle)
        .filter(f => /\.(js|css)$/.test(f))
        // recharts is big and only needed on Reports: let it cache on first use.
        .filter(f => !/charts-/.test(f))
        .map(f => '/' + f)
    },
    closeBundle() {
      const swPath = resolve(outDir, 'sw.js')
      if (!existsSync(swPath)) return
      const buildId = Date.now().toString(36)
      const src = readFileSync(swPath, 'utf8')
        .replace("'__BUILD_ID__'", `'${buildId}'`)
        .replace('/* __PRECACHE__ */ []', JSON.stringify(files))
      writeFileSync(swPath, src)
    }
  }
}

export default defineConfig({
  plugins: [react(), pwaServiceWorker()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // Function form works on every Vite version (the object form fails on Vite 8).
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) return 'charts'
          if (id.includes('@supabase')) return 'supabase'
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'vendor'
          return undefined
        }
      }
    }
  }
})
