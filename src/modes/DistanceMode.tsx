import { useEffect, useRef, useState } from 'react'
import MapView, { type MapHandle, type Marker } from '../map/MapView'
import { boundsOfPoints, type Junction } from '../data'
import { useLang } from '../i18n'
import { HUD } from '../ui/HUD'
import { Matrix } from '../ui/widgets'
import { buildGraph, route, snap, type Graph } from '../game/graph'
import { mulberry32, QUESTION_COUNT, shuffle, TIME_LIMITS, timeBonus, VARIANT_MULT, type Grade, type QuestionResult } from '../game/session'
import { useNow, useTimeout } from '../game/hooks'
import { haptic, sfx } from '../game/sound'
import type { ModeProps } from './types'

interface Q {
  a: Junction
  b: Junction
  km: number
  path: number[]
}

const MIN_KM = 10
const MAX_KM = 300

function distancePoints(guess: number, actual: number): { points: number; grade: Grade } {
  const err = Math.abs(guess - actual) / actual
  if (err <= 0.05) return { points: 100, grade: 'good' }
  if (err <= 0.1) return { points: 80, grade: 'good' }
  if (err <= 0.2) return { points: 55, grade: 'partial' }
  if (err <= 0.35) return { points: 30, grade: 'partial' }
  if (err <= 0.5) return { points: 10, grade: 'bad' }
  return { points: 0, grade: 'bad' }
}

/** How far is it by road from one interchange to another? Slide to your guess, then see the real route. */
export function DistanceMode({ data, session, onFinish, onQuit }: ModeProps) {
  const { t } = useLang()
  const mapRef = useRef<MapHandle>(null)
  const [graph, setGraph] = useState<Graph | null>(null)
  const [questions, setQuestions] = useState<Q[] | null>(null)
  const [i, setI] = useState(0)
  const [guess, setGuess] = useState(100)
  const [results, setResults] = useState<QuestionResult[]>([])
  const [phase, setPhase] = useState<'ask' | 'reveal'>('ask')
  const [qStart, setQStart] = useState(() => Date.now())
  const [feedback, setFeedback] = useState<{ grade: Grade; points: number; actual: number; guess: number } | null>(null)
  const now = useNow(true, 50)
  const limitMs = session.timer ? TIME_LIMITS.distance * 1000 : 0
  const remaining = limitMs && questions ? Math.max(0, qStart + limitMs - now) : 0
  const q = questions?.[i]
  const score = results.reduce((a, r) => a + r.points, 0)

  useEffect(() => {
    let alive = true
    const id = window.setTimeout(() => data.ready.then(() => alive && setGraph(buildGraph(data))), 50)
    return () => {
      alive = false
      window.clearTimeout(id)
    }
  }, [data])

  // Seeded pairs of interchanges between 30 and 220 km apart as the crow flies, with a real road route between them.
  useEffect(() => {
    if (!graph) return
    const rng = mulberry32(session.seed)
    const pool = shuffle(data.junctions.filter((j) => !session.province || j.p?.includes(session.province)), rng)
    const out: Q[] = []
    const used = new Set<string>()
    outer: for (const a of pool) {
      if (used.has(a.name)) continue
      for (const b of pool) {
        if (b === a || used.has(b.name)) continue
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (d < 30000 || d > 220000) continue
        const from = snap(data, graph, a.x, a.y, 3000)
        const to = snap(data, graph, b.x, b.y, 3000)
        if (from === null || to === null || from === to) continue
        const r = route(graph, from, to)
        if (!r || r.lengthM < 20000) continue
        out.push({ a, b, km: Math.round(r.lengthM / 1000), path: r.path })
        used.add(a.name)
        used.add(b.name)
        if (out.length >= QUESTION_COUNT) break outer
        continue outer
      }
    }
    setQuestions(out)
    setQStart(Date.now())
  }, [graph, data, session.seed, session.province])

  useEffect(() => {
    if (q) mapRef.current?.flyToBounds(boundsOfPoints([[q.a.x, q.a.y], [q.b.x, q.b.y]], 25000), 60)
  }, [q])

  const answer = (km: number | null) => {
    if (!q || phase !== 'ask') return
    const base = km === null ? { points: 0, grade: 'bad' as const } : distancePoints(km, q.km)
    const bonus = base.grade === 'good' ? timeBonus(remaining, limitMs) : 0
    const points = Math.round((base.points + bonus) * VARIANT_MULT[session.variant])
    const detail = km === null ? t('timeUp') : t('distanceReveal', { actual: q.km, guess: km })
    setResults((r) => [...r, { label: `${q.a.name} > ${q.b.name}`, grade: base.grade, points, ms: Date.now() - qStart, detail }])
    setFeedback({ grade: base.grade, points, actual: q.km, guess: km ?? 0 })
    if (base.grade === 'good') {
      sfx.correct()
      haptic(20)
    } else if (base.grade === 'partial') sfx.tap()
    else {
      sfx.wrong()
      haptic([30, 40, 30])
    }
    setPhase('reveal')
  }

  useEffect(() => {
    if (limitMs && phase === 'ask' && questions && remaining <= 0) answer(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, limitMs, phase, questions])

  const secsLeft = Math.ceil(remaining / 1000)
  useEffect(() => {
    if (limitMs && phase === 'ask' && secsLeft <= 5 && secsLeft > 0) sfx.tick()
  }, [secsLeft, limitMs, phase])

  useTimeout(
    phase === 'reveal'
      ? () => {
          if (!questions || i + 1 >= questions.length) {
            onFinish({ ...session, results, finishedAt: Date.now() })
            return
          }
          setI(i + 1)
          setGuess(100)
          setFeedback(null)
          setPhase('ask')
          setQStart(Date.now())
        }
      : null,
    2800,
    phase + i,
  )

  const markers: Marker[] = q ? [{ x: q.a.x, y: q.a.y, kind: 'guess', label: q.a.name }, { x: q.b.x, y: q.b.y, kind: 'answer', label: q.b.name }] : []

  return (
    <div className="game">
      <HUD
        mode={t(`mode_${session.mode}`)}
        index={i}
        total={questions?.length ?? QUESTION_COUNT}
        grades={results.map((r) => r.grade)}
        score={score}
        remainingMs={remaining}
        limitMs={limitMs}
        elapsedMs={limitMs ? undefined : now - session.startedAt}
        onQuit={onQuit}
        prompt={
          <div className="prompt-col">
            <span className="prompt-text">{t('distancePrompt')}</span>
            {q && (
              <strong className="prompt-name">
                {q.a.name} <span className="prompt-arrow">{'>'}</span> {q.b.name}
              </strong>
            )}
          </div>
        }
      />
      <MapView ref={mapRef} data={data} tier={session.tier} mirror={session.variant === 'mirror'} markers={markers} paths={phase === 'reveal' && q ? [q.path] : []} labels={false} showJunctions lockZoom={session.variant === 'nozoom'} hideRoads={session.variant === 'blind'} intro>
        {!questions && <div className="toast">{t('buildingGraph')}</div>}
        {questions && phase === 'ask' && (
          <div className="distance-panel">
            <Matrix value={guess} label="km" />
            <input type="range" className="distance-slider" min={MIN_KM} max={MAX_KM} step={1} value={guess} aria-label={t('distancePrompt')} onChange={(e) => setGuess(Number(e.target.value))} />
            <button type="button" className="btn btn-primary" onClick={() => answer(guess)}>
              {t('answer')}
            </button>
          </div>
        )}
        {feedback && (
          <div role="status" className={`feedback feedback-${feedback.grade === 'good' ? 'ok' : feedback.grade === 'partial' ? 'mid' : 'bad'}`}>
            {t('distanceReveal', { actual: feedback.actual, guess: feedback.guess })} (+{feedback.points})
          </div>
        )}
      </MapView>
    </div>
  )
}
