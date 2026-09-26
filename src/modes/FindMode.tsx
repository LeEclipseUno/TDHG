import { useEffect, useMemo, useRef, useState } from 'react'
import MapView, { type Highlight, type MapHandle, type PlacedShield, type Pulse, type TapInfo } from '../map/MapView'
import { haptic, sfx } from '../game/sound'
import { tierIncludes } from '../data'
import { useLang } from '../i18n'
import { HUD } from '../ui/HUD'
import { Shield } from '../ui/Shield'
import { BLITZ_BONUS_MS, BLITZ_MS, mulberry32, pickRoads, QUESTION_COUNT, roadsFromPicks, shuffle, streakBonus, TIME_LIMITS, timeBonus, VARIANT_MULT, type QuestionResult } from '../game/session'
import { roadsForTier } from '../data'
import { useNow, useTimeout, useToast } from '../game/hooks'
import type { ModeProps } from './types'

export function FindMode({ data, session, onFinish, onQuit }: ModeProps) {
  const { t } = useLang()
  const mapRef = useRef<MapHandle>(null)
  const blitz = session.variant === 'blitz'
  const questions = useMemo(() => (blitz ? shuffle(roadsForTier(data, session.tier, session.province), mulberry32(session.seed)) : session.picks ? roadsFromPicks(data, session.picks) : pickRoads(data, session.tier, QUESTION_COUNT, mulberry32(session.seed), session.province)), [data, session.tier, session.seed, blitz, session.picks, session.province])
  const [i, setI] = useState(0)
  const [results, setResults] = useState<QuestionResult[]>([])
  const [phase, setPhase] = useState<'ask' | 'reveal'>('ask')
  const [qStart, setQStart] = useState(() => Date.now())
  const [highlights, setHighlights] = useState<Record<string, Highlight>>({})
  const [shields, setShields] = useState<PlacedShield[]>([])
  const [solved, setSolved] = useState<PlacedShield[]>([]) // correct answers stay on the map for the whole round
  const [pulses, setPulses] = useState<Pulse[]>([])
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null)
  const [toast, showToast] = useToast()
  const now = useNow(true)
  const [deadline, setDeadline] = useState(() => Date.now() + BLITZ_MS)
  const limitMs = blitz ? BLITZ_MS : session.timer ? TIME_LIMITS.find * 1000 : 0
  const remaining = blitz ? Math.max(0, deadline - now) : limitMs ? Math.max(0, qStart + limitMs - now) : 0
  const target = questions[i]
  const score = results.reduce((a, r) => a + r.points, 0)

  const answer = (hitRef: string | null, hitPt?: { x: number; y: number }) => {
    if (phase !== 'ask') return
    const ok = hitRef === target.ref
    const ms = Date.now() - qStart
    const points = ok ? Math.round((100 + (blitz ? 0 : timeBonus(remaining, limitMs)) + streakBonus(results)) * VARIANT_MULT[session.variant]) : 0
    if (ok && blitz) setDeadline((d) => d + BLITZ_BONUS_MS)
    const res: QuestionResult = { label: target.ref, grade: ok ? 'good' : 'bad', points, ms, detail: ok ? undefined : hitRef ? t('thatWas', { ref: hitRef }) : t('timeUp') }
    setResults((r) => [...r, res])
    // A wrong tap only shows what was hit; the correct road stays hidden.
    const hl: Record<string, Highlight> = {}
    const sh: PlacedShield[] = []
    if (ok && hitPt) {
      setSolved((s) => [...s, { ref: target.ref, x: hitPt.x, y: hitPt.y, state: 'correct', born: Date.now() }])
      setPulses((p) => [...p.slice(-4), { x: hitPt.x, y: hitPt.y, t0: Date.now() }])
      const streak = streakBonus(results)
      if (streak > 0) sfx.combo(streak / 10)
      else sfx.correct()
      haptic(20)
    } else {
      sfx.wrong()
      haptic([30, 40, 30])
    }
    if (!ok && hitRef && hitPt) {
      hl[hitRef] = 'wrong'
      sh.push({ ref: hitRef, x: hitPt.x, y: hitPt.y, state: 'wrong' })
    }
    setHighlights(hl)
    setShields(sh)
    setFeedback({ text: ok ? t('correct') : hitRef ? `${t('wrong')} ${t('thatWas', { ref: hitRef })}` : t('timeUp'), ok })
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
          const all = results
          if (i + 1 >= questions.length) {
            onFinish({ ...session, results: all, finishedAt: Date.now() })
            return
          }
          setI(i + 1)
          setHighlights({})
          setShields([])
          setFeedback(null)
          setPhase('ask')
          setQStart(Date.now())
        }
      : null,
    blitz ? 500 : feedback?.ok ? 1100 : 1800,
    phase + i,
  )

  const onTap = (tap: TapInfo) => {
    if (phase !== 'ask') return
    const hit = data.index.nearest(tap.x, tap.y, 28 / tap.scale, (r) => tierIncludes(session.tier, r.kind))
    if (!hit) {
      showToast(t('noRoad'))
      return
    }
    answer(hit.road.ref, { x: hit.px, y: hit.py })
  }

  const allHighlights: Record<string, Highlight> = { ...highlights }
  for (const s of solved) allHighlights[s.ref] = 'correct'
  const allShields = [...solved, ...shields]

  return (
    <div className="game">
      <HUD
        index={i}
        total={blitz ? Math.max(10, results.length + 1) : questions.length}
        grades={results.map((r) => r.grade)}
        score={score}
        remainingMs={remaining}
        limitMs={limitMs}
        elapsedMs={limitMs ? undefined : now - session.startedAt}
        onQuit={onQuit}
        prompt={
          <div className="prompt-row">
            <span className="prompt-text">{t('findPrompt')}</span>
            <Shield code={target.ref} kind={target.kind} size="lg" />
          </div>
        }
      />
      <MapView ref={mapRef} data={data} tier={session.tier} highlights={allHighlights} shields={allShields} pulses={pulses} onTap={onTap} lockZoom={session.variant === 'nozoom'} hideRoads={session.variant === 'blind'} intro>
        {feedback && <div role="status" className={'feedback ' + (feedback.ok ? 'feedback-ok' : 'feedback-bad')}>{feedback.text}</div>}
        {toast && <div role="status" className="toast">{toast}</div>}
      </MapView>
    </div>
  )
}
