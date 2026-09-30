// Truck magnet with the shaped logo on a white rectangle: the A-shield hangs over the sign and gets a dark outline,
// so its white rim still reads on a white magnet. White margin all round, bleed outside the cut, no marks.
// Usage: node scripts/magnet-shaped.mjs [heightCm=20] [marginMm=5] [bleedMm=3]
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '')
const H_CM = Number(process.argv[2] ?? 20)
const MARGIN_MM = Number(process.argv[3] ?? 5)
const BLEED_MM = Number(process.argv[4] ?? 3)
const OUTLINE = 4 // units of dark edge outside the shield's white rim (the sign's own edge is 1.5 outside)
const font = fs.readFileSync(`${ROOT}/public/fonts/BarlowCondensed-800.woff2`).toString('base64')
const css = `@font-face{font-family:'Barlow Condensed';font-weight:800;src:url(data:font/woff2;base64,${font}) format('woff2')}@page{margin:0}html,body{margin:0;background:transparent}svg{display:block}`

function art(nlFill) {
  return `<defs>
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
</defs>
<rect x="20" y="70" width="1257" height="240" rx="26" fill="url(#sign)"/>
<rect x="20" y="70" width="1257" height="240" rx="26" fill="url(#sheen)"/>
<rect x="20" y="70" width="1257" height="240" rx="26" fill="none" stroke="#062a5e" stroke-width="3"/>
<rect x="36" y="86" width="1225" height="208" rx="16" fill="none" stroke="#ffffff" stroke-width="8"/>
<text x="66" y="262" font-family="'Barlow Condensed'" font-weight="800" font-size="176" fill="#ffffff" textLength="992" lengthAdjust="spacingAndGlyphs">WEGENKENNER<tspan fill="${nlFill}">.NL</tspan></text>
<g transform="translate(1197 190) rotate(-9)">
<rect x="-110" y="-94.6" width="220" height="189.2" rx="28.6" fill="#062a5e" stroke="#062a5e" stroke-width="${11 + 2 * OUTLINE}"/>
<rect x="-110" y="-94.6" width="220" height="189.2" rx="28.6" fill="url(#shield)" stroke="#ffffff" stroke-width="11"/>
<rect x="-90.2" y="-74.8" width="180.4" height="149.6" rx="17.16" fill="none" stroke="#ffffff" stroke-width="7.7"/>
<text x="0" y="58.652" text-anchor="middle" font-family="'Barlow Condensed'" font-weight="800" font-size="171.6" fill="#ffffff">A</text>
</g>`
}

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' })
const page = await browser.newPage()

// Measure the drawn edge of the artwork once (both variants share it).
await page.setViewport({ width: 1500, height: 400, deviceScaleFactor: 8 })
await page.setContent(`<style>${css}</style><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 400" width="1500" height="400">${art('#fff')}</svg>`)
await page.evaluate(() => document.fonts.ready)
const shot = await page.screenshot({ omitBackground: true, encoding: 'base64' })
const [x0, y0, x1, y1] = await page.evaluate(async (src) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode()
  const c = new OffscreenCanvas(img.width, img.height); const g = c.getContext('2d'); g.drawImage(img, 0, 0)
  const d = g.getImageData(0, 0, img.width, img.height).data
  let a = 1e9, b = 1e9, e = -1, f = -1
  for (let y = 0; y < img.height; y++) for (let i = 0; i < img.width; i++) if (d[(y * img.width + i) * 4 + 3] > 8) { if (i < a) a = i; if (i > e) e = i; if (y < b) b = y; if (y > f) f = y }
  return [a / 8, b / 8, (e + 1) / 8, (f + 1) / 8]
}, shot)
const artW = x1 - x0, artH = y1 - y0

// Magnet height is fixed; the logo fills it minus the margin, the width follows.
const unitMm = (H_CM * 10 - 2 * MARGIN_MM) / artH
const m = MARGIN_MM / unitMm, bl = BLEED_MM / unitMm
const cutW = artW + 2 * m, cutH = artH + 2 * m
const vx = x0 - m - bl, vy = y0 - m - bl, vw = cutW + 2 * bl, vh = cutH + 2 * bl
const mm = (u) => +(u * unitMm).toFixed(1)
console.log({ cut: `${mm(cutW)} x ${mm(cutH)} mm`, withBleed: `${mm(vw)} x ${mm(vh)} mm`, logo: `${mm(artW)} x ${mm(artH)} mm` })

for (const [suffix, fill] of [['-white', '#ffffff'], ['', '#f7d117']]) {
  const base = `${ROOT}/branding/magnet-shaped-${H_CM}cm${suffix}`
  const body = (cut) => `<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="#ffffff"/>${art(fill)}${
    cut ? `<rect x="${x0 - m}" y="${y0 - m}" width="${cutW}" height="${cutH}" fill="none" stroke="#ff00aa" stroke-width="1.5" stroke-dasharray="8 6"/>` : ''}`
  const Wmm = mm(vw), Hmm = mm(vh)
  await page.setContent(`<style>${css}</style><svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${Wmm}mm" height="${Hmm}mm">${body(false)}</svg>`)
  await page.evaluate(() => document.fonts.ready)
  await page.pdf({ path: `${base}.pdf`, width: `${Wmm}mm`, height: `${Hmm}mm`, printBackground: true, pageRanges: '1' })
  const pw = Math.round(vw), ph = Math.round(vh)
  await page.setViewport({ width: pw, height: ph, deviceScaleFactor: 2 })
  await page.setContent(`<style>${css}html,body{background:#ddd}</style><svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${pw}" height="${ph}">${body(true)}</svg>`)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${base}-preview.png` })
}
await browser.close()
