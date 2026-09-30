// Renders branding/logo-nl.svg and .png: the v2 logo with ".NL" after WEGENKENNER, the sign stretched to fit.
// Usage: node scripts/logo-nl.mjs [yellow|white], then trim the transparent edge (the PNGs in branding/ are trimmed).
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '')
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const font = fs.readFileSync(`${ROOT}/public/fonts/BarlowCondensed-800.woff2`).toString('base64')
const variant = process.argv[2] ?? 'yellow' // yellow | white
const NL_FILL = variant === 'white' ? '#ffffff' : '#f7d117'

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-first-run'] })
const page = await browser.newPage()
const fontCss = `@font-face{font-family:'Barlow Condensed';font-weight:800;src:url(data:font/woff2;base64,${font}) format('woff2')}`

// Measure natural widths so ".NL" gets the same horizontal squeeze as the word.
await page.setContent(`<style>${fontCss}</style><svg xmlns="http://www.w3.org/2000/svg" width="2000" height="400">
<text id="a" x="0" y="200" font-family="'Barlow Condensed'" font-weight="800" font-size="176">WEGENKENNER</text>
<text id="b" x="0" y="300" font-family="'Barlow Condensed'" font-weight="800" font-size="176">WEGENKENNER.NL</text></svg>`)
await page.evaluate(() => document.fonts.ready)
const [wa, wb] = await page.evaluate(() => ['a', 'b'].map((id) => document.getElementById(id).getComputedTextLength()))
const squeeze = 815 / wa
const textLen = Math.round(wb * squeeze)
const extra = textLen - 815
const signW = 1080 + extra
const shieldX = 1020 + extra
const W = 1200 + extra
console.log({ wa, wb, squeeze, textLen, signW, W })

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 380" width="${W}" height="380">
<defs>
<linearGradient id="sign" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#1e6be0"/>
  <stop offset="0.55" stop-color="#0d4a9c"/>
  <stop offset="1" stop-color="#093a80"/>
</linearGradient>
<linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0.35" stop-color="#ffffff" stop-opacity="0"/>
  <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.10"/>
  <stop offset="0.65" stop-color="#ffffff" stop-opacity="0"/>
</linearGradient>
<linearGradient id="shield" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#e0332b"/>
  <stop offset="1" stop-color="#b80d26"/>
</linearGradient>
<filter id="drop" x="-20%" y="-20%" width="140%" height="140%">
  <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity="0.35"/>
</filter></defs>
<g filter="url(#drop)">
<rect x="20" y="70" width="${signW}" height="240" rx="26" fill="url(#sign)"/>
<rect x="20" y="70" width="${signW}" height="240" rx="26" fill="url(#sheen)"/>
<rect x="20" y="70" width="${signW}" height="240" rx="26" fill="none" stroke="#062a5e" stroke-width="3"/>
<rect x="36" y="86" width="${signW - 32}" height="208" rx="16" fill="none" stroke="#ffffff" stroke-width="8"/>
</g>
<text x="66" y="262" font-family="'Barlow Condensed'" font-weight="800" font-size="176" fill="#ffffff" textLength="${textLen}" lengthAdjust="spacingAndGlyphs">WEGENKENNER<tspan fill="${NL_FILL}">.NL</tspan></text>
<g transform="translate(${shieldX} 190) rotate(-9)" filter="url(#drop)"><g>
<rect x="-110" y="-94.6" width="220" height="189.2" rx="28.6" fill="url(#shield)" stroke="#ffffff" stroke-width="11"/>
<rect x="-90.2" y="-74.8" width="180.4" height="149.6" rx="17.16" fill="none" stroke="#ffffff" stroke-width="7.7"/>
<text x="0" y="58.652" text-anchor="middle" font-family="'Barlow Condensed'" font-weight="800" font-size="171.6" fill="#ffffff">A</text>
</g></g>
</svg>`
const suffix = variant === 'white' ? '-white' : ''
fs.writeFileSync(`${ROOT}/branding/logo-nl${suffix}.svg`, svg + '\n')

await page.setViewport({ width: W, height: 380, deviceScaleFactor: 2 })
await page.setContent(`<style>${fontCss}html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`)
await page.evaluate(() => document.fonts.ready)
await new Promise((r) => setTimeout(r, 300))
await page.screenshot({ path: `${ROOT}/branding/logo-nl${suffix}-raw.png`, omitBackground: true })
await browser.close()
