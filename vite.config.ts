import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { buildRoadPages } from './scripts/road-pages.mjs'

// The site lives at the root of wegenkenner.nl. Set VITE_BASE=/TDHG/ to build for a plain GitHub Pages project URL instead.
const base = process.env.VITE_BASE ?? '/'

/** After the build, list every file the service worker should precache and write it into dist/sw.js. */
function serviceWorkerAssets(adsClient: string): Plugin {
  return {
    name: 'tdhg-sw-assets',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve('dist')
      buildRoadPages(dist)
      // AdSense ownership file, from the client id in .env.production (ca-pub-123 -> pub-123).
      const pub = adsClient.replace(/^ca-/, '')
      if (pub) fs.writeFileSync(path.join(dist, 'ads.txt'), `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`)
      const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
      const built = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((u) => u.startsWith(base) && /\.(js|css)$/.test(u))
      const fonts = fs.readdirSync(path.join(dist, 'fonts')).map((f) => `${base}fonts/${f}`)
      const data = ['roads-core', 'roads-extra', 'links', 'structures', 'minor', 'water', 'provinces', 'land', 'abroad', 'junctions', 'exits', 'places', 'daily'].map((n) => `${base}data/${n}.json`)
      const list = [base, ...built, ...data, ...fonts, `${base}logo.png`, `${base}icon-192.png`, `${base}manifest.webmanifest`]
      const swPath = path.join(dist, 'sw.js')
      const sw = fs.readFileSync(swPath, 'utf8').replace('__ASSETS__', JSON.stringify(list)).replace('__BUILD__', Date.now().toString(36))
      fs.writeFileSync(swPath, sw)
    },
  }
}

export default defineConfig(({ command, mode }) => ({
  plugins: [react(), serviceWorkerAssets(loadEnv(mode, process.cwd(), 'VITE_').VITE_ADSENSE_CLIENT ?? '')],
  base: command === 'build' ? base : '/',
  build: { chunkSizeWarningLimit: 4000 },
}))
