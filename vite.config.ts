import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
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
      // The shell: html, js, css, fonts, logo. Small, precached, keyed by build.
      const list = [base, ...built, ...fonts, `${base}logo.png`, `${base}icon-192.png`, `${base}manifest.webmanifest`]
      // Map data is cached as the game asks for it, in a cache keyed by the data's own content, so a deploy
      // that only changes code keeps every player's map on disk.
      const dataDir = path.join(dist, 'data')
      const hash = createHash('md5')
      for (const f of fs.readdirSync(dataDir).sort()) hash.update(fs.readFileSync(path.join(dataDir, f)))
      // The worker's source lives outside public/, so Vite's own copy of public/ can never overwrite the filled-in file.
      const swPath = path.join(dist, 'sw.js')
      const sw = fs
        .readFileSync(path.resolve('scripts/sw.template.js'), 'utf8')
        .replaceAll('__ASSETS__', JSON.stringify(list))
        .replaceAll('__BUILD__', Date.now().toString(36))
        .replaceAll('__DATA__', hash.digest('hex').slice(0, 10))
      fs.writeFileSync(swPath, sw)
    },
  }
}

export default defineConfig(({ command, mode }) => ({
  plugins: [react(), serviceWorkerAssets(loadEnv(mode, process.cwd(), 'VITE_').VITE_ADSENSE_CLIENT ?? '')],
  base: command === 'build' ? base : '/',
  build: { chunkSizeWarningLimit: 4000 },
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16)) },
}))
