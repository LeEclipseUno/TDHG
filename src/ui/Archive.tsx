import type { GameData } from '../data'
import { useLang } from '../i18n'
import { BackBar, Board } from './widgets'
import { IconMenu, IconSignArrow } from './icons'
import { Backdrop } from './Backdrop'
import { allDailyResults, dailyDate, dailyMode, dailyNumber } from '../game/daily'

export interface ArchiveProps {
  data: GameData
  onPlay: (n: number) => void
  onHome: () => void
}

/** Every daily so far, newest first. Plus only. */
export function Archive({ data, onPlay, onHome }: ArchiveProps) {
  const { t, lang } = useLang()
  const today = dailyNumber()
  const results = allDailyResults()
  const days: number[] = []
  for (let n = today; n >= 1; n--) days.push(n)
  const fmt = new Intl.DateTimeFormat(lang === 'nl' ? 'nl-NL' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  return (
    <div className="results">
      <Backdrop data={data} />
      <div className="results-inner">
        <BackBar label={t('home')} onBack={onHome} />
        <Board className="results-board">
          <div className="board-title">{t('archiveTitle')}</div>
          <div className="archive-list">
            {days.map((n) => {
              const r = results[n]
              return (
                <button key={n} type="button" className="sign-row archive-row" onClick={() => onPlay(n)}>
                  <span className="archive-num">#{n}</span>
                  <span className="sign-text">
                    <span className="sign-name">{n === today ? t('today') : fmt.format(dailyDate(n))}</span>
                    <span className="sign-desc">
                      {t(`mode_${dailyMode(n)}`)}
                      {' · '}
                      {r ? `${r.score} ${t('points', { n: r.score })}, ${r.good}/${r.total}` : t('notPlayedYet')}
                    </span>
                  </span>
                  <IconSignArrow className="sign-arrow" />
                </button>
              )
            })}
          </div>
        </Board>
        <div className="results-actions">
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            <IconMenu /> {t('home')}
          </button>
        </div>
      </div>
    </div>
  )
}
