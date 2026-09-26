import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { tierIncludes, type Bounds, type GameData, type Road, type RoadKind, type Tier } from '../data'
import { IconFit, IconMinus, IconPlus } from '../ui/icons'

/** setPointerCapture can throw when the pointer is already gone (synthetic or cancelled events). */
function capture(el: Element, pointerId: number) {
  try {
    el.setPointerCapture(pointerId)
  } catch {
    /* ignore */
  }
}

export type Highlight = 'correct' | 'wrong' | 'active'
export type ShieldState = 'correct' | 'wrong' | 'neutral'
export interface PlacedShield {
  ref: string
  x: number
  y: number
  state: ShieldState
  /** Timestamp of placement; the sign pops in during the first 450 ms. */
  born?: number
}
export interface Marker {
  x: number
  y: number
  kind: 'guess' | 'answer'
  label?: string
}
/** Expanding ring, for example where a sign lands. */
export interface Pulse {
  x: number
  y: number
  t0: number
  color?: string
}
export interface MapLine {
  x0: number
  y0: number
  x1: number
  y1: number
  /** When set, the line draws itself over 700 ms starting at t0. */
  t0?: number
}
export interface View {
  cx: number
  cy: number
  scale: number
}
export interface TapInfo {
  x: number
  y: number
  sx: number
  sy: number
  scale: number
}

export interface MapViewProps {
  data: GameData
  tier: Tier
  highlights?: Record<string, Highlight>
  shields?: PlacedShield[]
  markers?: Marker[]
  lines?: MapLine[]
  pulses?: Pulse[]
  showJunctions?: boolean
  /** Fly in from a closer view when the map first appears. */
  intro?: boolean
  /** Slowly wander over the country (home screen backdrop). */
  drift?: boolean
  /** false: no gestures, buttons or scale bar (results mini map). */
  interactive?: boolean
  palette?: 'dark' | 'light'
  className?: string
  onTap?: (tap: TapInfo) => void
  children?: ReactNode
}

export interface MapHandle {
  flyToBounds(b: Bounds, paddingPx?: number): void
  flyToPoint(x: number, y: number, scale?: number): void
  zoomBy(factor: number): void
  reset(): void
  screenToWorld(sx: number, sy: number): { x: number; y: number }
  getView(): View
  getElement(): HTMLDivElement | null
}

const MAX_SCALE = 5
const MIN_STEP = 0.75
const POP_MS = 450
const PULSE_MS = 700
const LINE_MS = 700
export const COLORS = {
  bg: '#091b2c',
  land: '#1b4a8d',
  landEdge: '#2f6fd0',
  abroad: '#15243a',
  abroadEdge: '#22344d',
  A: '#f6f8fc',
  N: '#ffd23f',
  P: '#8aa4c8',
  correct: '#34d17c',
  wrong: '#ff4d5e',
  active: '#ef712f',
}
/** Light palette for the menu backdrop: paper map in the brand colours. */
export const LIGHT: typeof COLORS = {
  bg: '#f3f5f9',
  land: '#dbe5f1',
  landEdge: '#b7c8dd',
  abroad: '#e9edf3',
  abroadEdge: '#d9e0ea',
  A: '#091b2c',
  N: '#ef712f',
  P: '#9fb1c8',
  correct: '#34d17c',
  wrong: '#ff4d5e',
  active: '#ef712f',
}

const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3)
const easeOutBack = (p: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2)
}
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export function drawShield(ctx: CanvasRenderingContext2D, ref: string, kind: RoadKind, x: number, y: number, state: ShieldState, scale = 1) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.font = '800 13px Overpass, "Barlow Condensed", system-ui, sans-serif'
  const tw = ctx.measureText(ref).width
  const bw = tw + 14
  const bh = 22
  const bx = -bw / 2
  const by = -bh / 2
  ctx.shadowColor = 'rgba(0,0,0,.5)'
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 2
  roundRect(ctx, bx, by, bw, bh, 4)
  ctx.fillStyle = kind === 'A' ? '#c8102e' : '#f7d117'
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  if (kind === 'A') {
    roundRect(ctx, bx + 2, by + 2, bw - 4, bh - 4, 3)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.2
    ctx.stroke()
  }
  if (state !== 'neutral') {
    roundRect(ctx, bx - 2, by - 2, bw + 4, bh + 4, 6)
    ctx.strokeStyle = state === 'correct' ? COLORS.correct : COLORS.wrong
    ctx.lineWidth = 2.5
    ctx.stroke()
  }
  ctx.fillStyle = kind === 'A' ? '#fff' : '#111'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(ref, 0, 1)
  ctx.restore()
}

function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, m: Marker) {
  const color = m.kind === 'answer' ? COLORS.correct : COLORS.active
  ctx.beginPath()
  ctx.arc(x, y, 14, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.globalAlpha = 0.25
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.arc(x, y, 7, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2
  ctx.stroke()
  if (m.label) {
    ctx.font = '700 12px "Barlow Condensed", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.lineWidth = 4
    ctx.strokeStyle = COLORS.bg
    ctx.strokeText(m.label, x, y + 12)
    ctx.fillStyle = '#fff'
    ctx.fillText(m.label, x, y + 12)
  }
}

function drawScaleBar(ctx: CanvasRenderingContext2D, h: number, scale: number) {
  const target = 90 / scale
  const steps = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000]
  let m = steps[0]
  for (const s of steps) if (s <= target) m = s
  const px = m * scale
  const x = 12
  const y = h - 12
  ctx.strokeStyle = 'rgba(255,255,255,.85)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + px, y)
  ctx.moveTo(x, y - 5)
  ctx.lineTo(x, y)
  ctx.moveTo(x + px, y - 5)
  ctx.lineTo(x + px, y)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,.85)'
  ctx.font = '11px Barlow, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillText(m >= 1000 ? m / 1000 + ' km' : m + ' m', x, y - 3)
}

const MapView = forwardRef<MapHandle, MapViewProps>(function MapView(props, ref) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef(props)
  propsRef.current = props
  const sizeRef = useRef({ w: 1, h: 1 })
  const viewRef = useRef<View>({ cx: 0, cy: 0, scale: 1 })
  const minScaleRef = useRef(0.001)
  const initRef = useRef(false)
  const pendingRef = useRef<View | null>(null)
  const rafRef = useRef(0)
  const animRef = useRef<{ from: View; to: View; t0: number; ms: number; onDone?: () => void } | null>(null)
  const driftTimer = useRef(0)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const panRef = useRef<{ x: number; y: number; view: View } | null>(null)
  const pinchRef = useRef<{ d0: number; view0: View; wx: number; wy: number } | null>(null)
  const tapRef = useRef<{ id: number; x: number; y: number; t: number; moved: boolean } | null>(null)
  const interactive = props.interactive !== false

  const clampView = useCallback((v: View): View => {
    const w = propsRef.current.data.world
    const scale = Math.min(MAX_SCALE, Math.max(minScaleRef.current, v.scale))
    return { cx: Math.min(w.x1, Math.max(w.x0, v.cx)), cy: Math.min(w.y1, Math.max(w.y0, v.cy)), scale }
  }, [])

  const fitView = useCallback((): View => {
    const w = propsRef.current.data.world
    return { cx: (w.x0 + w.x1) / 2, cy: (w.y0 + w.y1) / 2, scale: minScaleRef.current }
  }, [])

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const { cx, cy, scale } = viewRef.current
    const { w, h } = sizeRef.current
    return { x: cx + (sx - w / 2) / scale, y: cy + (sy - h / 2) / scale }
  }, [])

  const draw = useCallback(() => {
    rafRef.current = 0
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const now = performance.now()
    const wall = Date.now()
    let live = false
    const anim = animRef.current
    if (anim) {
      const p = Math.min(1, (now - anim.t0) / anim.ms)
      const e = easeOutCubic(p)
      const ls = Math.log(anim.from.scale) + (Math.log(anim.to.scale) - Math.log(anim.from.scale)) * e
      viewRef.current = {
        cx: anim.from.cx + (anim.to.cx - anim.from.cx) * e,
        cy: anim.from.cy + (anim.to.cy - anim.from.cy) * e,
        scale: Math.exp(ls),
      }
      if (p >= 1) {
        animRef.current = null
        anim.onDone?.()
      } else live = true
    }
    const { data, tier, highlights = {}, shields = [], markers = [], lines = [], pulses = [], showJunctions } = propsRef.current
    const C = propsRef.current.palette === 'light' ? LIGHT : COLORS
    const { w, h } = sizeRef.current
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const { cx, cy, scale } = viewRef.current
    const tx = w / 2 - cx * scale
    const ty = h / 2 - cy * scale
    const X = (x: number) => x * scale + tx
    const Y = (y: number) => y * scale + ty

    ctx.fillStyle = C.bg
    ctx.fillRect(0, 0, w, h)

    // Land polygons. Screen-space decimation skips vertices within a pixel of the previous one.
    const fillLand = (polys: typeof data.land, fill: string, edge: string) => {
      ctx.beginPath()
      for (const poly of polys) {
        for (const ring of poly.rings) {
          let lx = X(ring[0])
          let ly = Y(ring[1])
          ctx.moveTo(lx, ly)
          for (let i = 2; i < ring.length; i += 2) {
            const sx = X(ring[i])
            const sy = Y(ring[i + 1])
            if (Math.abs(sx - lx) + Math.abs(sy - ly) < MIN_STEP) continue
            ctx.lineTo(sx, sy)
            lx = sx
            ly = sy
          }
          ctx.closePath()
        }
      }
      ctx.fillStyle = fill
      ctx.fill('evenodd')
      ctx.strokeStyle = edge
      ctx.lineWidth = 1
      ctx.stroke()
    }
    fillLand(data.abroad, C.abroad, C.abroadEdge) // neighbours, muted, so the country does not float in the void
    fillLand(data.land, C.land, C.landEdge)

    const z = Math.log2(scale / minScaleRef.current)
    // Line widths: a zoom-dependent minimum in px, or the real road width once zoomed in far enough.
    const basePx: Record<RoadKind, number> = { A: Math.min(9, 2.2 + z * 0.9), N: Math.min(6, 1.5 + z * 0.6), P: Math.min(4, 0.8 + z * 0.45) }
    const widths: Record<RoadKind, number> = { A: Math.max(basePx.A, 11 * scale), N: Math.max(basePx.N, 8 * scale), P: Math.max(basePx.P, 7 * scale) }
    const linkWidth: Record<'A' | 'N', number> = { A: Math.max(basePx.A * 0.55, 5.5 * scale), N: Math.max(basePx.N * 0.6, 5 * scale) }
    const detailed = scale > 0.25 // dark casings so crossings and ramps separate visually
    const smooth = scale > 0.6 // round off the polyline corners at deep zoom
    const vx0 = cx - w / 2 / scale
    const vy0 = cy - h / 2 / scale
    const vx1 = cx + w / 2 / scale
    const vy1 = cy + h / 2 / scale
    const inView = (b: readonly number[]) => b[2] >= vx0 && b[0] <= vx1 && b[3] >= vy0 && b[1] <= vy1
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const trace = (line: number[]) => {
      let px = X(line[0])
      let py = Y(line[1])
      ctx.moveTo(px, py)
      const last = line.length - 2
      for (let i = 2; i < line.length; i += 2) {
        const sx = X(line[i])
        const sy = Y(line[i + 1])
        if (i !== last && Math.abs(sx - px) + Math.abs(sy - py) < MIN_STEP) continue
        if (smooth) ctx.quadraticCurveTo(px, py, (px + sx) / 2, (py + sy) / 2)
        else ctx.lineTo(sx, sy)
        px = sx
        py = sy
      }
      if (smooth) ctx.lineTo(px, py)
    }
    const strokeLines = (ls: number[][], color: string, width: number, alpha: number) => {
      ctx.beginPath()
      for (const line of ls) trace(line)
      ctx.globalAlpha = alpha
      if (detailed) {
        ctx.strokeStyle = C.bg
        ctx.lineWidth = width + 3
        ctx.stroke()
      }
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.stroke()
    }
    const later: Road[] = []
    const drawKind = (order: RoadKind) => {
      for (const r of data.roads) {
        if (r.kind !== order || !inView(r.bbox)) continue
        if (highlights[r.ref]) {
          later.push(r)
          continue
        }
        const inTier = tierIncludes(tier, r.kind)
        if (r.kind === 'P' && !inTier && z < 2.5) continue
        strokeLines(r.lines, C[r.kind], widths[r.kind], inTier ? 1 : 0.35)
      }
    }
    drawKind('P')
    if (z > 1.5) {
      for (const lk of data.links) {
        if (!inView(lk.b)) continue
        strokeLines([lk.l], C[lk.k], linkWidth[lk.k], tierIncludes(tier, lk.k) ? 0.95 : 0.35)
      }
    }
    drawKind('N')
    drawKind('A')
    ctx.globalAlpha = 1
    for (const r of later) {
      const color = COLORS[highlights[r.ref]]
      ctx.beginPath()
      for (const line of r.lines) trace(line)
      ctx.strokeStyle = color
      ctx.globalAlpha = 0.35
      ctx.lineWidth = widths[r.kind] + 10
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.lineWidth = widths[r.kind] + 1.5
      ctx.stroke()
    }

    if (showJunctions) {
      for (const j of data.junctions) {
        const sx = X(j.x)
        const sy = Y(j.y)
        if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) continue
        ctx.beginPath()
        ctx.arc(sx, sy, 4, 0, Math.PI * 2)
        ctx.fillStyle = '#fff'
        ctx.fill()
        ctx.strokeStyle = C.bg
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    }

    for (const l of lines) {
      let p = 1
      if (l.t0) {
        p = Math.min(1, (wall - l.t0) / LINE_MS)
        if (p < 1) live = true
      }
      const ex = l.x0 + (l.x1 - l.x0) * easeOutCubic(p)
      const ey = l.y0 + (l.y1 - l.y0) * easeOutCubic(p)
      ctx.setLineDash([6, 6])
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(X(l.x0), Y(l.y0))
      ctx.lineTo(X(ex), Y(ey))
      ctx.stroke()
      ctx.setLineDash([])
    }
    for (const pu of pulses) {
      const p = (wall - pu.t0) / PULSE_MS
      if (p < 0 || p >= 1) continue
      live = true
      ctx.beginPath()
      ctx.arc(X(pu.x), Y(pu.y), 6 + 40 * easeOutCubic(p), 0, Math.PI * 2)
      ctx.strokeStyle = pu.color ?? COLORS.correct
      ctx.globalAlpha = 1 - p
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    for (const m of markers) drawMarker(ctx, X(m.x), Y(m.y), m)
    for (const s of shields) {
      const road = data.byRef.get(s.ref)
      let pop = 1
      if (s.born) {
        const p = Math.min(1, (wall - s.born) / POP_MS)
        if (p < 1) live = true
        pop = 0.4 + 0.6 * easeOutBack(p)
      }
      drawShield(ctx, s.ref, road?.kind ?? 'N', X(s.x), Y(s.y), s.state, pop)
    }
    if (propsRef.current.interactive !== false) drawScaleBar(ctx, h, scale)
    if (live && !rafRef.current) rafRef.current = requestAnimationFrame(draw)
  }, [])

  const requestRedraw = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(draw)
  }, [draw])

  const setView = useCallback(
    (v: View) => {
      viewRef.current = clampView(v)
      requestRedraw()
    },
    [clampView, requestRedraw],
  )

  const animate = useCallback(
    (to: View, ms = 600, onDone?: () => void) => {
      if (!initRef.current) {
        pendingRef.current = to
        return
      }
      if (reducedMotion()) ms = Math.min(ms, 1)
      animRef.current = { from: { ...viewRef.current }, to: clampView(to), t0: performance.now(), ms, onDone }
      requestRedraw()
    },
    [clampView, requestRedraw],
  )

  const zoomAt = useCallback(
    (sx: number, sy: number, factor: number, ms = 0) => {
      const { w, h } = sizeRef.current
      const wp = screenToWorld(sx, sy)
      const scale = Math.min(MAX_SCALE, Math.max(minScaleRef.current, viewRef.current.scale * factor))
      const target = { cx: wp.x - (sx - w / 2) / scale, cy: wp.y - (sy - h / 2) / scale, scale }
      if (ms > 0) animate(target, ms)
      else setView(target)
    },
    [animate, screenToWorld, setView],
  )

  // Home screen backdrop: wander to a random spot, pause, wander again.
  const scheduleDrift = useCallback(() => {
    window.clearTimeout(driftTimer.current)
    if (!propsRef.current.drift || reducedMotion()) return
    driftTimer.current = window.setTimeout(() => {
      const wb = propsRef.current.data.world
      const cx = wb.x0 + (0.25 + Math.random() * 0.5) * (wb.x1 - wb.x0)
      const cy = wb.y0 + (0.2 + Math.random() * 0.6) * (wb.y1 - wb.y0)
      animate({ cx, cy, scale: minScaleRef.current * (2 + Math.random() * 1.5) }, 9000, scheduleDrift)
    }, 600)
  }, [animate])

  // Resize handling and first layout
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ro = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect()
      const w = Math.max(1, Math.round(rect.width))
      const h = Math.max(1, Math.round(rect.height))
      const dpr = window.devicePixelRatio || 1
      sizeRef.current = { w, h }
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      const world = propsRef.current.data.world
      minScaleRef.current = Math.min(w / (world.x1 - world.x0), h / (world.y1 - world.y0)) * 0.95
      if (!initRef.current) {
        initRef.current = true
        const fit = fitView()
        viewRef.current = fit
        if (pendingRef.current) {
          const target = pendingRef.current
          pendingRef.current = null
          viewRef.current = { ...fit, scale: fit.scale * 1.4 }
          animate(target, 700)
        } else if (propsRef.current.intro && !reducedMotion()) {
          viewRef.current = { ...fit, scale: fit.scale * 2.4 }
          animate(fit, 1100, propsRef.current.drift ? scheduleDrift : undefined)
        } else if (propsRef.current.drift) {
          scheduleDrift()
        }
      } else {
        viewRef.current = clampView(viewRef.current)
      }
      // Draw synchronously: setting the canvas size cleared it, and rAF may be paused in a hidden tab.
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      draw()
    })
    ro.observe(wrap)
    return () => {
      ro.disconnect()
      window.clearTimeout(driftTimer.current)
    }
  }, [animate, clampView, draw, fitView, scheduleDrift])

  // Wheel zoom (non-passive to prevent page scroll)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !interactive) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      animRef.current = null
      const r = canvas.getBoundingClientRect()
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0018))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [zoomAt, interactive])

  // Redraw when overlays change
  useEffect(() => {
    requestRedraw()
  }, [props.highlights, props.shields, props.markers, props.lines, props.pulses, props.showJunctions, props.tier, requestRedraw])

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    },
    [],
  )

  const local = (e: ReactPointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return
    capture(e.currentTarget, e.pointerId)
    animRef.current = null
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    if (pointers.current.size === 1) {
      panRef.current = { x: p.x, y: p.y, view: { ...viewRef.current } }
      tapRef.current = { id: e.pointerId, x: p.x, y: p.y, t: performance.now(), moved: false }
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const wp = screenToWorld(mid.x, mid.y)
      pinchRef.current = { d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), view0: { ...viewRef.current }, wx: wp.x, wy: wp.y }
      panRef.current = null
      if (tapRef.current) tapRef.current.moved = true
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    const { w, h } = sizeRef.current
    if (pinchRef.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const pr = pinchRef.current
      const scale = Math.min(MAX_SCALE, Math.max(minScaleRef.current, (pr.view0.scale * d) / pr.d0))
      setView({ cx: pr.wx - (mid.x - w / 2) / scale, cy: pr.wy - (mid.y - h / 2) / scale, scale })
    } else if (panRef.current && pointers.current.size === 1) {
      const dx = p.x - panRef.current.x
      const dy = p.y - panRef.current.y
      if (tapRef.current && Math.hypot(dx, dy) > 10) tapRef.current.moved = true
      const v = panRef.current.view
      setView({ cx: v.cx - dx / v.scale, cy: v.cy - dy / v.scale, scale: v.scale })
    }
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    const p = local(e)
    pointers.current.delete(e.pointerId)
    const tap = tapRef.current
    if (tap && tap.id === e.pointerId) {
      tapRef.current = null
      if (!tap.moved && e.type !== 'pointercancel' && performance.now() - tap.t < 600 && propsRef.current.onTap) {
        const wp = screenToWorld(p.x, p.y)
        propsRef.current.onTap({ x: wp.x, y: wp.y, sx: p.x, sy: p.y, scale: viewRef.current.scale })
      }
    }
    if (pointers.current.size === 1) {
      const [rest] = [...pointers.current.values()]
      panRef.current = { x: rest.x, y: rest.y, view: { ...viewRef.current } }
      pinchRef.current = null
    } else if (pointers.current.size === 0) {
      panRef.current = null
      pinchRef.current = null
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      flyToBounds(b, pad = 40) {
        const { w, h } = sizeRef.current
        const bw = Math.max(50, b.x1 - b.x0)
        const bh = Math.max(50, b.y1 - b.y0)
        const target = { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, scale: Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh) }
        if (!initRef.current) {
          // Not measured yet: remember the target and resolve it once the size is known.
          pendingRef.current = target
          return
        }
        animate(target)
      },
      flyToPoint(x, y, scale) {
        animate({ cx: x, cy: y, scale: scale ?? viewRef.current.scale })
      },
      zoomBy(factor) {
        const { w, h } = sizeRef.current
        zoomAt(w / 2, h / 2, factor, 250)
      },
      reset() {
        animate(fitView())
      },
      screenToWorld,
      getView: () => ({ ...viewRef.current }),
      getElement: () => wrapRef.current,
    }),
    [animate, fitView, screenToWorld, zoomAt],
  )

  return (
    <div ref={wrapRef} className={'map-wrap' + (props.onTap ? ' map-tappable' : '') + (interactive ? '' : ' map-static') + (props.className ? ' ' + props.className : '')}>
      <canvas ref={canvasRef} className="map-canvas" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />
      {interactive && (
        <div className="map-zoom">
          <button type="button" className="sign-btn" aria-label="Zoom in" onPointerDown={(e) => e.stopPropagation()} onClick={() => zoomAt(sizeRef.current.w / 2, sizeRef.current.h / 2, 1.7, 250)}>
            <IconPlus />
          </button>
          <button type="button" className="sign-btn" aria-label="Zoom out" onPointerDown={(e) => e.stopPropagation()} onClick={() => zoomAt(sizeRef.current.w / 2, sizeRef.current.h / 2, 1 / 1.7, 250)}>
            <IconMinus />
          </button>
          <button type="button" className="sign-btn" aria-label="Reset view" onPointerDown={(e) => e.stopPropagation()} onClick={() => animate(fitView())}>
            <IconFit />
          </button>
        </div>
      )}
      {props.children}
    </div>
  )
})

export default MapView
