import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import MapView, { type Highlight, type MapHandle, type PlacedShield, type Pulse } from '../map/MapView'
import { haptic, sfx } from '../game/sound'
import { tierIncludes } from '../data'
import { useLang } from '../i18n'
import { HUD } from '../ui/HUD'
import { Shield } from '../ui/Shield'
import { mulberry32, pickRoads, QUESTION_COUNT, roadsFromPicks, TIME_LIMITS, type QuestionResult } from '../game/session'
import { useNow, useToast } from '../game/hooks'
import type { ModeProps } from './types'

/** setPointerCapture can throw when the pointer is already gone (synthetic or cancelled events). */
function capture(el: Element, pointerId: number) {
  try {
    el.setPointerCapture(pointerId)
  } catch {
    /* ignore */
  }
}

interface DragState {
  ref: string
  x: number
  y: number
}

export function DragMode({ data, session, onFinish, onQuit }: ModeProps) {
  const { t } = useLang()
  const mapRef = useRef<MapHandle>(null)
  const items = useMemo(() => (session.picks ? roadsFromPicks(data, session.picks) : pickRoads(data, session.tier, QUESTION_COUNT, mulberry32(session.seed), session.province)), [data, session.tier, session.seed, session.province, session.picks])
  const [placed, setPlaced] = useState<Record<string, { x: number; y: number; at: number }>>({})
  const [pulses, setPulses] = useState<Pulse[]>([])
  const [attempts, setAttempts] = useState<Record<string, number>>({})
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragStart = useRef<{ ref: string; id: number; x: number; y: number; active: boolean } | null>(null)
  const [flash, setFlash] = useState<{ highlights: Record<string, Highlight>; shield?: PlacedShield } | null>(null)
  const flashTimer = useRef(0)
  const [phase, setPhase] = useState<'play' | 'reveal'>('play')
  const [toast, showToast] = useToast()
  const now = useNow(phase === 'play')
  const limitMs = session.timer ? TIME_LIMITS.drag * 1000 : 0
  const remaining = limitMs ? Math.max(0, session.startedAt + limitMs - now) : 0
  const placedCount = Object.keys(placed).length
  const secsLeft = Math.ceil(remaining / 1000)
  useEffect(() => {
    if (limitMs && phase === 'play' && secsLeft <= 5 && secsLeft > 0) sfx.tick()
  }, [secsLeft, limitMs, phase])
  const allPlaced = placedCount === items.length

  const score = items.reduce((sum, r) => (placed[r.ref] ? sum + Math.max(25, 100 - 25 * (attempts[r.ref] ?? 0)) : sum), 0)

  // End of game: everything placed or out of time.
  useEffect(() => {
    if (phase === 'play' && (allPlaced || (limitMs > 0 && remaining <= 0))) {
      setPhase('reveal')
      setDrag(null)
      dragStart.current = null
    }
  }, [allPlaced, remaining, limitMs, phase])

  useEffect(() => () => window.clearTimeout(flashTimer.current), [])

  const finish = () => {
    const results: QuestionResult[] = items.map((r) => {
      const p = placed[r.ref]
      const a = attempts[r.ref] ?? 0
      return { label: r.ref, grade: p ? (a === 0 ? 'good' : 'partial') : 'bad', points: p ? Math.max(25, 100 - 25 * a) : 0, ms: 0, detail: p && a > 0 ? `${a}x ${t('wrong').toLowerCase()}` : undefined }
    })
    onFinish({ ...session, results, finishedAt: Date.now() })
  }

  const showFlash = (f: { highlights: Record<string, Highlight>; shield?: PlacedShield }, ms: number) => {
    window.clearTimeout(flashTimer.current)
    setFlash(f)
    flashTimer.current = window.setTimeout(() => setFlash(null), ms)
  }

  const drop = (ref: string, clientX: number, clientY: number) => {
    const handle = mapRef.current
    const el = handle?.getElement()
    if (!handle || !el) return
    const rect = el.getBoundingClientRect()
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return
    const { x, y } = handle.screenToWorld(clientX - rect.left, clientY - rect.top)
    const scale = handle.getView().scale
    const hit = data.index.nearest(x, y, 32 / scale, (r) => tierIncludes(session.tier, r.kind))
    if (!hit) {
      showToast(t('noRoad'))
      return
    }
    if (hit.road.ref === ref) {
      const at = Date.now()
      setPlaced((p) => ({ ...p, [ref]: { x: hit.px, y: hit.py, at } }))
      setPulses((p) => [...p.slice(-6), { x: hit.px, y: hit.py, t0: at }, { x: hit.px, y: hit.py, t0: at, kind: 'puff' }])
      sfx.place()
      haptic([15, 30, 25])
    } else {
      sfx.wrong()
      haptic([30, 40, 30])
      setAttempts((a) => ({ ...a, [ref]: (a[ref] ?? 0) + 1 }))
      showFlash({ highlights: { [hit.road.ref]: 'wrong' }, shield: { ref: hit.road.ref, x: hit.px, y: hit.py, state: 'wrong' } }, 1400)
      showToast(`${t('wrong')} ${t('thatWas', { ref: hit.road.ref })}`)
    }
  }

  // Drawer drag handling. Touch: a mostly vertical move starts the drag, horizontal moves scroll the drawer.
  const onShieldDown = (e: ReactPointerEvent<HTMLButtonElement>, ref: string) => {
    if (phase !== 'play') return
    const active = e.pointerType === 'mouse'
    dragStart.current = { ref, id: e.pointerId, x: e.clientX, y: e.clientY, active }
    sfx.tap()
    if (active) {
      capture(e.currentTarget, e.pointerId)
      setDrag({ ref, x: e.clientX, y: e.clientY })
    }
  }
  const onShieldMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const s = dragStart.current
    if (!s || s.id !== e.pointerId) return
    if (!s.active) {
      if (Math.abs(e.clientY - s.y) < 8) return
      s.active = true
      capture(e.currentTarget, e.pointerId)
    }
    setDrag({ ref: s.ref, x: e.clientX, y: e.clientY })
  }
  const onShieldUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const s = dragStart.current
    dragStart.current = null
    setDrag(null)
    if (!s || !s.active) return
    drop(s.ref, e.clientX, e.clientY)
  }
  const onShieldCancel = () => {
    dragStart.current = null
    setDrag(null)
  }

  const shields: PlacedShield[] = items.filter((r) => placed[r.ref]).map((r) => ({ ref: r.ref, x: placed[r.ref].x, y: placed[r.ref].y, state: 'correct', born: placed[r.ref].at }))
  if (phase === 'reveal') {
    for (const r of items) if (!placed[r.ref]) shields.push({ ref: r.ref, x: r.anchor[0], y: r.anchor[1], state: 'wrong' })
  }
  if (flash?.shield) shields.push(flash.shield)
  const highlights: Record<string, Highlight> = {}
  for (const r of items) if (placed[r.ref]) highlights[r.ref] = 'correct'
  Object.assign(highlights, flash?.highlights ?? {})
  if (phase === 'reveal') for (const r of items) if (!placed[r.ref]) highlights[r.ref] = 'wrong'

  const remainingItems = items.filter((r) => !placed[r.ref])
  const dragKind = drag ? data.byRef.get(drag.ref)?.kind ?? 'N' : 'N'

  return (
    <div className="game">
      <HUD
        index={placedCount}
        total={items.length}
        grades={items.map((r) => (placed[r.ref] ? ((attempts[r.ref] ?? 0) > 0 ? 'partial' : 'good') : undefined))}
        score={score}
        remainingMs={remaining}
        limitMs={limitMs}
        elapsedMs={limitMs ? undefined : now - session.startedAt}
        onQuit={onQuit}
        countLabel={t('placed', { n: placedCount, total: items.length })}
        prompt={
          <div className="prompt-col">
            <span className="prompt-text">{t('dragPrompt')}</span>
            {placedCount === 0 && phase === 'play' && <span className="prompt-hint">{t('dragHelp')}</span>}
          </div>
        }
      />
      <MapView ref={mapRef} data={data} tier={session.tier} highlights={highlights} shields={shields} pulses={pulses} lockZoom={session.variant === 'nozoom'} hideRoads={session.variant === 'blind'} intro>
        {toast && <div className="toast">{toast}</div>}
      </MapView>
      {phase === 'play' ? (
        <div className="drawer">
          <div className="drawer-strip">
            {remainingItems.map((r) => (
              <button
                key={r.ref}
                type="button"
                className={'drawer-item' + (drag?.ref === r.ref ? ' drawer-item-dragging' : '') + ((attempts[r.ref] ?? 0) > 0 ? ' drawer-item-missed' : '')}
                onPointerDown={(e) => onShieldDown(e, r.ref)}
                onPointerMove={onShieldMove}
                onPointerUp={onShieldUp}
                onPointerCancel={onShieldCancel}
              >
                <Shield code={r.ref} kind={r.kind} size="lg" />
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-ghost btn-small drawer-giveup" onClick={() => setPhase('reveal')}>
            {t('giveUp')}
          </button>
        </div>
      ) : (
        <div className="drawer drawer-done">
          <span className="prompt-text">{allPlaced ? t('correct') : t('reveal')}</span>
          <button type="button" className="btn btn-primary" onClick={finish}>
            {t('done')}
          </button>
        </div>
      )}
      {drag && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          <Shield code={drag.ref} kind={dragKind} size="lg" />
        </div>
      )}
    </div>
  )
}
