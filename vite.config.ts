import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base is set to the repo name for GitHub Pages; override with VITE_BASE for other hosts.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? (process.env.VITE_BASE ?? '/TDHG/') : '/',
  build: { chunkSizeWarningLimit: 4000 },
}))
