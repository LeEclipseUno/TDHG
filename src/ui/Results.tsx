import { useState } from 'react'
import { useLang } from '../i18n'
import { dateKey, formatTime, rankKey, shareText, summarize, type Session } from '../game/session'
import type { GameData } from '../data'
import { Shield } from './Shield'
import { Board, Matrix, RouteStrip } from './widgets'
import { IconCheck, IconClock, IconCross, IconMenu, IconReplay, IconShare, IconTilde } from './icons'

export interface ResultsProps {
  data: GameData
  session: Session
  newBest: boolean
  onAgain: () => void
  onHome: () => void
}

const MARK = { good: IconCheck, partial: IconTilde, bad: IconCross }

export function Results({ data, session, newBest, onAgain, onHome }: ResultsProps) {
  const { t, lang } = useLang()
  const sum = summarize(session)
  const [copied, setCopied] = useState(false)
  const url = `${location.origin}${import.meta.env.BASE_URL}`

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
          <Matrix big value={sum.score} label={t('points')} />
          <div className="rank-post">
            <span>{t(rankKey(sum.accuracy))}</span>
          </div>
          {newBest && <div className="newbest">{t('newBest')}</div>}
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
          <RouteStrip grades={session.results.map((r) => r.grade)} total={session.results.length} />
        </Board>

        <ul className="results-list">
          {session.results.map((r, i) => {
            const road = data.byRef.get(r.label)
            const Mark = MARK[r.grade]
            return (
              <li key={i} className={`grade-${r.grade}`}>
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
