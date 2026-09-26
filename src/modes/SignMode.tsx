import { useEffect, useMemo, useState } from 'react'
import type { Road } from '../data'
import { roadsForTier } from '../data'
import { useLang } from '../i18n'
import { HUD } from '../ui/HUD'
import { Shield } from '../ui/Shield'
import { DirectionSign } from '../ui/DirectionSign'
import { mulberry32, QUESTION_COUNT, quizOptions, shuffle, streakBonus, TIME_LIMITS, timeBonus, VARIANT_MULT, type QuestionResult } from '../game/session'
import { buildSignQuestions } from '../game/signs'
import { useNow, useTimeout } from '../game/hooks'
import { haptic, sfx } from '../game/sound'
import type { ModeProps } from './types'

/** Read the blue sign at an interchange and say which road you are on. */
export function SignMode({ data, session, onFinish, onQuit }: ModeProps) {
  const { t } = useLang()
  const questions = useMemo(() => {
    const rng = mulberry32(session.seed)
    const pool = shuffle(roadsForTier(data, session.tier, session.province), rng)
    return buildSignQuestions(data, pool, rng, QUESTION_COUNT).map((q) => ({ ...q, options: quizOptions(data, session.tier, q.road, rng, session.province) }))
  }, [data, session.tier, session.seed, session.province])
  const [i, setI] = useState(0)
  const [results, setResults] = useState<QuestionResult[]>([])
  const [phase, setPhase] = useState<'ask' | 'reveal'>('ask')
  const [qStart, setQStart] = useState(() => Date.now())
  const [chosen, setChosen] = useState<string | null>(null)
  const now = useNow(true)
  const limitMs = session.timer ? TIME_LIMITS.sign * 1000 : 0
  const remaining = limitMs ? Math.max(0, qStart + limitMs - now) : 0
  const q = questions[i]
  const score = results.reduce((a, r) => a + r.points, 0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (n >= 1 && n <= 4 && phase === 'ask' && q) answer(q.options[n - 1] ?? null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, q])

  const answer = (pick: Road | null) => {
    if (phase !== 'ask' || !q) return
    const ok = pick?.ref === q.road.ref
    const points = ok ? Math.round((100 + timeBonus(remaining, limitMs) + streakBonus(results)) * VARIANT_MULT[session.variant]) : 0
    setResults((r) => [...r, { label: q.road.ref, grade: ok ? 'good' : 'bad', points, ms: Date.now() - qStart, detail: ok ? undefined : pick ? t('youPicked', { ref: pick.ref }) : t('timeUp') }])
    setChosen(pick?.ref ?? '')
    if (ok) {
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
          setChosen(null)
          setPhase('ask')
          setQStart(Date.now())
        }
      : null,
    chosen === q?.road.ref ? 1000 : 1600,
    phase + i,
  )

  if (!q) return null

  return (
    <div className="game">
      <HUD index={i} total={questions.length} grades={results.map((r) => r.grade)} score={score} remainingMs={remaining} limitMs={limitMs} elapsedMs={limitMs ? undefined : now - session.startedAt} onQuit={onQuit} prompt={<span className="prompt-text">{t('signPrompt')}</span>} />
      <div className="sign-stage">
        <div className="sign-gantry">
          <DirectionSign junction={q.junction.name} ahead={q.ahead} exit={q.exit} />
          <div className="sign-poles" aria-hidden>
            <span />
            <span />
          </div>
        </div>
      </div>
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
