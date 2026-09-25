import { useEffect, useMemo, useRef, useState } from 'react'
import MapView, { type Highlight, type MapHandle, type PlacedShield, type TapInfo } from '../map/MapView'
import { tierIncludes } from '../data'
import { useLang } from '../i18n'
import { HUD } from '../ui/HUD'
import { Shield } from '../ui/Shield'
import { mulberry32, pickRoads, QUESTION_COUNT, streakBonus, TIME_LIMITS, timeBonus, type QuestionResult } from '../game/session'
import { useNow, useTimeout, useToast } from '../game/hooks'
import type { ModeProps } from './types'

export function FindMode({ data, session, onFinish, onQuit }: ModeProps) {
  const { t } = useLang()
  const mapRef = useRef<MapHandle>(null)
  const questions = useMemo(() => pickRoads(data, session.tier, QUESTION_COUNT, mulberry32(session.seed)), [data, session.tier, session.seed])
  const [i, setI] = useState(0)
  const [results, setResults] = useState<QuestionResult[]>([])
  const [phase, setPhase] = useState<'ask' | 'reveal'>('ask')
  const [qStart, setQStart] = useState(() => Date.now())
  const [highlights, setHighlights] = useState<Record<string, Highlight>>({})
  const [shields, setShields] = useState<PlacedShield[]>([])
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null)
  const [toast, showToast] = useToast()
  const now = useNow(true)
  const limitMs = session.timer ? TIME_LIMITS.find * 1000 : 0
  const remaining = limitMs ? Math.max(0, qStart + limitMs - now) : 0
  const target = questions[i]
  const score = results.reduce((a, r) => a + r.points, 0)

  const answer = (hitRef: string | null, hitPt?: { x: number; y: number }) => {
    if (phase !== 'ask') return
    const ok = hitRef === target.ref
    const ms = Date.now() - qStart
    const points = ok ? 100 + timeBonus(remaining, limitMs) + streakBonus(results) : 0
    const res: QuestionResult = { label: target.ref, grade: ok ? 'good' : 'bad', points, ms, detail: ok ? undefined : hitRef ? t('thatWas', { ref: hitRef }) : t('timeUp') }
    setResults((r) => [...r, res])
    const hl: Record<string, Highlight> = { [target.ref]: ok ? 'correct' : 'active' }
    const sh: PlacedShield[] = [{ ref: target.ref, x: hitPt && ok ? hitPt.x : target.anchor[0], y: hitPt && ok ? hitPt.y : target.anchor[1], state: ok ? 'correct' : 'neutral' }]
    if (!ok && hitRef && hitPt) {
      hl[hitRef] = 'wrong'
      sh.push({ ref: hitRef, x: hitPt.x, y: hitPt.y, state: 'wrong' })
    }
    setHighlights(hl)
    setShields(sh)
    setFeedback({ text: ok ? t('correct') : hitRef ? `${t('wrong')} ${t('thatWas', { ref: hitRef })}` : t('timeUp'), ok })
    setPhase('reveal')
    if (!ok) mapRef.current?.flyToBounds({ x0: target.bbox[0], y0: target.bbox[1], x1: target.bbox[2], y1: target.bbox[3] }, 60)
  }

  useEffect(() => {
    if (limitMs && phase === 'ask' && remaining <= 0) answer(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, limitMs, phase])

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
    feedback?.ok ? 1100 : 1800,
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
          <div className="prompt-row">
            <span className="prompt-text">{t('findPrompt')}</span>
            <Shield code={target.ref} kind={target.kind} size="lg" />
          </div>
        }
      />
      <MapView ref={mapRef} data={data} tier={session.tier} highlights={highlights} shields={shields} onTap={onTap}>
        {feedback && <div className={'feedback ' + (feedback.ok ? 'feedback-ok' : 'feedback-bad')}>{feedback.text}</div>}
        {toast && <div className="toast">{toast}</div>}
      </MapView>
    </div>
  )
}
