import type { Tier } from '../data'
import { useLang, type Lang } from '../i18n'
import { MODES, getBest, type ModeId, type Settings } from '../game/session'

export interface HomeProps {
  settings: Settings
  onSettings: (s: Settings) => void
  onPlay: (mode: ModeId) => void
}

const MODE_ICONS: Record<ModeId, string> = {
  drag: '\u{1F9F2}',
  find: '\u{1F50D}',
  junction: '\u{1F500}',
  quiz: '\u{2753}',
}

export function Home({ settings, onSettings, onPlay }: HomeProps) {
  const { t, lang, setLang } = useLang()
  const tiers: Tier[] = ['A', 'AN', 'ALL']
  return (
    <div className="home">
      <div className="home-inner">
        <header className="home-header">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="home-logo" />
          <h1 className="home-title">
            The <span className="accent">Dutch Highway</span> Guesser
          </h1>
          <p className="home-tagline">{t('tagline')}</p>
          <div className="lang-toggle" role="group" aria-label={t('language')}>
            {(['nl', 'en'] as Lang[]).map((l) => (
              <button key={l} type="button" className={'chip' + (lang === l ? ' chip-on' : '')} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </header>

        <section className="settings">
          <div className="setting">
            <span className="setting-label">{t('roads')}</span>
            <div className="chips">
              {tiers.map((tier) => (
                <button key={tier} type="button" className={'chip' + (settings.tier === tier ? ' chip-on' : '')} onClick={() => onSettings({ ...settings, tier })} title={t(`tier_${tier}`)}>
                  {t(`tier_${tier}_short`)}
                </button>
              ))}
            </div>
            <p className="setting-hint">{t(`tier_${settings.tier}`)}</p>
          </div>
          <div className="setting-row">
            <div className="setting">
              <span className="setting-label">{t('timer')}</span>
              <div className="chips">
                <button type="button" className={'chip' + (settings.timer ? ' chip-on' : '')} onClick={() => onSettings({ ...settings, timer: true })}>
                  {t('timerOn')}
                </button>
                <button type="button" className={'chip' + (!settings.timer ? ' chip-on' : '')} onClick={() => onSettings({ ...settings, timer: false })}>
                  {t('timerOff')}
                </button>
              </div>
            </div>
            <div className="setting">
              <span className="setting-label">{t('daily')}</span>
              <div className="chips">
                <button type="button" className={'chip' + (settings.daily ? ' chip-on' : '')} onClick={() => onSettings({ ...settings, daily: !settings.daily })}>
                  {settings.daily ? t('timerOn') : t('timerOff')}
                </button>
              </div>
            </div>
          </div>
          {settings.daily && <p className="setting-hint">{t('dailyHint')}</p>}
        </section>

        <section className="modes">
          {MODES.map((mode) => {
            const best = getBest(mode, settings.tier, settings.timer)
            return (
              <button key={mode} type="button" className="mode-card" onClick={() => onPlay(mode)}>
                <span className="mode-icon" aria-hidden>
                  {MODE_ICONS[mode]}
                </span>
                <span className="mode-text">
                  <span className="mode-name">{t(`mode_${mode}`)}</span>
                  <span className="mode-desc">{t(`mode_${mode}_desc`)}</span>
                  <span className="mode-best">{best ? `${t('best')}: ${best.score}` : t('noBest')}</span>
                </span>
                <span className="mode-play">{t('play')}</span>
              </button>
            )
          })}
        </section>

        <footer className="home-footer">{t('attribution')}</footer>
      </div>
    </div>
  )
}
