import { useEffect, useRef } from 'react'
import type { GameData } from '../data'
import { COLORS } from './MapView'

interface Props {
  data: GameData
  /** World point to centre on for a still backdrop. Omit to drift around the country. */
  focus?: { x: number; y: number }
  /** Zoom relative to the fit of the whole country. */
  zoom?: number
}

const MIN_STEP = 0.75
const MAX_SIDE = 4096
const LEG_MS = 14000

/** Menu backdrop: the country rendered once to a bitmap at a fixed zoom, then only panned. */
export default function DriftMap({ data, focus, zoom = 2.3 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let bitmap: HTMLCanvasElement | null = null
    let scale = 1
    let dpr = 1
    let w = 1
    let h = 1
    const world = data.world
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const render = () => {
      const rect = canvas.getBoundingClientRect()
      w = Math.max(1, Math.round(rect.width))
      h = Math.max(1, Math.round(rect.height))
      dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      const fit = Math.min(w / (world.x1 - world.x0), h / (world.y1 - world.y0)) * 0.95
      scale = fit * zoom
      // Bitmap of the whole country plus a margin, capped so huge screens stay within canvas limits.
      const margin = 60000
      let bw = Math.round((world.x1 - world.x0 + 2 * margin) * scale * dpr)
      let bh = Math.round((world.y1 - world.y0 + 2 * margin) * scale * dpr)
      const cap = Math.min(1, MAX_SIDE / Math.max(bw, bh))
      bw = Math.round(bw * cap)
      bh = Math.round(bh * cap)
      const s = scale * dpr * cap
      const off = document.createElement('canvas')
      off.width = bw
      off.height = bh
      const o = off.getContext('2d')
      if (!o) return
      const X = (x: number) => (x - world.x0 + margin) * s
      const Y = (y: number) => (y - world.y0 + margin) * s
      o.fillStyle = COLORS.bg
      o.fillRect(0, 0, bw, bh)
      const fill = (polys: GameData['land'], color: string, edge: string) => {
        o.beginPath()
        for (const poly of polys) {
          for (const ring of poly.rings) {
            let lx = X(ring[0])
            let ly = Y(ring[1])
            o.moveTo(lx, ly)
            for (let i = 2; i < ring.length; i += 2) {
              const sx = X(ring[i])
              const sy = Y(ring[i + 1])
              if (Math.abs(sx - lx) + Math.abs(sy - ly) < MIN_STEP) continue
              o.lineTo(sx, sy)
              lx = sx
              ly = sy
            }
            o.closePath()
          }
        }
        o.fillStyle = color
        o.fill('evenodd')
        o.strokeStyle = edge
        o.lineWidth = 1
        o.stroke()
      }
      fill(data.abroad, COLORS.abroad, COLORS.abroadEdge)
      fill(data.land, COLORS.land, COLORS.landEdge)
      o.lineCap = 'round'
      o.lineJoin = 'round'
      for (const kind of ['N', 'A'] as const) {
        o.beginPath()
        for (const r of data.roads) {
          if (r.kind !== kind) continue
          for (const line of r.lines) {
            let lx = X(line[0])
            let ly = Y(line[1])
            o.moveTo(lx, ly)
            for (let i = 2; i < line.length; i += 2) {
              const sx = X(line[i])
              const sy = Y(line[i + 1])
              if (i !== line.length - 2 && Math.abs(sx - lx) + Math.abs(sy - ly) < MIN_STEP) continue
              o.lineTo(sx, sy)
              lx = sx
              ly = sy
            }
          }
        }
        o.strokeStyle = COLORS[kind]
        o.lineWidth = (kind === 'A' ? 2.6 : 1.6) * dpr * cap
        o.stroke()
      }
      bitmap = off
      scale = s / dpr // effective world-to-css-px scale after the cap
    }

    // Camera: world point at the centre of the screen.
    const rnd = () => ({
      x: world.x0 + (0.22 + Math.random() * 0.56) * (world.x1 - world.x0),
      y: world.y0 + (0.18 + Math.random() * 0.64) * (world.y1 - world.y0),
    })
    let from = focus ?? rnd()
    let to = focus ?? rnd()
    let t0 = performance.now()
    const ease = (p: number) => p * p * (3 - 2 * p)

    const frame = (now: number) => {
      if (!bitmap) return
      let cx = from.x
      let cy = from.y
      if (!focus && !reduced) {
        let p = (now - t0) / LEG_MS
        if (p >= 1) {
          from = to
          to = rnd()
          t0 = now
          p = 0
        }
        const e = ease(p)
        cx = from.x + (to.x - from.x) * e
        cy = from.y + (to.y - from.y) * e
      }
      const margin = 60000
      const sx = ((cx - world.x0 + margin) * scale - w / 2) * dpr
      const sy = ((cy - world.y0 + margin) * scale - h / 2) * dpr
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(bitmap, -sx, -sy)
      if (!focus && !reduced) raf = requestAnimationFrame(frame)
    }

    render()
    raf = requestAnimationFrame(frame)
    const ro = new ResizeObserver(() => {
      render()
      if (focus || reduced) raf = requestAnimationFrame(frame)
    })
    ro.observe(canvas)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [data, focus, zoom])

  return <canvas ref={canvasRef} className="drift-canvas" />
}
