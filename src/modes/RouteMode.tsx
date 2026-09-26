import { useEffect, useMemo, useRef, useState } from 'react'
import MapView, { type Highlight, type MapHandle, type Marker, type TapInfo } from '../map/MapView'
import { boundsOfPoints, roadsForTier, type Place, type Road } from '../data'
import { useLang } from '../i18n'
import { HUD } from '../ui/HUD'
import { Shield } from '../ui/Shield'
import { IconCheck, IconClose, IconReplay, IconSignArrow } from '../ui/icons'
import { buildGraph, lcs, route, snap, type Graph, type RouteResult } from '../game/graph'
import { shuffle, type Grade, type QuestionResult } from '../game/session'
import { useNow } from '../game/hooks'
import { haptic, sfx } from '../game/sound'
import type { ModeProps } from './types'

const ROUNDS = 5
type Phase = 'start' | 'end' | 'answer' | 'reveal'

interface Pt {
  x: number
  y: number
  name: string
}

/** Pick start and end (tap or type a place), then name the road numbers you would drive, in order. */
export function RouteMode({ data, session, onFinish, onQuit }: ModeProps) {
  const { t } = useLang()
  const mapRef = useRef<MapHandle>(null)
  const [graph, setGraph] = useState<Graph | null>(null)
  const [round, setRound] = useState(0)
  const [phase, setPhase] = useState<Phase>('start')
  const [start, setStart] = useState<Pt | null>(null)
  const [end, setEnd] = useState<Pt | null>(null)
  const [plan, setPlan] = useState<RouteResult | null>(null)
  const [candidates, setCandidates] = useState<Road[]>([])
  const [chosen, setChosen] = useState<string[]>([])
  const [results, setResults] = useState<QuestionResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [typed, setTyped] = useState({ start: '', end: '' })
  const now = useNow(true, 500)
  const score = results.reduce((a, r) => a + r.points, 0)

  // The graph takes a moment to build; do it after the first paint.
  useEffect(() => {
    let alive = true
    const id = window.setTimeout(() => data.ready.then(() => alive && setGraph(buildGraph(data))), 50)
    return () => {
      alive = false
      window.clearTimeout(id)
    }
  }, [data])

  const nearestPlace = (x: number, y: number): string => {
    let best: Place | null = null
    let bd = Infinity
    for (const p of data.places) {
      const d = Math.hypot(p.x - x, p.y - y)
      if (d < bd) {
        bd = d
        best = p
      }
    }
    return best ? best.n : ''
  }

  const placeByName = (name: string): Place | undefined => {
    const q = name.trim().toLowerCase()
    return data.places.find((p) => p.n.toLowerCase() === q) ?? data.places.find((p) => p.n.toLowerCase().startsWith(q) && q.length >= 3)
  }

  const setPoint = (which: 'start' | 'end', pt: Pt) => {
    if (which === 'start') {
      setStart(pt)
      setPhase('end')
    } else {
      setEnd(pt)
      compute(start!, pt)
    }
    sfx.tap()
  }

  const compute = (a: Pt, b: Pt) => {
    if (!graph) return
    const from = snap(data, graph, a.x, a.y)
    const to = snap(data, graph, b.x, b.y)
    const r = from !== null && to !== null && from !== to ? route(graph, from, to) : null
    if (!r || r.refs.length === 0) {
      setError(t('noRoute'))
      setEnd(null)
      setPhase('end')
      return
    }
    setError(null)
    setPlan(r)
    // Candidates: the route's roads plus a few lookalikes from the same region.
    const inRoute = new Set(r.refs)
    const xs = r.path.filter((_, i) => i % 2 === 0)
    const ys = r.path.filter((_, i) => i % 2 === 1)
    const bx = [Math.min(...xs) - 30000, Math.min(...ys) - 30000, Math.max(...xs) + 30000, Math.max(...ys) + 30000]
    const nearby = roadsForTier(data, 'AN').filter((rd) => !inRoute.has(rd.ref) && rd.bbox[2] >= bx[0] && rd.bbox[0] <= bx[2] && rd.bbox[3] >= bx[1] && rd.bbox[1] <= bx[3])
    const distract = shuffle(nearby, Math.random).slice(0, Math.max(3, Math.min(6, 10 - r.refs.length)))
    const all = [...r.refs.map((ref) => data.byRef.get(ref)!).filter(Boolean), ...distract]
    setCandidates(shuffle(all, Math.random))
    setChosen([])
    setPhase('answer')
    mapRef.current?.flyToBounds(boundsOfPoints([[a.x, a.y], [b.x, b.y]], 20000), 60)
  }

  const check = () => {
    if (!plan) return
    const common = lcs(chosen, plan.refs)
    const ratio = common / Math.max(chosen.length, plan.refs.length)
    const exact = chosen.length === plan.refs.length && common === plan.refs.length
    const points = Math.round(200 * ratio) + (exact ? 50 : 0)
    const grade: Grade = ratio >= 0.8 ? 'good' : ratio >= 0.5 ? 'partial' : 'bad'
    setResults((rs) => [...rs, { label: `${start?.name} → ${end?.name}`, grade, points, ms: 0, detail: plan.refs.join(' · ') + ` (${Math.round(plan.lengthM / 1000)} km)` }])
    if (grade === 'good') {
      sfx.correct()
      haptic(20)
    } else {
      sfx.wrong()
      haptic([30, 40, 30])
    }
    setPhase('reveal')
  }

  const next = () => {
    if (round + 1 >= ROUNDS) {
      onFinish({ ...session, results, finishedAt: Date.now() })
      return
    }
    setRound(round + 1)
    setStart(null)
    setEnd(null)
    setPlan(null)
    setChosen([])
    setTyped({ start: '', end: '' })
    setPhase('start')
    mapRef.current?.reset()
  }

  const randomPair = () => {
    const cities = data.places.filter((p) => p.c === 1)
    for (let tries = 0; tries < 50; tries++) {
      const a = cities[Math.floor(Math.random() * cities.length)]
      const b = cities[Math.floor(Math.random() * cities.length)]
      if (a !== b && Math.hypot(a.x - b.x, a.y - b.y) > 60000) {
        setStart({ x: a.x, y: a.y, name: a.n })
        setTyped({ start: a.n, end: b.n })
        setEnd({ x: b.x, y: b.y, name: b.n })
        compute({ x: a.x, y: a.y, name: a.n }, { x: b.x, y: b.y, name: b.n })
        return
      }
    }
  }

  const onTap = (tap: TapInfo) => {
    if (phase !== 'start' && phase !== 'end') return
    const pt = { x: tap.x, y: tap.y, name: nearestPlace(tap.x, tap.y) }
    setTyped((v) => ({ ...v, [phase]: pt.name }))
    setPoint(phase, pt)
  }

  const submitTyped = (which: 'start' | 'end') => {
    const p = placeByName(typed[which])
    if (!p) {
      setError(t('unknownPlace'))
      return
    }
    setError(null)
    setTyped((v) => ({ ...v, [which]: p.n }))
    if (which === 'start') {
      setStart({ x: p.x, y: p.y, name: p.n })
      setPhase(end ? 'answer' : 'end')
      if (end) compute({ x: p.x, y: p.y, name: p.n }, end)
    } else {
      if (!start) {
        setEnd({ x: p.x, y: p.y, name: p.n })
        setPhase('start')
        return
      }
      setPoint('end', { x: p.x, y: p.y, name: p.n })
    }
  }

  const highlights: Record<string, Highlight> = {}
  if (phase === 'reveal' && plan) {
    for (const ref of plan.refs) highlights[ref] = 'correct'
    for (const ref of chosen) if (!plan.refs.includes(ref)) highlights[ref] = 'wrong'
  }
  const markers: Marker[] = []
  if (start) markers.push({ x: start.x, y: start.y, kind: 'answer', label: start.name })
  if (end) markers.push({ x: end.x, y: end.y, kind: 'guess', label: end.name })
  const paths = phase === 'reveal' && plan ? [plan.path] : []
  const placeList = useMemo(() => data.places.map((p) => p.n), [data])

  const prompt = phase === 'start' ? t('routeStart') : phase === 'end' ? t('routeEnd') : phase === 'answer' ? t('routeAnswer') : t('routeReveal')

  return (
    <div className="game">
      <HUD index={round} total={ROUNDS} grades={results.map((r) => r.grade)} score={score} elapsedMs={now - session.startedAt} onQuit={onQuit} countLabel={t('roundCount', { n: round + 1, total: ROUNDS })} prompt={<span className="prompt-text">{prompt}</span>} />
      {(phase === 'start' || phase === 'end') && (
        <div className="route-inputs">
          <datalist id="places">
            {placeList.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          {(['start', 'end'] as const).map((which) => (
            <form
              key={which}
              className={'route-input' + (phase === which ? ' route-input-active' : '')}
              onSubmit={(e) => {
                e.preventDefault()
                submitTyped(which)
              }}
            >
              <label>
                <span>{which === 'start' ? t('from') : t('to')}</span>
                <input list="places" value={typed[which]} placeholder={t('typePlace')} onChange={(e) => setTyped((v) => ({ ...v, [which]: e.target.value }))} autoComplete="off" />
              </label>
            </form>
          ))}
          <button type="button" className="btn btn-small" onClick={randomPair} disabled={!graph}>
            <IconReplay /> {t('randomRoute')}
          </button>
        </div>
      )}
      <MapView ref={mapRef} data={data} tier={session.tier} mirror={session.variant === 'mirror'} highlights={highlights} markers={markers} paths={paths} onTap={phase === 'start' || phase === 'end' ? onTap : undefined} intro>
        {!graph && <div className="toast">{t('buildingGraph')}</div>}
        {error && (
          <div role="status" className="feedback feedback-bad">
            {error}
          </div>
        )}
      </MapView>
      {phase === 'answer' && (
        <div className="route-panel">
          <div className="route-seq">
            {chosen.length === 0 && <span className="route-hint">{t('routeTapSigns')}</span>}
            {chosen.map((ref, i) => {
              const r = data.byRef.get(ref)!
              return (
                <span key={i} className="route-step">
                  <Shield code={r.ref} kind={r.kind} size="sm" />
                  {i < chosen.length - 1 && <IconSignArrow className="route-arrow" />}
                </span>
              )
            })}
            {chosen.length > 0 && (
              <button type="button" className="sign-btn sign-btn-small" aria-label={t('undo')} onClick={() => setChosen((c) => c.slice(0, -1))}>
                <IconClose />
              </button>
            )}
          </div>
          <div className="route-candidates">
            {candidates.map((r) => (
              <button key={r.ref} type="button" className="route-cand" disabled={chosen.includes(r.ref)} onClick={() => setChosen((c) => [...c, r.ref])}>
                <Shield code={r.ref} kind={r.kind} size="lg" />
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary" disabled={chosen.length === 0} onClick={check}>
            <IconCheck /> {t('checkRoute')}
          </button>
        </div>
      )}
      {phase === 'reveal' && plan && (
        <div className="route-panel">
          <div className="route-seq">
            <span className="route-hint">{t('correctRoute')}</span>
            {plan.refs.map((ref, i) => {
              const r = data.byRef.get(ref)!
              return (
                <span key={i} className="route-step">
                  <Shield code={r.ref} kind={r.kind} size="sm" />
                  {i < plan.refs.length - 1 && <IconSignArrow className="route-arrow" />}
                </span>
              )
            })}
            <span className="route-km">{Math.round(plan.lengthM / 1000)} km</span>
          </div>
          <button type="button" className="btn btn-primary" onClick={next}>
            {t('next')} <IconSignArrow />
          </button>
        </div>
      )}
    </div>
  )
}
