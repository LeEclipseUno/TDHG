import { useMemo } from 'react'
import type { GameData, Tier } from '../data'
import { buildDeck, deckStats, loadStates, type Deck } from '../game/learn'
import { useLang, type Lang } from '../i18n'
import { MODES, getBest, type ModeId, type Settings } from '../game/session'
import { Board } from './widgets'
import { IconSignArrow, PictDrag, PictFind, PictJunction, PictLearn, PictQuiz } from './icons'

export interface HomeProps {
  data: GameData
  settings: Settings
  onSettings: (s: Settings) => void
  onPlay: (mode: ModeId) => void
  onLearn: () => void
  onInstall?: () => void
}

const PICTS: Record<ModeId, typeof PictDrag> = { drag: PictDrag, find: PictFind, junction: PictJunction, quiz: PictQuiz }

function Seg<T extends string>({ value, options, onChange, label, wide = false }: { value: T; options: { v: T; label: string; title?: string }[]; onChange: (v: T) => void; label: string; wide?: boolean }) {
  return (
    <div className={'seg' + (wide ? ' seg-wide' : '')} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} type="button" className={'seg-btn' + (value === o.v ? ' seg-on' : '')} onClick={() => onChange(o.v)} title={o.title}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

const isIosSafari = /iphone|ipad|ipod/i.test(navigator.userAgent) && !('standalone' in navigator && (navigator as { standalone?: boolean }).standalone)
const isStandalone = window.matchMedia('(display-mode: standalone)').matches

export function Home({ data, settings, onSettings, onPlay, onLearn, onInstall }: HomeProps) {
  const { t, lang, setLang } = useLang()
  const tiers: Tier[] = ['A', 'AN', 'ALL']
  const learnStats = useMemo(() => deckStats(buildDeck(data, settings.tier, settings.learnDeck), loadStates()), [data, settings.tier, settings.learnDeck])
  return (
    <div className="home">
      <div className="home-inner">
        <header className="home-header">
          <div className="home-lang">
            <Seg<Lang> label={t('language')} value={lang} onChange={setLang} options={[{ v: 'nl', label: 'NL' }, { v: 'en', label: 'EN' }]} />
          </div>
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="The Dutch Highway Guesser" className="home-logo" />
          <p className="home-tagline">{t('tagline')}</p>
        </header>

        <Board className="modes-board">
          <div className="board-title">{t('chooseMode')}</div>
          {MODES.map((mode) => {
            const best = getBest(mode, settings.tier, settings.timer)
            const Pict = PICTS[mode]
            return (
              <button key={mode} type="button" className="sign-row" onClick={() => onPlay(mode)}>
                <span className="sign-pict">
                  <Pict />
                </span>
                <span className="sign-text">
                  <span className="sign-name">{t(`mode_${mode}`)}</span>
                  <span className="sign-desc">{t(`mode_${mode}_desc`)}</span>
                  {best && (
                    <span className="sign-best">
                      {t('best')} {best.score}
                    </span>
                  )}
                </span>
                <IconSignArrow className="sign-arrow" />
              </button>
            )
          })}
        </Board>

        <Board className="learn-board">
          <div className="board-title">{t('learn')}</div>
          <button type="button" className="sign-row" onClick={onLearn}>
            <span className="sign-pict">
              <PictLearn />
            </span>
            <span className="sign-text">
              <span className="sign-name">{t('learnTitle')}</span>
              <span className="sign-desc">{t('learn_desc')}</span>
              <span className="sign-best">
                {learnStats.due} {t('due')} {'\u00b7'} {learnStats.total - learnStats.seen} {t('newCards')} {'\u00b7'} {learnStats.mature} {t('learned')}
              </span>
            </span>
            <IconSignArrow className="sign-arrow" />
          </button>
        </Board>

        <Board tone="dark" className="settings-board">
          <div className="setting">
            <span className="setting-label">{t('roads')}</span>
            <Seg<Tier> wide label={t('roads')} value={settings.tier} onChange={(tier) => onSettings({ ...settings, tier })} options={tiers.map((v) => ({ v, label: t(`tier_${v}_short`), title: t(`tier_${v}`) }))} />
            <span className="setting-hint">{t(`tier_${settings.tier}`)}</span>
          </div>
          <div className="setting-row">
            <div className="setting">
              <span className="setting-label">{t('timer')}</span>
              <Seg<'on' | 'off'> label={t('timer')} value={settings.timer ? 'on' : 'off'} onChange={(v) => onSettings({ ...settings, timer: v === 'on' })} options={[{ v: 'on', label: t('timerOn') }, { v: 'off', label: t('timerOff') }]} />
            </div>
            <div className="setting">
              <span className="setting-label">{t('daily')}</span>
              <Seg<'on' | 'off'> label={t('daily')} value={settings.daily ? 'on' : 'off'} onChange={(v) => onSettings({ ...settings, daily: v === 'on' })} options={[{ v: 'on', label: t('timerOn') }, { v: 'off', label: t('timerOff') }]} />
            </div>
          </div>
          {settings.daily && <span className="setting-hint">{t('dailyHint')}</span>}
          <div className="setting">
            <span className="setting-label">{t('learnDeck')}</span>
            <Seg<Deck> label={t('learnDeck')} value={settings.learnDeck} onChange={(learnDeck) => onSettings({ ...settings, learnDeck })} options={[{ v: 'roads', label: t('deck_roads') }, { v: 'junctions', label: t('deck_junctions') }]} />
          </div>
        </Board>

        {!isStandalone && (onInstall || isIosSafari) && (
          <button type="button" className="install-row" onClick={onInstall} disabled={!onInstall}>
            <span className="install-icon" aria-hidden>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
                <path d="M12 7v7M9 11l3 3 3-3M10 18h4" />
              </svg>
            </span>
            <span className="sign-text">
              <span className="install-name">{t('install')}</span>
              <span className="sign-desc">{onInstall ? t('installDesc') : t('installIos')}</span>
            </span>
          </button>
        )}
        <footer className="home-footer">{t('attribution')}</footer>
      </div>
    </div>
  )
}
