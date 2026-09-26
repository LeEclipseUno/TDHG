import { useEffect, useMemo, useRef, useState } from 'react'
import MapView, { type Highlight, type MapHandle, type MapLine, type Marker, type TapInfo } from '../map/MapView'
import { boundsOfPoints, tierIncludes, type Exit } from '../data'
import { useLang } from '../i18n'
import { HUD } from '../ui/HUD'
import { Shield } from '../ui/Shield'
import { mulberry32, QUESTION_COUNT, shuffle, TIME_LIMITS, timeBonus, VARIANT_MULT, type Grade, type QuestionResult } from '../game/session'
import { useNow, useTimeout } from '../game/hooks'
import { haptic, sfx } from '../game/sound'
import type { ModeProps } from './types'

function exitPoints(distM: number): { points: number; grade: Grade } {
  if (distM <= 1000) return { points: 100, grade: 'good' }
  if (distM <= 3000) return { points: 70, grade: 'good' }
  if (distM <= 8000) return { points: 40, grade: 'partial' }
  if (distM <= 15000) return { points: 15, grade: 'bad' }
  return { points: 0, grade: 'bad' }
}

/** Where is exit 12 "Utrecht-Noord" on the A27? The road is highlighted, the player taps the spot along it. */
export function ExitMode({ data, session, onFinish, onQuit }: ModeProps) {
  const { t } = useLang()
  const mapRef = useRef<MapHandle>(null)
  const questions = useMemo<Exit[]>(() => {
    const rng = mulberry32(session.seed)
    const pool = data.exits.filter((e) => {
      const r = data.byRef.get(e.road)
      return r && tierIncludes(session.tier, r.kind)
    })
    return shuffle(pool, rng).slice(0, QUESTION_COUNT)
  }, [data, session.tier, session.seed])
  const [i, setI] = useState(0)
  const [results, setResults] = useState<QuestionResult[]>([])
  const [phase, setPhase] = useState<'ask' | 'reveal'>('ask')
  const [qStart, setQStart] = useState(() => Date.now())
  const [guess, setGuess] = useState<{ x: number; y: number } | null>(null)
  const [feedback, setFeedback] = useState<{ km: number | null; grade: Grade; points: number; at: number } | null>(null)
  const now = useNow(true, 50)
  const limitMs = session.timer ? TIME_LIMITS.exit * 1000 : 0
  const remaining = limitMs ? Math.max(0, qStart + limitMs - now) : 0
  const q = questions[i]
  const road = data.byRef.get(q.road)
  const score = results.reduce((a, r) => a + r.points, 0)

  useEffect(() => {
    if (road) mapRef.current?.flyToBounds({ x0: road.bbox[0], y0: road.bbox[1], x1: road.bbox[2], y1: road.bbox[3] }, 50)
  }, [road])

  const answer = (pt: { x: number; y: number } | null) => {
    if (phase !== 'ask') return
    const dist = pt ? Math.hypot(pt.x - q.x, pt.y - q.y) : Infinity
    const base = pt ? exitPoints(dist) : { points: 0, grade: 'bad' as const }
    const bonus = base.grade === 'good' ? timeBonus(remaining, limitMs) : 0
    const points = Math.round((base.points + bonus) * VARIANT_MULT[session.variant])
    const km = dist === Infinity ? null : Math.round(dist / 100) / 10
    const detail = km === null ? t('timeUp') : km < 1 ? t('spotOn') : t('distanceOff', { km })
    setResults((r) => [...r, { label: `${q.n} (${q.road} ${q.r})`, grade: base.grade, points, ms: Date.now() - qStart, detail }])
    setGuess(pt)
    setFeedback({ km, grade: base.grade, points, at: Date.now() })
    if (base.grade === 'good') {
      sfx.correct()
      haptic(20)
    } else if (base.grade === 'partial') {
      sfx.tap()
    } else {
      sfx.wrong()
      haptic([30, 40, 30])
    }
    setPhase('reveal')
    if (pt && base.grade !== 'bad') mapRef.current?.flyToBounds(boundsOfPoints([[q.x, q.y], [pt.x, pt.y]], 2500), 60)
  }

  useEffect(() => {
    if (limitMs && phase === 'ask' && remaining <= 0) answer(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, limitMs, phase])

  const secsLeft = Math.ceil(remaining / 1000)
  useEffect(() => {
    if (limitMs && phase === 'ask' && secsLeft <= 5 && secsLeft > 0) sfx.tick()
  }, [secsLeft, limitMs, phase])

  useTimeout(
    phase === 'reveal'
      ? () => {
          if (i + 1 >= questions.length) {
            onFinish({ ...session, results, finishedAt: Date.now() })
            return
          }
          setI(i + 1)
          setGuess(null)
          setFeedback(null)
          setPhase('ask')
          setQStart(Date.now())
        }
      : null,
    2400,
    phase + i,
  )

  const highlights: Record<string, Highlight> = road ? { [road.ref]: 'active' } : {}
  const markers: Marker[] = []
  const lines: MapLine[] = []
  if (phase === 'reveal') {
    const revealed = results[results.length - 1]?.grade !== 'bad'
    if (revealed) markers.push({ x: q.x, y: q.y, kind: 'answer', label: `${q.r} ${q.n}` })
    if (guess) {
      markers.push({ x: guess.x, y: guess.y, kind: 'guess' })
      if (revealed) lines.push({ x0: guess.x, y0: guess.y, x1: q.x, y1: q.y, t0: feedback?.at })
    }
  }

  return (
    <div className="game">
      <HUD
        index={i}
        total={questions.length}
        grades={results.map((r) => r.grade)}
        score={score}
        remainingMs={remaining}
        limitMs={limitMs}
        elapsedMs={limitMs ? undefined : now - session.startedAt}
        onQuit={onQuit}
        prompt={
          <div className="prompt-col">
            <div className="prompt-row">
              <span className="prompt-text">{t('exitPrompt')}</span>
              <span className="exit-tag">
                <span className="exit-num">{q.r}</span>
                <strong className="prompt-name">{q.n}</strong>
              </span>
              {road && <Shield code={road.ref} kind={road.kind} size="md" />}
            </div>
          </div>
        }
      />
      <MapView
        ref={mapRef}
        data={data}
        tier={session.tier}
        highlights={highlights}
        markers={markers}
        lines={lines}
        labels={false}
        lockZoom={session.variant === 'nozoom'}
        hideRoads={session.variant === 'blind'}
        onTap={phase === 'ask' ? (tap: TapInfo) => answer({ x: tap.x, y: tap.y }) : undefined}
        intro
      >
        {feedback && (
          <div role="status" className={`feedback feedback-${feedback.grade === 'good' ? 'ok' : feedback.grade === 'partial' ? 'mid' : 'bad'}`}>
            {feedback.km === null ? t('timeUp') : feedback.km < 1 ? t('spotOn') : t('distanceOff', { km: (Math.round(feedback.km * Math.min(1, (now - feedback.at) / 700) * 10) / 10).toFixed(1) })} (+{feedback.points})
          </div>
        )}
      </MapView>
    </div>
  )
}
