import { useLang } from '../i18n'
import { Board } from './widgets'
import { IconMenu } from './icons'
import { Backdrop } from './Backdrop'
import type { GameData } from '../data'

export function About({ data, onHome }: { data: GameData; onHome: () => void }) {
  const { t } = useLang()
  return (
    <div className="results">
      <Backdrop data={data} />
      <div className="results-inner about">
        <Board className="results-board">
          <div className="board-title">{t('about')}</div>
          <div className="about-body">
            <p>{t('aboutWhat')}</p>
            <p>{t('aboutPrivacy')}</p>
            <p>{t('aboutData')}</p>
            <p>
              {t('aboutContact')} <a href="mailto:hello@wegenkenner.nl">hello@wegenkenner.nl</a>.
            </p>
          </div>
        </Board>
        <p className="home-footer about-links">
          <a href="/wegen/">{t('allRoads')}</a> {'·'} <a href="/privacy.html">{t('privacyPage')}</a> {'·'} <a href="/voorwaarden.html">{t('termsPage')}</a>
        </p>
        <p className="home-footer">
          {t('attribution')} {'·'} CBS {'·'} Natural Earth
        </p>
        <p className="home-footer">
          {t('version')} {typeof __BUILD__ === 'string' ? __BUILD__.replace('T', ' ') : ''}
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

