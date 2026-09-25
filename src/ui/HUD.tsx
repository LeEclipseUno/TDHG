import { useState, type ReactNode } from 'react'
import { useLang } from '../i18n'
import { formatTime, type Grade } from '../game/session'
import { Matrix, RouteStrip, SpeedSign } from './widgets'
import { IconBack } from './icons'

export interface HUDProps {
  index: number
  total: number
  grades: (Grade | undefined)[]
  score: number
  scoreLabel?: string
  remainingMs?: number
  limitMs?: number
  elapsedMs?: number
  prompt: ReactNode
  onQuit: () => void
  countLabel?: string
}

export function HUD({ index, total, grades, score, scoreLabel, remainingMs, limitMs, elapsedMs, prompt, onQuit, countLabel }: HUDProps) {
  const { t } = useLang()
  const [confirm, setConfirm] = useState(false)
  return (
    <header className="hud">
      <div className="hud-row">
        <button type="button" className="sign-btn" aria-label={t('quit')} onClick={() => setConfirm(true)}>
          <IconBack />
        </button>
        <div className="hud-mid">
          <span className="hud-count">{countLabel ?? t('question', { n: Math.min(index + 1, total), total })}</span>
          <RouteStrip grades={grades} total={total} current={index} />
        </div>
        <Matrix value={score} label={scoreLabel ?? t('score')} />
        {limitMs && remainingMs !== undefined ? <SpeedSign remainingMs={remainingMs} totalMs={limitMs} /> : elapsedMs !== undefined ? <Matrix value={formatTime(elapsedMs)} label={t('time')} /> : null}
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
