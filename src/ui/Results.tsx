import { useState } from 'react'
import { useLang } from '../i18n'
import { emojiGrid, formatTime, rankKey, shareText, summarize, type Session } from '../game/session'
import type { GameData } from '../data'
import { Shield } from './Shield'

export interface ResultsProps {
  data: GameData
  session: Session
  newBest: boolean
  onAgain: () => void
  onHome: () => void
}

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
        /* user cancelled or unsupported, fall through to clipboard */
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
        <h2 className="results-title">{t('results')}</h2>
        <p className="results-mode">
          {t(`mode_${session.mode}`)} {'·'} {t(`tier_${session.tier}_short`)}
        </p>
        <div className="results-score">
          <span className="results-score-value">{sum.score}</span>
          <span className="results-score-label">{t('points')}</span>
        </div>
        <p className="results-rank">{t(rankKey(sum.accuracy))}</p>
        {newBest && <p className="results-newbest">{t('newBest')}</p>}
        <div className="results-stats">
          <div>
            <span className="stat-value">
              {sum.good}
              {sum.partial > 0 && <small>+{sum.partial}{'½'}</small>}/{sum.total}
            </span>
            <span className="stat-label">{t('accuracy')}</span>
          </div>
          <div>
            <span className="stat-value">{formatTime(sum.ms)}</span>
            <span className="stat-label">{t('time')}</span>
          </div>
        </div>
        <pre className="results-grid">{emojiGrid(session)}</pre>
        <ul className="results-list">
          {session.results.map((r, i) => {
            const road = data.byRef.get(r.label)
            return (
              <li key={i} className={`grade-${r.grade}`}>
                {road ? <Shield code={road.ref} kind={road.kind} size="sm" /> : <span className="results-label">{r.label}</span>}
                <span className="results-detail">{r.detail}</span>
                <span className="results-points">+{r.points}</span>
              </li>
            )
          })}
        </ul>
        <div className="results-actions">
          <button type="button" className="btn btn-primary" onClick={share}>
            {copied ? t('copied') : t('share')}
          </button>
          <button type="button" className="btn" onClick={onAgain}>
            {t('again')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('home')}
          </button>
        </div>
      </div>
    </div>
  )
}
