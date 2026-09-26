import { useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../i18n'
import { dateKey, formatTime, rankKey, shareText, summarize, type Session } from '../game/session'
import type { GameData } from '../data'
import MapView, { type Highlight, type Marker } from '../map/MapView'
import { Shield } from './Shield'
import { Board, Matrix, RouteStrip } from './widgets'
import { IconCheck, IconClock, IconCross, IconMenu, IconReplay, IconShare, IconTilde } from './icons'
import { sfx } from '../game/sound'
import { useNow } from '../game/hooks'

export interface ResultsProps {
  data: GameData
  session: Session
  newBest: boolean
  onAgain: () => void
  onHome: () => void
}

const MARK = { good: IconCheck, partial: IconTilde, bad: IconCross }
const STEP_MS = 160 // one question lights up per step
const COUNT_MS = 1100

export function Results({ data, session, newBest, onAgain, onHome }: ResultsProps) {
  const { t, lang } = useLang()
  const sum = summarize(session)
  const [copied, setCopied] = useState(false)
  const url = `${location.origin}${import.meta.env.BASE_URL}`
  const t0 = useMemo(() => Date.now(), [])
  const total = session.results.length
  const revealMs = total * STEP_MS
  const now = useNow(true, 40)
  const elapsed = now - t0
  const finished = elapsed > revealMs + COUNT_MS + 200
  const shownCount = Math.min(total, Math.floor(elapsed / STEP_MS) + 1)
  const countP = Math.max(0, Math.min(1, (elapsed - revealMs) / COUNT_MS))
  const shownScore = Math.round(sum.score * (1 - Math.pow(1 - countP, 3)))
  const lastTick = useRef(0)

  // Sounds: a tick per step while the roads light up and the score counts, a fanfare at the end.
  useEffect(() => {
    const step = countP < 1 ? Math.floor(elapsed / 70) : -1
    if (elapsed < revealMs + COUNT_MS && step !== lastTick.current) {
      lastTick.current = step
      if (elapsed >= revealMs || elapsed % STEP_MS < 70) sfx.count()
    }
    if (countP >= 1 && lastTick.current !== -1) {
      lastTick.current = -1
      sfx.done()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed])

  const grades = session.results.slice(0, shownCount).map((r) => r.grade)
  const highlights: Record<string, Highlight> = {}
  const markers: Marker[] = []
  session.results.slice(0, shownCount).forEach((r) => {
    if (data.byRef.has(r.label)) highlights[r.label] = r.grade === 'bad' ? 'wrong' : 'correct'
    else {
      const j = data.junctions.find((jj) => jj.name === r.label)
      if (j) markers.push({ x: j.x, y: j.y, kind: r.grade === 'bad' ? 'guess' : 'answer' })
    }
  })

  const share = async () => {
    const text = shareText(session, lang, url)
    if (navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch {
        /* cancelled or unsupported, fall back to the clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy:', text)
    }
  }

  return (
    <div className="results">
      <div className="results-inner">
        <Board className="results-board">
          <div className="board-title">{t('results')}</div>
          <div className="results-mode">
            {t(`mode_${session.mode}`)} <span className="sep" /> {t(`tier_${session.tier}_short`)}
            {session.daily && (
              <>
                <span className="sep" /> {dateKey()}
              </>
            )}
          </div>
          <div className="results-map">
            <MapView data={data} tier={session.tier} highlights={highlights} markers={markers} interactive={false} />
          </div>
          <RouteStrip grades={grades} total={total} />
          <Matrix big value={shownScore} label={t('points')} />
          <div className={'results-after' + (finished ? ' results-after-in' : '')}>
            <div className="rank-post">
              <span>{t(rankKey(sum.accuracy))}</span>
            </div>
            {newBest && <div className="newbest">{t('newBest')}</div>}
            {session.challenge !== undefined && (
              <div className="versus">
                <span>
                  {t('challenger')} <strong>{session.challenge}</strong>
                </span>
                <span className="versus-verdict">{sum.score > session.challenge ? t('youWon') : sum.score < session.challenge ? t('youLost') : t('tie')}</span>
                <span>
                  {t('you')} <strong>{sum.score}</strong>
                </span>
              </div>
            )}
            <div className="results-stats">
              <div className="stat">
                <IconCheck />
                <span className="stat-value">
                  {sum.good}
                  {sum.partial > 0 && <small> +{sum.partial}</small>}
                  <span className="stat-of">/{sum.total}</span>
                </span>
              </div>
              <div className="stat">
                <IconClock />
                <span className="stat-value">{formatTime(sum.ms)}</span>
              </div>
            </div>
          </div>
        </Board>

        <ul className="results-list">
          {session.results.map((r, i) => {
            const road = data.byRef.get(r.label)
            const Mark = MARK[r.grade]
            return (
              <li key={i} className={`grade-${r.grade}` + (i < shownCount ? ' row-in' : ' row-hidden')}>
                <span className={`mark mark-${r.grade}`}>
                  <Mark />
                </span>
                {road ? <Shield code={road.ref} kind={road.kind} size="sm" /> : <span className="results-label">{r.label}</span>}
                <span className="results-detail">{r.detail}</span>
                <span className="results-points">{r.points}</span>
              </li>
            )
          })}
        </ul>

        <div className="results-actions">
          <button type="button" className="btn btn-primary" onClick={share}>
            <IconShare /> {copied ? t('copied') : t('share')}
          </button>
          <button type="button" className="btn" onClick={onAgain}>
            <IconReplay /> {t('again')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            <IconMenu /> {t('home')}
          </button>
        </div>
      </div>
    </div>
  )
}
