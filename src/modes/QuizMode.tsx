import { useEffect, useMemo, useRef, useState } from 'react'
import MapView, { type Highlight, type MapHandle, type PlacedShield } from '../map/MapView'
import type { Road } from '../data'
import { useLang } from '../i18n'
import { HUD } from '../ui/HUD'
import { Shield } from '../ui/Shield'
import { mulberry32, pickRoads, QUESTION_COUNT, quizOptions, streakBonus, TIME_LIMITS, timeBonus, type QuestionResult } from '../game/session'
import { useNow, useTimeout } from '../game/hooks'
import type { ModeProps } from './types'

export function QuizMode({ data, session, onFinish, onQuit }: ModeProps) {
  const { t } = useLang()
  const mapRef = useRef<MapHandle>(null)
  const questions = useMemo(() => {
    const rng = mulberry32(session.seed)
    return pickRoads(data, session.tier, QUESTION_COUNT, rng).map((road) => ({ road, options: quizOptions(data, session.tier, road, rng) }))
  }, [data, session.tier, session.seed])
  const [i, setI] = useState(0)
  const [results, setResults] = useState<QuestionResult[]>([])
  const [phase, setPhase] = useState<'ask' | 'reveal'>('ask')
  const [qStart, setQStart] = useState(() => Date.now())
  const [chosen, setChosen] = useState<string | null>(null)
  const now = useNow(true)
  const limitMs = session.timer ? TIME_LIMITS.quiz * 1000 : 0
  const remaining = limitMs ? Math.max(0, qStart + limitMs - now) : 0
  const q = questions[i]
  const score = results.reduce((a, r) => a + r.points, 0)

  useEffect(() => {
    const b = q.road.bbox
    mapRef.current?.flyToBounds({ x0: b[0], y0: b[1], x1: b[2], y1: b[3] }, 50)
  }, [q])

  const answer = (pick: Road | null) => {
    if (phase !== 'ask') return
    const ok = pick?.ref === q.road.ref
    const points = ok ? 100 + timeBonus(remaining, limitMs) + streakBonus(results) : 0
    setResults((r) => [...r, { label: q.road.ref, grade: ok ? 'good' : 'bad', points, ms: Date.now() - qStart, detail: ok ? undefined : pick ? t('youPicked', { ref: pick.ref }) : t('timeUp') }])
    setChosen(pick?.ref ?? '')
    setPhase('reveal')
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
          setChosen(null)
          setPhase('ask')
          setQStart(Date.now())
        }
      : null,
    chosen === q.road.ref ? 1000 : 1600,
    phase + i,
  )

  const highlights: Record<string, Highlight> = { [q.road.ref]: phase === 'ask' ? 'active' : chosen === q.road.ref ? 'correct' : 'wrong' }
  // Only a correct answer reveals the sign on the map.
  const shields: PlacedShield[] = phase === 'reveal' && chosen === q.road.ref ? [{ ref: q.road.ref, x: q.road.anchor[0], y: q.road.anchor[1], state: 'correct' }] : []

  return (
    <div className="game">
      <HUD index={i} total={questions.length} grades={results.map((r) => r.grade)} score={score} remainingMs={remaining} limitMs={limitMs} elapsedMs={limitMs ? undefined : now - session.startedAt} onQuit={onQuit} prompt={<span className="prompt-text">{t('quizPrompt')}</span>} />
      <MapView ref={mapRef} data={data} tier={session.tier} highlights={highlights} shields={shields} />
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
