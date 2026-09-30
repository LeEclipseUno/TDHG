// Rectangular print file for a truck magnet: the WEGENKENNER.NL sign fills the whole rectangle plus bleed,
// the A-shield sits inside the cut, overlapping the white border. No marks, no crop lines (printers add their own).
// Usage: node scripts/magnet.mjs [heightCm=20] [bleedMm=3]
// Writes branding/magnet-<h>cm-bleed<b>mm[-white].pdf and a preview PNG with the cut line drawn in.
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '')
const H_CM = Number(process.argv[2] ?? 20)
const BLEED_MM = Number(process.argv[3] ?? 3)
const font = fs.readFileSync(`${ROOT}/public/fonts/BarlowCondensed-800.woff2`).toString('base64')
const css = `@font-face{font-family:'Barlow Condensed';font-weight:800;src:url(data:font/woff2;base64,${font}) format('woff2')}@page{margin:0}html,body{margin:0;background:#fff}svg{display:block}`

// Same proportions as the shaped logo without its shadow: 1303.25 x 243 units.
const X0 = 18.5, Y0 = 68.5, W = 1303.25, H = 243
const unitCm = H_CM / H
const bleed = BLEED_MM / 10 / unitCm // in units
const Wcm = +(W * unitCm).toFixed(2)

function svg(nlFill, preview) {
  const vx = X0 - bleed, vy = Y0 - bleed, vw = W + 2 * bleed, vh = H + 2 * bleed
  // Shield: nearly full size, clear of the text and well inside the cut.
  const s = 0.88
  const cx = 1190, cy = 190
  const cut = preview
    ? `<rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="none" stroke="#ff00aa" stroke-width="1.5" stroke-dasharray="8 6"/>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${(vw * unitCm).toFixed(3)}cm" height="${(vh * unitCm).toFixed(3)}cm">
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
</defs>
<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="url(#sign)"/>
<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="url(#sheen)"/>
<rect x="36" y="86" width="${W - 35}" height="208" rx="16" fill="none" stroke="#ffffff" stroke-width="8"/>
<text x="66" y="262" font-family="'Barlow Condensed'" font-weight="800" font-size="176" fill="#ffffff" textLength="992" lengthAdjust="spacingAndGlyphs">WEGENKENNER<tspan fill="${nlFill}">.NL</tspan></text>
<g transform="translate(${cx} ${cy}) rotate(-9) scale(${s})">
<rect x="-110" y="-88.6" width="220" height="189.2" rx="28.6" fill="#000" fill-opacity="0.28"/>
<rect x="-110" y="-94.6" width="220" height="189.2" rx="28.6" fill="url(#shield)" stroke="#ffffff" stroke-width="11"/>
<rect x="-90.2" y="-74.8" width="180.4" height="149.6" rx="17.16" fill="none" stroke="#ffffff" stroke-width="7.7"/>
<text x="0" y="58.652" text-anchor="middle" font-family="'Barlow Condensed'" font-weight="800" font-size="171.6" fill="#ffffff">A</text>
</g>
${cut}
</svg>`
}

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' })
const page = await browser.newPage()
const pageW = +((W + 2 * bleed) * unitCm).toFixed(3), pageH = +((H + 2 * bleed) * unitCm).toFixed(3)
for (const [suffix, fill] of [['', '#f7d117'], ['-white', '#ffffff']]) {
  const base = `${ROOT}/branding/magnet-${H_CM}cm-bleed${BLEED_MM}mm${suffix}`
  await page.setContent(`<style>${css}</style>${svg(fill, false)}`)
  await page.evaluate(() => document.fonts.ready)
  await page.pdf({ path: `${base}.pdf`, width: `${pageW}cm`, height: `${pageH}cm`, printBackground: true, pageRanges: '1' })
  const vw = Math.round((W + 2 * bleed)), vh = Math.round(H + 2 * bleed)
  const prev = svg(fill, true).replace(/width="[\d.]+cm" height="[\d.]+cm"/, `width="${vw}" height="${vh}"`)
  await page.setViewport({ width: vw, height: vh, deviceScaleFactor: 2 })
  await page.setContent(`<style>${css}</style>${prev}`)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${base}-preview.png` })
  console.log(base, { cut: `${Wcm} x ${H_CM} cm`, withBleed: `${pageW} x ${pageH} cm` })
}
await browser.close()
