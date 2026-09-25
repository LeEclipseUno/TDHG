import type { Tier } from '../data'
import { useLang, type Lang } from '../i18n'
import { MODES, getBest, type ModeId, type Settings } from '../game/session'
import { Board } from './widgets'
import { IconSignArrow, PictDrag, PictFind, PictJunction, PictQuiz } from './icons'

export interface HomeProps {
  settings: Settings
  onSettings: (s: Settings) => void
  onPlay: (mode: ModeId) => void
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

export function Home({ settings, onSettings, onPlay }: HomeProps) {
  const { t, lang, setLang } = useLang()
  const tiers: Tier[] = ['A', 'AN', 'ALL']
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
        </Board>

        <footer className="home-footer">{t('attribution')}</footer>
      </div>
    </div>
  )
}
