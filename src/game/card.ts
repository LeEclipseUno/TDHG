// Renders the shareable result card (square or story) on an offscreen canvas.
import type { GameData } from '../data'
import { formatTime, summarize, type Session } from './session'
import { translate, type Lang } from '../i18n'
import { season, SEASON_TEXT } from './season'

export type CardFormat = 'square' | 'story'

const NAVY = '#0a1628'
const LAND = '#1b4a8d'
const ABROAD = '#15243a'
const ROAD_A = '#f6f8fc'
const ROAD_N = '#ffd23f'
const GOOD = '#34d17c'
const BAD = '#ff4d5e'
const AMBER = '#ffb000'
const ORANGE = '#ef712f'

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export async function renderCard(data: GameData, session: Session, lang: Lang, format: CardFormat, streak = 0): Promise<Blob | null> {
  const W = 1080
  const H = format === 'square' ? 1080 : 1920
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const sum = summarize(session)
  const t = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) => translate(lang, k, v)
  try {
    await document.fonts.load('800 60px Overpass')
    await document.fonts.load('700 40px "Barlow Condensed"')
  } catch {
    /* fonts may be unavailable, the fallback is fine */
  }

  // Background with a soft glow
  ctx.fillStyle = NAVY
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, H * 0.28, 40, W / 2, H * 0.28, W * 0.7)
  glow.addColorStop(0, 'rgba(60,120,220,0.45)')
  glow.addColorStop(1, 'rgba(10,22,40,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Layout: logo top, map middle, score board bottom.
  const pad = 60
  const logo = await loadImage(`${import.meta.env.BASE_URL}logo.png`)
  let y = pad
  if (logo) {
    const lw = format === 'square' ? 520 : 640
    const lh = (lw * logo.height) / logo.width
    ctx.drawImage(logo, (W - lw) / 2, y, lw, lh)
    y += lh + 30
  }
  const mapH = format === 'square' ? 470 : 820
  const mapW = W - pad * 2
  const mapY = y
  // Map: fit the country
  const wb = data.world
  const scale = Math.min(mapW / (wb.x1 - wb.x0), mapH / (wb.y1 - wb.y0)) * 0.96
  const ox = pad + (mapW - (wb.x1 - wb.x0) * scale) / 2
  const oy = mapY + (mapH - (wb.y1 - wb.y0) * scale) / 2
  const X = (x: number) => ox + (x - wb.x0) * scale
  const Y = (yy: number) => oy + (yy - wb.y0) * scale
  const fillPolys = (polys: GameData['land'], fill: string) => {
    ctx.beginPath()
    for (const poly of polys) {
      for (const ring of poly.rings) {
        ctx.moveTo(X(ring[0]), Y(ring[1]))
        for (let i = 2; i < ring.length; i += 2) ctx.lineTo(X(ring[i]), Y(ring[i + 1]))
        ctx.closePath()
      }
    }
    ctx.fillStyle = fill
    ctx.fill('evenodd')
  }
  fillPolys(data.abroad, ABROAD)
  fillPolys(data.land, LAND)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const wl of data.water) {
    if (wl.c !== 'r') continue
    ctx.beginPath()
    ctx.moveTo(X(wl.l[0]), Y(wl.l[1]))
    for (let i = 2; i < wl.l.length; i += 2) ctx.lineTo(X(wl.l[i]), Y(wl.l[i + 1]))
    ctx.strokeStyle = NAVY
    ctx.lineWidth = 2
    ctx.stroke()
  }
  ctx.lineJoin = 'round'
  const stroke = (lines: number[][], color: string, width: number) => {
    ctx.beginPath()
    for (const line of lines) {
      ctx.moveTo(X(line[0]), Y(line[1]))
      for (let i = 2; i < line.length; i += 2) ctx.lineTo(X(line[i]), Y(line[i + 1]))
    }
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.stroke()
  }
  for (const r of data.roads) if (r.kind === 'N') stroke(r.lines, ROAD_N, 2)
  for (const r of data.roads) if (r.kind === 'A') stroke(r.lines, ROAD_A, 3.5)
  // Results on the map
  for (const res of session.results) {
    const road = data.byRef.get(res.label)
    const color = res.grade === 'bad' ? BAD : GOOD
    if (road) {
      ctx.globalAlpha = 0.4
      stroke(road.lines, color, 16)
      ctx.globalAlpha = 1
      stroke(road.lines, color, 6)
    } else {
      const j = data.junctions.find((jj) => jj.name === res.label)
      if (j) {
        ctx.beginPath()
        ctx.arc(X(j.x), Y(j.y), 12, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        ctx.lineWidth = 4
        ctx.strokeStyle = '#fff'
        ctx.stroke()
      }
    }
  }
  y = mapY + mapH + 30

  // Title line
  const n = session.dailyNumber
  const title = n ? `Wegenkenner #${n}` : t(`mode_${session.mode}` as const)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#fff'
  ctx.font = '700 54px "Barlow Condensed", system-ui, sans-serif'
  ctx.fillText(title, W / 2, y)
  y += 64
  ctx.font = '600 32px "Barlow Condensed", system-ui, sans-serif'
  ctx.fillStyle = '#a7b6cc'
  const sub = [n ? t(`mode_${session.mode}` as const) : null, t(`tier_${session.tier}_short` as const), session.variant !== 'normal' ? t(`variant_${session.variant}` as const) : null].filter(Boolean).join('  ·  ')
  ctx.fillText(sub, W / 2, y)
  y += 60

  // Matrix score board
  const bw = 420
  const bh = 170
  const bx = (W - bw) / 2
  roundRect(ctx, bx, y, bw, bh, 12)
  ctx.fillStyle = '#0b0c0f'
  ctx.fill()
  ctx.strokeStyle = '#3a4252'
  ctx.lineWidth = 4
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,176,0,0.55)'
  ctx.font = '700 22px "Barlow Condensed", system-ui, sans-serif'
  ctx.fillText(t('points').toUpperCase(), W / 2, y + 18)
  ctx.fillStyle = AMBER
  ctx.shadowColor = 'rgba(255,176,0,0.6)'
  ctx.shadowBlur = 24
  ctx.font = '800 108px "Barlow Condensed", system-ui, sans-serif'
  ctx.fillText(String(sum.score), W / 2, y + 40)
  ctx.shadowBlur = 0
  y += bh + 26

  // Marks row
  const marks = session.results.map((r) => (r.grade === 'good' ? GOOD : r.grade === 'partial' ? AMBER : BAD))
  const mw = 52
  const gap = 12
  const totalW = marks.length * mw + (marks.length - 1) * gap
  let mx = (W - totalW) / 2
  for (const c of marks) {
    roundRect(ctx, mx, y, mw, 22, 5)
    ctx.fillStyle = c
    ctx.fill()
    mx += mw + gap
  }
  y += 48
  ctx.fillStyle = '#fff'
  ctx.font = '700 40px "Barlow Condensed", system-ui, sans-serif'
  const line = `${sum.good}${sum.partial ? `+${sum.partial}` : ''}/${sum.total}   ·   ${formatTime(sum.ms)}${streak > 1 ? `   ·   ${t('streak')} ${streak}` : ''}`
  ctx.fillText(line, W / 2, y)
  y += 60

  const s = season()
  if (s) {
    ctx.fillStyle = ORANGE
    ctx.font = '700 34px "Barlow Condensed", system-ui, sans-serif'
    ctx.fillText(SEASON_TEXT[s][lang], W / 2, y)
    y += 50
  }

  // URL
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = '#a7b6cc'
  ctx.font = '600 36px "Barlow Condensed", system-ui, sans-serif'
  ctx.fillText('wegenkenner.nl', W / 2, H - pad)

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
}

/** Share the card through the system share sheet when files are supported, otherwise download it. */
export async function shareCard(blob: Blob, filename: string, text: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text })
      return 'shared'
    } catch {
      /* cancelled: fall through to download */
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'downloaded'
}
