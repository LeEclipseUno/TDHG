import { useEffect, useMemo, useRef, useState } from 'react'
import MapView, { type MapHandle, type Marker, type TapInfo } from '../map/MapView'
import { boundsOfPoints } from '../data'
import { useLang } from '../i18n'
import { HUD } from '../ui/HUD'
import { IconHint } from '../ui/icons'
import { HINT_COST, junctionPoints, mulberry32, pickJunctions, QUESTION_COUNT, TIME_LIMITS, timeBonus, type QuestionResult } from '../game/session'
import { useNow, useTimeout } from '../game/hooks'
import type { ModeProps } from './types'

export function JunctionMode({ data, session, onFinish, onQuit }: ModeProps) {
  const { t } = useLang()
  const mapRef = useRef<MapHandle>(null)
  const questions = useMemo(() => pickJunctions(data, QUESTION_COUNT, mulberry32(session.seed)), [data, session.seed])
  const [i, setI] = useState(0)
  const [results, setResults] = useState<QuestionResult[]>([])
  const [phase, setPhase] = useState<'ask' | 'reveal'>('ask')
  const [qStart, setQStart] = useState(() => Date.now())
  const [hint, setHint] = useState(false)
  const [guess, setGuess] = useState<{ x: number; y: number } | null>(null)
  const [feedback, setFeedback] = useState<{ text: string; grade: 'good' | 'partial' | 'bad' } | null>(null)
  const now = useNow(true)
  const limitMs = session.timer ? TIME_LIMITS.junction * 1000 : 0
  const remaining = limitMs ? Math.max(0, qStart + limitMs - now) : 0
  const q = questions[i]
  const score = results.reduce((a, r) => a + r.points, 0)

  const answer = (pt: { x: number; y: number } | null) => {
    if (phase !== 'ask') return
    const dist = pt ? Math.hypot(pt.x - q.x, pt.y - q.y) : Infinity
    const base = pt ? junctionPoints(dist) : { points: 0, grade: 'bad' as const }
    const bonus = base.grade === 'good' ? timeBonus(remaining, limitMs) : 0
    const points = Math.max(0, base.points + bonus - (hint ? HINT_COST : 0))
    const km = dist === Infinity ? null : Math.round(dist / 100) / 10
    const detail = km === null ? t('timeUp') : km < 0.8 ? t('spotOn') : t('distanceOff', { km })
    setResults((r) => [...r, { label: q.name, grade: base.grade, points, ms: Date.now() - qStart, detail }])
    setGuess(pt)
    setFeedback({ text: `${detail} (+${points})`, grade: base.grade })
    setPhase('reveal')
    // Only a decent guess reveals where the interchange really is.
    if (pt && base.grade !== 'bad') mapRef.current?.flyToBounds(boundsOfPoints([[q.x, q.y], [pt.x, pt.y]], 3000), 60)
  }

  useEffect(() => {
    if (limitMs && phase === 'ask' && remaining <= 0) answer(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, limitMs, phase])

  useTimeout(
    phase === 'reveal'
      ? () => {
          if (i + 1 >= questions.length) {
            onFinish({ ...session, results, finishedAt: Date.now() })
            return
          }
          setI(i + 1)
          setGuess(null)
          setHint(false)
          setFeedback(null)
          setPhase('ask')
          setQStart(Date.now())
        }
      : null,
    2600,
    phase + i,
  )

  const onTap = (tap: TapInfo) => answer({ x: tap.x, y: tap.y })

  const markers: Marker[] = []
  const lines: [number, number, number, number][] = []
  if (phase === 'reveal') {
    const revealed = results[results.length - 1]?.grade !== 'bad'
    if (revealed) markers.push({ x: q.x, y: q.y, kind: 'answer', label: q.name })
    if (guess) {
      markers.push({ x: guess.x, y: guess.y, kind: 'guess' })
      if (revealed) lines.push([guess.x, guess.y, q.x, q.y])
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
              <span className="prompt-text">
                {t('junctionPrompt')} <strong className="prompt-name">{q.name}</strong>?
              </span>
              {phase === 'ask' && !hint && q.roads.length > 0 && (
                <button type="button" className="btn btn-small" onClick={() => setHint(true)}>
                  <IconHint /> {t('hint')} <small>{t('hintCost')}</small>
                </button>
              )}
            </div>
            {hint && <span className="prompt-hint">{t('hintText', { roads: q.roads.join(', ') })}</span>}
            {!hint && i === 0 && phase === 'ask' && <span className="prompt-hint">{t('zoomTip')}</span>}
          </div>
        }
      />
      <MapView ref={mapRef} data={data} tier={session.tier} markers={markers} lines={lines} onTap={phase === 'ask' ? onTap : undefined}>
        {feedback && <div role="status" className={`feedback feedback-${feedback.grade === 'good' ? 'ok' : feedback.grade === 'partial' ? 'mid' : 'bad'}`}>{feedback.text}</div>}
      </MapView>
    </div>
  )
}
