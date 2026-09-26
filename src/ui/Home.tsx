import { useState } from 'react'
import type { GameData, Tier } from '../data'
import type { Deck } from '../game/learn'
import { useLang, type Lang } from '../i18n'
import { MODES, VARIANTS, dailyShareText, getBest, type Challenge, type ModeId, type Settings, type Variant } from '../game/session'
import { isPlusMode } from '../game/premium'
import { disableReminder, enableReminder, getReminder, pushSupported } from '../game/push'
import { dailyMode, dailyNumber, getDailyResult, getStreak, msUntilNextDaily } from '../game/daily'
import { season, SEASON_TEXT } from '../game/season'
import { Board, Matrix } from './widgets'
import { IconGoogle, IconLock, IconReplay, IconShare, IconSignArrow, PictDrag, PictExit, PictFind, PictGroup, PictJunction, PictLearn, PictQuiz, PictRoute, PictStats, SeasonIcon } from './icons'
import { ONLINE, type Account } from '../game/backend'
import DriftMap from '../map/DriftMap'
import { useNow } from '../game/hooks'

export interface HomeProps {
  data: GameData
  settings: Settings
  onSettings: (s: Settings) => void
  onPlay: (mode: ModeId) => void
  onDaily: () => void
  /** Learn is locked for now; kept for when it opens. */
  onLearn?: () => void
  onStats: () => void
  onAbout: () => void
  onGroups: () => void
  challenge: Challenge | null
  onChallenge: () => void
  onInstall?: () => void
  account: Account
  onSignIn: () => void
  onSignOut: () => void
  plus: boolean
  onPlus: () => void
  onArchive: () => void
}

const PICTS: Record<ModeId, typeof PictDrag> = { drag: PictDrag, find: PictFind, junction: PictJunction, quiz: PictQuiz, exit: PictExit, route: PictRoute }

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

/** Language switch drawn as a real hectometerpaal: grey pole, green plates with a white border,
    the small red A-shield with the side letter on top, and the big number field showing the language. */
function LangPost({ lang, onChange, label }: { lang: Lang; onChange: (l: Lang) => void; label: string }) {
  const plate = (l: Lang, y: number, side: string) => {
    const on = l === lang
    return (
      <g key={l} className="lang-plate" role="button" tabIndex={0} aria-pressed={on} aria-label={l.toUpperCase()} onClick={() => onChange(l)} onKeyDown={(e) => e.key === 'Enter' && onChange(l)} opacity={on ? 1 : 0.45}>
        <rect x="1" y={y} width="62" height="44" rx="4" fill="#1a8f5c" stroke="#0b0f14" strokeWidth="1" />
        <rect x="4" y={y + 3} width="56" height="38" rx="2.5" fill="none" stroke="#fff" strokeWidth="1.6" />
        <rect x="8" y={y + 7} width="22" height="11" rx="1.5" fill="#c90002" stroke="#fff" strokeWidth="1" />
        <text x="19" y={y + 15.5} textAnchor="middle" fontFamily="Overpass, 'Barlow Condensed', system-ui, sans-serif" fontSize="8.5" fontWeight="800" fill="#fff">
          A1
        </text>
        <text x="46" y={y + 16} textAnchor="middle" fontFamily="'Barlow Condensed', system-ui, sans-serif" fontSize="10" fontWeight="700" fill="#fff">
          {side}
        </text>
        <text x="32" y={y + 36} textAnchor="middle" fontFamily="'Barlow Condensed', system-ui, sans-serif" fontSize="19" fontWeight="800" fill="#fff" letterSpacing="0.5">
          {l.toUpperCase()}
        </text>
      </g>
    )
  }
  return (
    <div className="home-lang">
      <svg className="lang-post" width="140" height="54" viewBox="0 0 140 54" role="group" aria-label={label}>
        <rect x="60" y="46" width="20" height="8" rx="1.5" fill="#8d949c" />
        <g transform="translate(2 0)">{plate('nl', 0, 'Li')}</g>
        <g transform="translate(74 0)">{plate('en', 0, 'Re')}</g>
      </svg>
    </div>
  )
}

/** The play streak as a row of hectometre posts. */
export function StreakPosts({ count }: { count: number }) {
  const shown = Math.max(1, Math.min(count, 14))
  return (
    <span className="streak" title={String(count)}>
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className={'streak-post' + (i < count ? ' streak-post-on' : '')} />
      ))}
      <span className="streak-count">{count}</span>
    </span>
  )
}

const isIosSafari = /iphone|ipad|ipod/i.test(navigator.userAgent) && !('standalone' in navigator && (navigator as { standalone?: boolean }).standalone)
const isStandalone = window.matchMedia('(display-mode: standalone)').matches

export function Home({ data, settings, onSettings, onPlay, onDaily, onLearn, onStats, onAbout, onGroups, challenge, onChallenge, onInstall, account, onSignIn, onSignOut, plus, onPlus, onArchive }: HomeProps) {
  const { t, lang, setLang } = useLang()
  const tiers: Tier[] = ['A', 'N', 'AN']
  const n = dailyNumber()
  const daily = getDailyResult(n)
  const streak = getStreak()
  const now = useNow(!!daily, 1000)
  const left = msUntilNextDaily(new Date(now))
  const hh = Math.floor(left / 3_600_000)
  const mm = Math.floor((left % 3_600_000) / 60_000)
  const s = season()
  const DailyPict = PICTS[dailyMode(n)]
  const [copied, setCopied] = useState(false)
  const shareDaily = async () => {
    if (!daily) return
    const text = dailyShareText(n, daily.score, lang, `${location.origin}${import.meta.env.BASE_URL}`)
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      /* cancelled */
    }
  }
  const [reminder, setReminder] = useState(getReminder)
  const [reminderNote, setReminderNote] = useState('')
  const applyReminder = async (on: boolean, hour: number, minute: number) => {
    setReminderNote('')
    if (!on) {
      await disableReminder()
      setReminder({ on: false, hour, minute })
      return
    }
    const ok = await enableReminder(hour, minute, lang)
    if (ok) setReminder({ on: true, hour, minute })
    else setReminderNote(isIosSafari && !isStandalone ? t('reminderInstall') : t('reminderDenied'))
  }
  const reminderTime = `${String(reminder.hour).padStart(2, '0')}:${String(reminder.minute).padStart(2, '0')}`

  return (
    <div className={'home' + (s ? ` season-${s}` : '')}>
      <div className="home-backdrop" aria-hidden>
        <DriftMap data={data} />
      </div>
      <div className="home-inner">
        <header className="home-header">
          <div className="home-topbar">
            {ONLINE && account.signedIn ? (
              <button type="button" className="avatar-btn" onClick={onStats} aria-label={t('stats')}>
                {account.avatar ? <img className="avatar-img" src={account.avatar} alt="" referrerPolicy="no-referrer" /> : <span className="avatar-img avatar-fallback">{(account.name ?? account.email ?? '?').slice(0, 1).toUpperCase()}</span>}
                <span className="avatar-text">
                  <span className="avatar-name">{account.name ?? account.email?.split('@')[0]}</span>
                  <span className="avatar-sub">{t('stats')}</span>
                </span>
              </button>
            ) : (
              <span />
            )}
            <LangPost lang={lang} onChange={setLang} label={t('language')} />
          </div>
          <div className="home-logo-wrap">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="The Dutch Highway Guesser" className="home-logo" />
          </div>
          {s ? (
            <p className="season-strip">
              <SeasonIcon season={s} /> {SEASON_TEXT[s][lang]}
            </p>
          ) : (
            <p className="home-tagline">{t('tagline')}</p>
          )}
        </header>

        <Board className="daily-board">
          <div className="board-title daily-title">
            <span>Wegenkenner #{n}</span>
            <span className="daily-mode">{t(`mode_${dailyMode(n)}`)}</span>
          </div>
          <div className="daily-body">
            <span className="sign-pict">
              <DailyPict />
            </span>
            <div className="daily-text">
              {daily ? (
                <>
                  <span className="daily-line">{t('dailyDone', { score: daily.score, good: daily.good, total: daily.total })}</span>
                  <span className="daily-sub">{t('nextDaily', { t: `${hh}:${String(mm).padStart(2, '0')}` })}</span>
                </>
              ) : (
                <>
                  <span className="daily-line">{t('dailyPitch')}</span>
                  <span className="daily-sub">{t('dailyHint')}</span>
                </>
              )}
              <span className="daily-streak">
                {t('streak')} <StreakPosts count={streak.count} />
                {streak.best > 1 && (
                  <small>
                    {t('best')} {streak.best}
                  </small>
                )}
              </span>
            </div>
            {daily ? <Matrix value={daily.score} label={t('score')} /> : null}
          </div>
          {daily ? (
            <div className="daily-actions">
              <button type="button" className="btn btn-primary" onClick={shareDaily}>
                <IconShare /> {copied ? t('copied') : t('share')}
              </button>
              <button type="button" className="btn btn-ghost" onClick={onDaily}>
                <IconReplay /> {t('practice')}
              </button>
              <button type="button" className="btn btn-ghost" onClick={onArchive}>
                {t('archive')}
                {!plus && <span className="locked-tag">{t('plusTag')}</span>}
              </button>
            </div>
          ) : (
            <button type="button" className="sign-row daily-play" onClick={onDaily}>
              <span className="sign-text">
                <span className="sign-name">{t('playDaily')}</span>
              </span>
              <IconSignArrow className="sign-arrow" />
            </button>
          )}
        </Board>

        {ONLINE && !account.signedIn && (
          <button type="button" className="google-row" onClick={onSignIn}>
            <span className="google-row-icon">
              <IconGoogle />
            </span>
            <span className="sign-text">
              <span className="google-row-name">{t('signInGoogle')}</span>
              <span className="google-row-desc">{t('cloudHint')}</span>
            </span>
            <IconSignArrow className="sign-arrow google-row-arrow" />
          </button>
        )}

        {challenge && (
          <Board tone="orange" className="challenge-board">
            <div className="board-title">{t('challenge')}</div>
            <button type="button" className="sign-row" onClick={onChallenge}>
              <span className="sign-pict">
                <PictStats />
              </span>
              <span className="sign-text">
                <span className="sign-name">
                  {t(`mode_${challenge.mode}`)} {'·'} {t(`tier_${challenge.tier}_short`)}
                  {challenge.variant !== 'normal' && ` · ${t(`variant_${challenge.variant}`)}`}
                </span>
                <span className="sign-desc">{t('challengeText')}</span>
                <span className="sign-best">
                  {t('challenger')} {challenge.score}
                </span>
              </span>
              <IconSignArrow className="sign-arrow" />
            </button>
          </Board>
        )}

        <Board className="modes-board">
          <div className="board-title">{t('chooseMode')}</div>
          {MODES.map((mode) => {
            const best = getBest(mode, settings.tier, settings.timer, settings.variant, settings.province)
            const Pict = PICTS[mode]
            const locked = isPlusMode(mode) && !plus
            return (
              <button key={mode} type="button" className={'sign-row' + (locked ? ' sign-row-locked' : '')} onClick={() => (locked ? onPlus() : onPlay(mode))}>
                <span className="sign-pict">
                  <Pict />
                </span>
                <span className="sign-text">
                  <span className="sign-name">
                    {t(`mode_${mode}`)}
                    {locked && <span className="locked-tag">{t('plusTag')}</span>}
                  </span>
                  <span className="sign-desc">{t(`mode_${mode}_desc`)}</span>
                  {best && (
                    <span className="sign-best">
                      {t('best')} {best.score}
                    </span>
                  )}
                </span>
                {locked ? <IconLock className="sign-arrow" /> : <IconSignArrow className="sign-arrow" />}
              </button>
            )
          })}
        </Board>

        {!plus && (
          <button type="button" className="google-row plus-row" onClick={onPlus}>
            <span className="google-row-icon plus-row-icon">+</span>
            <span className="sign-text">
              <span className="google-row-name">{t('plus')}</span>
              <span className="google-row-sub">{t('plusPitch')}</span>
            </span>
            <IconSignArrow className="sign-arrow" />
          </button>
        )}

        {ONLINE && (
          <Board className="groups-board">
            <div className="board-title">{t('groups')}</div>
            <button type="button" className="sign-row" onClick={onGroups}>
              <span className="sign-pict">
                <PictGroup />
              </span>
              <span className="sign-text">
                <span className="sign-name">{t('groups')}</span>
                <span className="sign-desc">{t('groups_desc')}</span>
              </span>
              <IconSignArrow className="sign-arrow" />
            </button>
          </Board>
        )}

        <Board className={'learn-board' + (plus ? '' : ' board-plus')}>
          <div className="board-title">
            {t('learn')} {!plus && <span className="locked-tag">{t('plusTag')}</span>}
          </div>
          <button type="button" className={'sign-row' + (plus ? '' : ' sign-row-locked')} onClick={plus ? onLearn : onPlus}>
            <span className="sign-pict">
              <PictLearn />
            </span>
            <span className="sign-text">
              <span className="sign-name">{t('learnTitle')}</span>
              <span className="sign-desc">{t('learn_desc')}</span>
            </span>
            {plus ? <IconSignArrow className="sign-arrow" /> : <IconLock className="sign-arrow" />}
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
              <span className="setting-label">{t('sound')}</span>
              <Seg<'on' | 'off'> label={t('sound')} value={settings.sound ? 'on' : 'off'} onChange={(v) => onSettings({ ...settings, sound: v === 'on' })} options={[{ v: 'on', label: t('timerOn') }, { v: 'off', label: t('timerOff') }]} />
            </div>
          </div>
          <div className="setting">
            <span className="setting-label">{t('variant')}</span>
            <Seg<Variant> wide label={t('variant')} value={settings.variant} onChange={(variant) => onSettings({ ...settings, variant })} options={VARIANTS.map((v) => ({ v, label: t(`variant_${v}`) }))} />
            <span className="setting-hint">{t(`variantHint_${settings.variant}`)}</span>
          </div>
          {ONLINE && account.signedIn && (
            <div className="setting">
              <span className="setting-label">{t('account')}</span>
              <div className="account-row">
                <span className="setting-hint">
                  {t('signedInAs')} {account.email}
                </span>
                <button type="button" className="btn btn-small btn-ghost" onClick={onSignOut}>
                  {t('signOut')}
                </button>
              </div>
            </div>
          )}
          {ONLINE && pushSupported() && (
            <div className="setting">
              <span className="setting-label">{t('reminder')}</span>
              <div className="reminder-row">
                <Seg<string> label={t('reminder')} value={reminder.on ? 'on' : 'off'} onChange={(v) => void applyReminder(v === 'on', reminder.hour, reminder.minute)} options={[{ v: 'on', label: t('timerOn') }, { v: 'off', label: t('timerOff') }]} />
                <input
                  type="time"
                  className="time-input"
                  aria-label={t('reminder')}
                  value={reminderTime}
                  step={300}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(':').map(Number)
                    if (Number.isNaN(h)) return
                    void applyReminder(reminder.on, h, m || 0)
                  }}
                />
              </div>
              <span className="setting-hint">{reminderNote || t('reminderHint')}</span>
            </div>
          )}
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
        <footer className="home-footer">
          {t('attribution')} {'·'}{' '}
          <button type="button" className="link-btn" onClick={onAbout}>
            {t('about')}
          </button>
        </footer>
      </div>
    </div>
  )
}
