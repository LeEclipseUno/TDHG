import { useEffect, useMemo, useRef, useState } from 'react'
import MapView, { type Highlight, type MapHandle, type Marker, type PlacedShield, type TapInfo } from '../map/MapView'
import { boundsOfPoints, tierIncludes, type GameData, type Road } from '../data'
import { useLang } from '../i18n'
import { HUD } from '../ui/HUD'
import { Shield } from '../ui/Shield'
import { Board } from '../ui/widgets'
import { IconMenu, IconReplay, IconSignArrow } from '../ui/icons'
import { quizOptions, type Grade, type Settings } from '../game/session'
import { useNow, useToast } from '../game/hooks'
import { applyReview, buildDeck, deckStats, loadStates, pickSession, ratingFor, type Card, type CardStates } from '../game/learn'
import { formatDue, type CardState, type Rating } from '../game/fsrs'

interface Props {
  data: GameData
  settings: Settings
  onExit: () => void
}

const roadBounds = (r: Road) => ({ x0: r.bbox[0], y0: r.bbox[1], x1: r.bbox[2], y1: r.bbox[3] })
const gradeOf = (r: Rating): Grade => (r === 1 ? 'bad' : r === 2 ? 'partial' : 'good')

/** Spaced repetition practice: every card is answered on the map, the answer is always revealed, and FSRS decides when it comes back. */
export function LearnMode({ data, settings, onExit }: Props) {
  const { t, lang } = useLang()
  const mapRef = useRef<MapHandle>(null)
  const statesRef = useRef<CardStates>(loadStates())
  const deck = useMemo(() => buildDeck(data, settings.tier, settings.learnDeck), [data, settings.tier, settings.learnDeck])
  const [queue, setQueue] = useState<Card[]>(() => pickSession(deck, statesRef.current))
  const [i, setI] = useState(0)
  const [grades, setGrades] = useState<Grade[]>([])
  const [phase, setPhase] = useState<'ask' | 'reveal' | 'done'>(() => (queue.length ? 'ask' : 'done'))
  const [qStart, setQStart] = useState(() => Date.now())
  const [chosen, setChosen] = useState<string | null>(null)
  const [guess, setGuess] = useState<{ x: number; y: number } | null>(null)
  const [hitShield, setHitShield] = useState<PlacedShield | null>(null)
  const [outcome, setOutcome] = useState<{ rating: Rating; state: CardState; correct: boolean } | null>(null)
  const [solved, setSolved] = useState<Road[]>([]) // correctly answered roads stay green during the session
  const [toast, showToast] = useToast()
  const now = useNow(phase === 'ask', 500)

  const card = queue[i] as Card | undefined
  const road = card?.ref ? data.byRef.get(card.ref) : undefined
  const junction = card?.junction ? data.junctions.find((j) => j.name === card.junction) : undefined
  const options = useMemo(() => (card?.kind === 'rec' && road ? quizOptions(data, settings.tier, road, Math.random) : []), [card, road, data, settings.tier])
  const correctCount = grades.filter((g) => g !== 'bad').length

  useEffect(() => {
    if (phase === 'ask' && card?.kind === 'rec' && road) mapRef.current?.flyToBounds(roadBounds(road), 50)
  }, [phase, card, road])

  const finishCard = (correct: boolean, guessPt?: { x: number; y: number }) => {
    if (!card || phase !== 'ask') return
    const rating = ratingFor(correct, Date.now() - qStart)
    const state = applyReview(statesRef.current, card, rating)
    setOutcome({ rating, state, correct })
    if (correct && road && !solved.includes(road)) setSolved((s) => [...s, road])
    setGrades((g) => [...g, gradeOf(rating)])
    setPhase('reveal')
    if (rating === 1) setQueue((q) => [...q, card]) // relearn at the end of this session
    if (card.kind === 'loc' && road) mapRef.current?.flyToBounds(roadBounds(road), 60)
    if (junction) mapRef.current?.flyToBounds(boundsOfPoints(guessPt ? [[junction.x, junction.y], [guessPt.x, guessPt.y]] : [[junction.x, junction.y]], 4000), 60)
  }

  const next = () => {
    if (i + 1 >= queue.length) {
      setPhase('done')
      return
    }
    setI(i + 1)
    setChosen(null)
    setGuess(null)
    setHitShield(null)
    setOutcome(null)
    setPhase('ask')
    setQStart(Date.now())
  }

  const restart = () => {
    const q = pickSession(deck, statesRef.current)
    setQueue(q)
    setI(0)
    setGrades([])
    setChosen(null)
    setGuess(null)
    setHitShield(null)
    setOutcome(null)
    setPhase(q.length ? 'ask' : 'done')
    setQStart(Date.now())
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (card?.kind === 'rec' && phase === 'ask' && n >= 1 && n <= options.length) {
        setChosen(options[n - 1].ref)
        finishCard(options[n - 1].ref === card.ref)
      }
      if (e.key === 'Enter' && phase === 'reveal') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, phase, options])

  const onTap = (tap: TapInfo) => {
    if (!card || phase !== 'ask') return
    if (card.kind === 'loc') {
      const hit = data.index.nearest(tap.x, tap.y, 28 / tap.scale, (r) => tierIncludes(settings.tier, r.kind))
      if (!hit) {
        showToast(t('noRoad'))
        return
      }
      const ok = hit.road.ref === card.ref
      setHitShield({ ref: hit.road.ref, x: hit.px, y: hit.py, state: ok ? 'correct' : 'wrong' })
      finishCard(ok)
    } else if (card.kind === 'kp' && junction) {
      const pt = { x: tap.x, y: tap.y }
      setGuess(pt)
      finishCard(Math.hypot(pt.x - junction.x, pt.y - junction.y) <= 5000, pt)
    }
  }

  // ---- map overlays ----
  const highlights: Record<string, Highlight> = {}
  const shields: PlacedShield[] = []
  for (const r of solved) {
    if (r.ref === road?.ref) continue
    highlights[r.ref] = 'correct'
    shields.push({ ref: r.ref, x: r.anchor[0], y: r.anchor[1], state: 'correct' })
  }
  const markers: Marker[] = []
  const lines: [number, number, number, number][] = []
  if (road) {
    if (phase === 'ask' && card?.kind === 'rec') highlights[road.ref] = 'active'
    if (phase === 'reveal') {
      highlights[road.ref] = outcome?.correct ? 'correct' : 'active'
      if (hitShield && !outcome?.correct) {
        highlights[hitShield.ref] = 'wrong'
        shields.push(hitShield)
      }
      shields.push(hitShield && outcome?.correct ? hitShield : { ref: road.ref, x: road.anchor[0], y: road.anchor[1], state: outcome?.correct ? 'correct' : 'neutral' })
    }
  }
  if (junction && phase === 'reveal') {
    markers.push({ x: junction.x, y: junction.y, kind: 'answer', label: junction.name })
    if (guess) {
      markers.push({ x: guess.x, y: guess.y, kind: 'guess' })
      lines.push([guess.x, guess.y, junction.x, junction.y])
    }
  }

  if (phase === 'done') {
    const stats = deckStats(deck, statesRef.current)
    const more = pickSession(deck, statesRef.current).length > 0
    return (
      <div className="results">
        <div className="results-inner">
          <Board className="results-board">
            <div className="board-title">{t('sessionDone')}</div>
            <div className="learn-stats">
              <div>
                <span className="stat-value">{grades.length}</span>
                <span className="stat-label">{t('reviewed')}</span>
              </div>
              <div>
                <span className="stat-value">{correctCount}</span>
                <span className="stat-label">{t('accuracy')}</span>
              </div>
              <div>
                <span className="stat-value">{stats.due}</span>
                <span className="stat-label">{t('due')}</span>
              </div>
              <div>
                <span className="stat-value">{stats.total - stats.seen}</span>
                <span className="stat-label">{t('newCards')}</span>
              </div>
              <div>
                <span className="stat-value">{stats.mature}</span>
                <span className="stat-label">{t('learned')}</span>
              </div>
              <div>
                <span className="stat-value">{stats.total}</span>
                <span className="stat-label">{t('cards')}</span>
              </div>
            </div>
            {!more && <p className="learn-note">{t('allDone')}</p>}
          </Board>
          <div className="results-actions">
            {more && (
              <button type="button" className="btn btn-primary" onClick={restart}>
                <IconReplay /> {t('anotherSession')}
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onExit}>
              <IconMenu /> {t('home')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const prompt =
    card?.kind === 'rec' ? (
      <span className="prompt-text">{t('quizPrompt')}</span>
    ) : card?.kind === 'loc' && road ? (
      <div className="prompt-row">
        <span className="prompt-text">{t('findPrompt')}</span>
        <Shield code={road.ref} kind={road.kind} size="lg" />
      </div>
    ) : (
      <span className="prompt-text">
        {t('junctionPrompt')} <strong className="prompt-name">{card?.junction}</strong>?
      </span>
    )

  return (
    <div className="game">
      <HUD index={i} total={queue.length} grades={grades} score={correctCount} scoreLabel={t('accuracy')} elapsedMs={now - qStart} onQuit={onExit} countLabel={t('cardCount', { n: i + 1, total: queue.length })} prompt={prompt} />
      <MapView ref={mapRef} data={data} tier={settings.tier} highlights={highlights} shields={shields} markers={markers} lines={lines} onTap={phase === 'ask' && card?.kind !== 'rec' ? onTap : undefined}>
        {toast && <div className="toast">{toast}</div>}
      </MapView>
      {phase === 'reveal' && outcome && (
        <div className="reveal-bar">
          <span className={`rating rating-${outcome.rating}`}>{t(`rating_${outcome.rating}`)}</span>
          <span className="reveal-answer">
            {road ? <Shield code={road.ref} kind={road.kind} size="sm" /> : <strong>{junction?.name}</strong>}
            {junction && junction.roads.length > 0 && <small>{junction.roads.join(', ')}</small>}
          </span>
          <span className="reveal-next">{t('nextIn', { ivl: formatDue(outcome.state, Date.now(), lang) })}</span>
          <button type="button" className="btn btn-small btn-primary" onClick={next}>
            {t('next')} <IconSignArrow />
          </button>
        </div>
      )}
      {card?.kind === 'rec' && (
        <div className="options">
          {options.map((o) => {
            let cls = 'option'
            if (phase === 'reveal') {
              if (o.ref === card.ref) cls += ' option-correct'
              else if (o.ref === chosen) cls += ' option-wrong'
              else cls += ' option-dim'
            }
            return (
              <button
                key={o.ref}
                type="button"
                className={cls}
                disabled={phase !== 'ask'}
                onClick={() => {
                  setChosen(o.ref)
                  finishCard(o.ref === card.ref)
                }}
              >
                <span className="option-inner">
                  <Shield code={o.ref} kind={o.kind} size="lg" />
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
