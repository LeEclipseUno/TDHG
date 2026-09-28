import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts.css'
import './styles.css'
import App from './App'
import { setRandomFavicon } from './game/favicon'
import { installErrorLog } from './game/errors'

installErrorLog()

// ?press=1: no animations, for still captures of the screens.
if (new URLSearchParams(location.search).has('press')) document.documentElement.classList.add('no-anim')

setRandomFavicon()

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
  // A new version takes over as soon as it is installed: reload once so nobody sees a stale mix.
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !navigator.serviceWorker.controller) return
    reloading = true
    location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
