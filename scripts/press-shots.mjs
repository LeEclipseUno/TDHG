// Phone-size screenshots for the press kit, from the built site (vite preview on 4173).
// Usage: node scripts/press-shots.mjs   (needs Google Chrome installed)
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.SHOTS_BASE ?? 'http://localhost:4173'
const OUT = 'public/press'
const SHOTS = [
  ['home', '/?press=1', '.modes-board'],
  ['find', '/?press=1#find', '.game canvas'],
  ['quiz', '/?press=1#quiz', '.options'],
  ['drag', '/?press=1#drag', '.game canvas'],
]
fs.mkdirSync(OUT, { recursive: true })
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--lang=nl', '--no-first-run'] })
const page = await browser.newPage()
await page.setExtraHTTPHeaders({ 'Accept-Language': 'nl-NL,nl' })
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
for (const [name, path, waitFor] of SHOTS) {
  await page.goto(BASE + path, { waitUntil: 'networkidle0', timeout: 60000 })
  await page.waitForSelector(waitFor, { timeout: 30000 })
  await new Promise((r) => setTimeout(r, 2500))
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('wrote', name)
}
await browser.close()
