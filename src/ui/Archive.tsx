import type { GameData } from '../data'
import { useLang } from '../i18n'
import { BackBar, Board, BottomHome } from './widgets'
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
  // Month picker: jumps to the newest day of that month in the list.
  const monthFmt = new Intl.DateTimeFormat(lang === 'nl' ? 'nl-NL' : 'en-GB', { month: 'long', year: 'numeric' })
  const months: { key: string; label: string; n: number }[] = []
  for (const n of days) {
    const d = dailyDate(n)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (!months.length || months[months.length - 1].key !== key) months.push({ key, label: monthFmt.format(d), n })
  }
  const jump = (n: number) => document.getElementById(`archive-${n}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  return (
    <div className="results">
      <Backdrop data={data} />
      <div className="results-inner">
        <BackBar label={t('home')} onBack={onHome} />
        <Board className="results-board">
          <div className="board-title">{t('archiveTitle')}</div>
          {months.length > 1 && (
            <label className="archive-jump">
              <span>{t('jumpTo')}</span>
              <select className="time-input" onChange={(e) => jump(Number(e.target.value))} defaultValue={months[0].n} aria-label={t('jumpTo')}>
                {months.map((m) => (
                  <option key={m.key} value={m.n}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="archive-list">
            {days.map((n) => {
              const r = results[n]
              return (
                <button key={n} id={`archive-${n}`} type="button" className="sign-row archive-row" onClick={() => onPlay(n)}>
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
          <BottomHome label={t('home')} onHome={onHome}>
            <IconMenu />
          </BottomHome>
        </div>
      </div>
    </div>
  )
}
