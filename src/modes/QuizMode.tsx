import { useEffect, useMemo, useRef, useState } from 'react'
import MapView, { type Highlight, type MapHandle, type PlacedShield } from '../map/MapView'
import type { Road } from '../data'
import { useLang } from '../i18n'
import { HUD } from '../ui/HUD'
import { Shield } from '../ui/Shield'
import { BLITZ_BONUS_MS, BLITZ_MS, mulberry32, pickRoads, QUESTION_COUNT, quizOptions, shuffle, streakBonus, TIME_LIMITS, timeBonus, VARIANT_MULT, type QuestionResult } from '../game/session'
import { roadsForTier } from '../data'
import { useNow, useTimeout } from '../game/hooks'
import { haptic, sfx } from '../game/sound'
import type { ModeProps } from './types'

export function QuizMode({ data, session, onFinish, onQuit }: ModeProps) {
  const { t } = useLang()
  const mapRef = useRef<MapHandle>(null)
  const blitz = session.variant === 'blitz'
  const questions = useMemo(() => {
    const rng = mulberry32(session.seed)
    const roads = blitz ? shuffle(roadsForTier(data, session.tier), rng) : pickRoads(data, session.tier, QUESTION_COUNT, rng)
    return roads.map((road) => ({ road, options: quizOptions(data, session.tier, road, rng) }))
  }, [data, session.tier, session.seed, blitz])
  const [i, setI] = useState(0)
  const [results, setResults] = useState<QuestionResult[]>([])
  const [phase, setPhase] = useState<'ask' | 'reveal'>('ask')
  const [qStart, setQStart] = useState(() => Date.now())
  const [chosen, setChosen] = useState<string | null>(null)
  const [solved, setSolved] = useState<Road[]>([]) // correct answers stay green for the whole round
  const now = useNow(true)
  const [deadline, setDeadline] = useState(() => Date.now() + BLITZ_MS)
  const limitMs = blitz ? BLITZ_MS : session.timer ? TIME_LIMITS.quiz * 1000 : 0
  const remaining = blitz ? Math.max(0, deadline - now) : limitMs ? Math.max(0, qStart + limitMs - now) : 0
  const q = questions[i]
  const score = results.reduce((a, r) => a + r.points, 0)

  useEffect(() => {
    const b = q.road.bbox
    mapRef.current?.flyToBounds({ x0: b[0], y0: b[1], x1: b[2], y1: b[3] }, 50)
  }, [q])

  // Keyboard: 1 to 4 pick an option.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (n >= 1 && n <= 4 && phase === 'ask') answer(q.options[n - 1] ?? null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, q])

  const answer = (pick: Road | null) => {
    if (phase !== 'ask') return
    const ok = pick?.ref === q.road.ref
    const points = ok ? Math.round((100 + (blitz ? 0 : timeBonus(remaining, limitMs)) + streakBonus(results)) * VARIANT_MULT[session.variant]) : 0
    if (ok && blitz) setDeadline((d) => d + BLITZ_BONUS_MS)
    setResults((r) => [...r, { label: q.road.ref, grade: ok ? 'good' : 'bad', points, ms: Date.now() - qStart, detail: ok ? undefined : pick ? t('youPicked', { ref: pick.ref }) : t('timeUp') }])
    setChosen(pick?.ref ?? '')
    if (ok) {
      setSolved((s) => [...s, q.road])
      const streak = streakBonus(results)
      if (streak > 0) sfx.combo(streak / 10)
      else sfx.correct()
      haptic(20)
    } else {
      sfx.wrong()
      haptic([30, 40, 30])
    }
    setPhase('reveal')
  }

  useEffect(() => {
    if (limitMs && phase === 'ask' && remaining <= 0) {
      if (blitz) onFinish({ ...session, results, finishedAt: Date.now() })
      else answer(null)
    }
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
          setChosen(null)
          setPhase('ask')
          setQStart(Date.now())
        }
      : null,
    blitz ? 450 : chosen === q.road.ref ? 1000 : 1600,
    phase + i,
  )

  const highlights: Record<string, Highlight> = {}
  for (const r of solved) highlights[r.ref] = 'correct'
  highlights[q.road.ref] = phase === 'ask' ? 'active' : chosen === q.road.ref ? 'correct' : 'wrong'
  // Only correct answers get their sign on the map, and they keep it for the rest of the round.
  const shields: PlacedShield[] = solved.map((r, idx) => ({ ref: r.ref, x: r.anchor[0], y: r.anchor[1], state: 'correct', born: idx === solved.length - 1 ? qStart + 1 : undefined }))

  return (
    <div className="game">
      <HUD index={i} total={blitz ? Math.max(10, results.length + 1) : questions.length} grades={results.map((r) => r.grade)} score={score} remainingMs={remaining} limitMs={limitMs} elapsedMs={limitMs ? undefined : now - session.startedAt} onQuit={onQuit} prompt={<span className="prompt-text">{t('quizPrompt')}</span>} />
      <MapView ref={mapRef} data={data} tier={session.tier} highlights={highlights} shields={shields} lockZoom={session.variant === 'nozoom'} hideRoads={session.variant === 'blind'} />
      <div className="options">
        {q.options.map((o) => {
          let cls = 'option'
          if (phase === 'reveal') {
            if (o.ref === chosen) cls += o.ref === q.road.ref ? ' option-correct' : ' option-wrong'
            else cls += ' option-dim'
          }
          return (
            <button key={o.ref} type="button" className={cls} onClick={() => answer(o)} disabled={phase !== 'ask'}>
              <span className="option-inner">
                <Shield code={o.ref} kind={o.kind} size="lg" />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
