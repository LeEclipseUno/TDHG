import { useLang } from '../i18n'
import { Board } from './widgets'
import { IconMenu } from './icons'

export const REPO_URL = 'https://github.com/LeEclipseUno/TDHG'
export const CHANGELOG: { date: string; nl: string; en: string }[] = [
  { date: '2026-09-26', nl: 'Dagelijkse uitdaging met reeks, deelbare resultaatkaart, afritten, routeplanner, statistieken, uitdagingslinks, varianten.', en: 'Daily challenge with streak, shareable result card, exits, route planner, statistics, challenge links, variants.' },
  { date: '2026-09-25', nl: 'Eerste versie: sleep de borden, vind de weg, knooppunten, welke weg is dit, leren met slimme herhaling.', en: 'First release: drag the signs, find the road, interchanges, which road is this, learn with spaced repetition.' },
]

export function About({ onHome }: { onHome: () => void }) {
  const { t, lang } = useLang()
  return (
    <div className="results">
      <div className="results-inner about">
        <Board className="results-board">
          <div className="board-title">{t('about')}</div>
          <div className="about-body">
            <p>{t('aboutWhat')}</p>
            <p>{t('aboutPrivacy')}</p>
            <p>{t('aboutData')}</p>
            <p>
              {t('aboutContact')}{' '}
              <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer">
                GitHub
              </a>
              .
            </p>
          </div>
        </Board>
        <Board tone="dark">
          <div className="stats-title">{t('changelog')}</div>
          <ul className="about-log">
            {CHANGELOG.map((c) => (
              <li key={c.date}>
                <span className="about-date">{c.date}</span>
                <span>{c[lang]}</span>
              </li>
            ))}
          </ul>
        </Board>
        <p className="home-footer">
          {t('attribution')} {'·'} CBS {'·'} Natural Earth
        </p>
        <div className="results-actions">
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            <IconMenu /> {t('home')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** A prefilled GitHub issue for a wrong or missing road, exit or interchange. */
export function reportUrl(mode: string, label: string, detail: string | undefined, lang: string): string {
  const title = encodeURIComponent(`Data: ${label} (${mode})`)
  const body = encodeURIComponent(`Mode: ${mode}\nItem: ${label}\nDetail: ${detail ?? ''}\nLanguage: ${lang}\nDate: ${new Date().toISOString().slice(0, 10)}\n\nWhat is wrong:\n`)
  return `${REPO_URL}/issues/new?title=${title}&body=${body}&labels=data`
}
