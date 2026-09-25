import { useState, type ReactNode } from 'react'
import { useLang } from '../i18n'
import { TimerRing } from './TimerRing'
import { formatTime } from '../game/session'

export interface HUDProps {
  index: number
  total: number
  score: number
  remainingMs?: number
  limitMs?: number
  elapsedMs?: number
  prompt: ReactNode
  onQuit: () => void
  countLabel?: string
}

export function HUD({ index, total, score, remainingMs, limitMs, elapsedMs, prompt, onQuit, countLabel }: HUDProps) {
  const { t } = useLang()
  const [confirm, setConfirm] = useState(false)
  return (
    <header className="hud">
      <div className="hud-row">
        <button type="button" className="btn-icon" aria-label={t('quit')} onClick={() => setConfirm(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="hud-progress">
          <span>{countLabel ?? t('question', { n: Math.min(index + 1, total), total })}</span>
          <div className="hud-bar">
            <div className="hud-bar-fill" style={{ width: `${(index / total) * 100}%` }} />
          </div>
        </div>
        <div className="hud-score">
          <span className="hud-score-label">{t('score')}</span>
          <span className="hud-score-value">{score}</span>
        </div>
        {limitMs && remainingMs !== undefined ? (
          <TimerRing remainingMs={remainingMs} totalMs={limitMs} />
        ) : elapsedMs !== undefined ? (
          <span className="hud-clock">{formatTime(elapsedMs)}</span>
        ) : null}
      </div>
      <div className="hud-prompt">{prompt}</div>
      {confirm && (
        <div className="modal-backdrop" onClick={() => setConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p>{t('quitConfirm')}</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirm(false)}>
                {t('cancel')}
              </button>
              <button type="button" className="btn btn-danger" onClick={onQuit}>
                {t('quit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
