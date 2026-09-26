import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// base is the repo name for GitHub Pages; override with VITE_BASE for a custom domain (use '/').
const base = process.env.VITE_BASE ?? '/TDHG/'

/** After the build, list every file the service worker should precache and write it into dist/sw.js. */
function serviceWorkerAssets(): Plugin {
  return {
    name: 'tdhg-sw-assets',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve('dist')
      const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
      const built = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((u) => u.startsWith(base) && /\.(js|css)$/.test(u))
      const fonts = fs.readdirSync(path.join(dist, 'fonts')).map((f) => `${base}fonts/${f}`)
      const data = ['roads', 'links', 'land', 'abroad', 'junctions', 'exits', 'places'].map((n) => `${base}data/${n}.json`)
      const list = [base, ...built, ...data, ...fonts, `${base}logo.png`, `${base}icon-192.png`, `${base}manifest.webmanifest`]
      const swPath = path.join(dist, 'sw.js')
      const sw = fs.readFileSync(swPath, 'utf8').replace('__ASSETS__', JSON.stringify(list)).replace('__BUILD__', Date.now().toString(36))
      fs.writeFileSync(swPath, sw)
    },
  }
}

export default defineConfig(({ command }) => ({
  plugins: [react(), serviceWorkerAssets()],
  base: command === 'build' ? base : '/',
  build: { chunkSizeWarningLimit: 4000 },
}))
