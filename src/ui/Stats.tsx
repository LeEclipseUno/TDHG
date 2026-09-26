import { useMemo, useState } from 'react'
import type { GameData } from '../data'
import { useLang } from '../i18n'
import { clearHistory, loadHistory, loadLabelStats } from '../game/history'
import { formatTime, MODES } from '../game/session'
import { Board, Matrix } from './widgets'
import { Shield } from './Shield'
import { IconMenu } from './icons'
import { Backdrop } from './Backdrop'

export function Stats({ data, onHome }: { data: GameData; onHome: () => void }) {
  const { t } = useLang()
  const [tick, setTick] = useState(0)
  const hist = useMemo(() => loadHistory(), [tick])
  const labels = useMemo(() => loadLabelStats(), [tick])
  const games = hist.length
  const questions = hist.reduce((a, g) => a + g.total, 0)
  const good = hist.reduce((a, g) => a + g.good, 0)
  const played = hist.reduce((a, g) => a + g.ms, 0)
  const perMode = MODES.map((m) => {
    const gs = hist.filter((g) => g.mode === m)
    return { mode: m, games: gs.length, best: gs.reduce((a, g) => Math.max(a, g.score), 0) }
  }).filter((m) => m.games > 0)
  const entries = Object.entries(labels).map(([label, s]) => ({ label, ...s, n: s.r + s.w, ratio: s.r / (s.r + s.w) }))
  const hardest = entries.filter((e) => e.n >= 2).sort((a, b) => a.ratio - b.ratio || b.n - a.n).slice(0, 10)
  const strongest = entries.filter((e) => e.n >= 2 && e.ratio >= 0.75).sort((a, b) => b.ratio - a.ratio || b.n - a.n).slice(0, 10)
  const recent = hist.slice(-10).reverse()

  return (
    <div className="results">
      <Backdrop data={data} />
      <div className="results-inner">
        <Board className="results-board">
          <div className="board-title">{t('stats')}</div>
          <div className="learn-stats">
            <div>
              <span className="stat-value">{games}</span>
              <span className="stat-label">{t('games')}</span>
            </div>
            <div>
              <span className="stat-value">{questions ? Math.round((good / questions) * 100) : 0}%</span>
              <span className="stat-label">{t('accuracy')}</span>
            </div>
            <div>
              <span className="stat-value">{formatTime(played)}</span>
              <span className="stat-label">{t('time')}</span>
            </div>
          </div>
          {perMode.length > 0 && (
            <div className="stats-modes">
              {perMode.map((m) => (
                <div key={m.mode} className="stats-mode">
                  <span>{t(`mode_${m.mode}`)}</span>
                  <small>
                    {m.games} {t('games').toLowerCase()}
                  </small>
                  <Matrix value={m.best} label={t('best')} />
                </div>
              ))}
            </div>
          )}
        </Board>

        {hardest.length > 0 && (
          <Board tone="dark">
            <div className="stats-title">{t('hardest')}</div>
            <ul className="stats-list">
              {hardest.map((e) => {
                const road = data.byRef.get(e.label)
                return (
                  <li key={e.label}>
                    {road ? <Shield code={road.ref} kind={road.kind} size="sm" /> : <span className="results-label">{e.label}</span>}
                    <span className="stats-bar">
                      <span style={{ width: `${Math.round(e.ratio * 100)}%` }} />
                    </span>
                    <span className="stats-ratio">
                      {e.r}/{e.n}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Board>
        )}
        {strongest.length > 0 && (
          <Board tone="dark">
            <div className="stats-title">{t('strongest')}</div>
            <ul className="stats-list">
              {strongest.map((e) => {
                const road = data.byRef.get(e.label)
                return (
                  <li key={e.label}>
                    {road ? <Shield code={road.ref} kind={road.kind} size="sm" /> : <span className="results-label">{e.label}</span>}
                    <span className="stats-bar">
                      <span style={{ width: `${Math.round(e.ratio * 100)}%` }} />
                    </span>
                    <span className="stats-ratio">
                      {e.r}/{e.n}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Board>
        )}
        {recent.length > 0 && (
          <Board tone="dark">
            <div className="stats-title">{t('recent')}</div>
            <ul className="stats-list stats-recent">
              {recent.map((g, i) => (
                <li key={i}>
                  <span>{t(`mode_${g.mode}`)}</span>
                  <small>
                    {t(`tier_${g.tier}_short`)} {'·'} {new Date(g.at).toLocaleDateString()}
                  </small>
                  <span className="results-points">{g.score}</span>
                </li>
              ))}
            </ul>
          </Board>
        )}
        {games === 0 && <p className="learn-note stats-empty">{t('noStats')}</p>}
        <div className="results-actions">
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            <IconMenu /> {t('home')}
          </button>
          {games > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => {
                if (window.confirm(t('clearConfirm'))) {
                  clearHistory()
                  setTick((x) => x + 1)
                }
              }}
            >
              {t('clearStats')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
