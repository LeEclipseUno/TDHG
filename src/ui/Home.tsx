import { useEffect, useState } from 'react'
import type { GameData, Tier } from '../data'
import type { Deck } from '../game/learn'
import { useLang, type Lang } from '../i18n'
import { getLastMode, MODES, VARIANTS, dailyShareText, getBest, type Challenge, type ModeId, type PostStyle, type Settings, type Variant } from '../game/session'
import { isPlusMode } from '../game/premium'
import { canRepairStreak, dailyMode, dailyNumber, getDailyResult, getPersonal, getStreak, msUntilNextDaily } from '../game/daily'
import { season, SEASON_TEXT } from '../game/season'
import { Board, Matrix, Seg } from './widgets'
import { trialAvailable } from '../game/trial'
import { IconGoogle, IconLock, IconPlusSign, IconReplay, IconShare, IconSignArrow, PictDistance, PictSign, PictDrag, PictExit, PictFind, PictGroup, PictJunction, PictLearn, PictQuiz, PictRoute, PictStats, SeasonIcon, IconFreeze } from './icons'
import { AdSlot } from './AdSlot'
import { InitialsShield } from './icons'
import { Logo } from './Logo'
import { sfx } from '../game/sound'

/** One or two capitals from the name, or the mail address. */
export function initials(a: { name?: string; email?: string }): string {
  const src = (a.name ?? a.email?.split('@')[0] ?? '?').trim()
  const parts = src.split(/[\s.\-_]+/).filter(Boolean)
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : src.slice(0, 2)).toUpperCase()
}

import { THEME_NAMES, type ThemeName } from '../map/theme'
import { getNickname, ONLINE, type Account } from '../game/backend'
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
  groupsNew?: boolean
  challenge: Challenge | null
  onChallenge: () => void
  onInstall?: () => void
  account: Account
  onSignIn: () => void
  plus: boolean
  onPlus: () => void
  onArchive: () => void
  onPersonal: () => void
  onRepair: () => void
}

const PICTS: Record<ModeId, typeof PictDrag> = { drag: PictDrag, find: PictFind, junction: PictJunction, quiz: PictQuiz, exit: PictExit, route: PictRoute, distance: PictDistance, sign: PictSign }

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
      <svg className="lang-post" width="140" height="66" viewBox="0 0 140 66" role="group" aria-label={label}>
        <rect x="65" y="20" width="10" height="46" rx="2" fill="#7f868e" />
        <rect x="65" y="20" width="4" height="46" rx="2" fill="#a2a8ae" />
        <rect x="8" y="44" width="124" height="4" rx="1" fill="#5c636b" />
        <g transform="translate(2 0)">{plate('nl', 0, 'Li')}</g>
        <g transform="translate(74 0)">{plate('en', 0, 'Re')}</g>
      </svg>
    </div>
  )
}

/** The play streak as a row of hectometre posts. */
export function StreakPosts({ count, gold = false, style }: { count: number; gold?: boolean; style?: PostStyle }) {
  const shown = Math.max(1, Math.min(count, 14))
  const cls = style ? ` streak-${style}` : gold ? ' streak-gold' : ''
  return (
    <span className={'streak' + cls} title={String(count)}>
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className={'streak-post' + (i < count ? ' streak-post-on' : '')} />
      ))}
      <span className="streak-count">{count}</span>
    </span>
  )
}

export const isIosSafari = /iphone|ipad|ipod/i.test(navigator.userAgent) && !('standalone' in navigator && (navigator as { standalone?: boolean }).standalone)
// Installed app, or ?standalone=1 to preview the installed layout in a normal browser.
export const isStandalone = window.matchMedia('(display-mode: standalone)').matches || new URLSearchParams(location.search).has('standalone')

export function Home({ data, settings, onSettings, onPlay, onDaily, onLearn, onStats, onAbout, onGroups, groupsNew, challenge, onChallenge, onInstall, account, onSignIn, plus, onPlus, onArchive, onPersonal, onRepair }: HomeProps) {
  const { t, lang, setLang } = useLang()
  const tiers: Tier[] = ['A', 'N', 'AN', 'P']
  const n = dailyNumber()
  const daily = getDailyResult(n)
  const streak = getStreak()
  const repair = plus ? canRepairStreak() : null
  const personal = getPersonal()
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
  // Easter egg: type a road number on the home screen, or tap the shield, and the logo shows that road.
  const [logoCode, setLogoCode] = useState('A')
  useEffect(() => {
    let buf = ''
    let timer = 0
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (!/^[a-zA-Z0-9]$/.test(e.key)) return
      buf = (buf + e.key.toUpperCase()).slice(-4)
      window.clearTimeout(timer)
      // Wait for the whole number, then take the longest road that matches the end of what was typed.
      timer = window.setTimeout(() => {
        for (let len = 4; len >= 2; len--) {
          const cand = buf.slice(-len)
          if (/^[AN]\d{1,3}$/.test(cand) && data.byRef.has(cand)) {
            setLogoCode(cand)
            break
          }
        }
        buf = ''
      }, 600)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(timer)
    }
  }, [data])
  // Once per day, right after the daily is done, the shield shows the day's number for a moment.
  const dailyDone = !!daily
  useEffect(() => {
    if (!dailyDone) return
    let seen = ''
    try {
      seen = localStorage.getItem('tdhg:v1:logoFlip') ?? ''
    } catch {
      /* ignore */
    }
    if (seen === String(n)) return
    try {
      localStorage.setItem('tdhg:v1:logoFlip', String(n))
    } catch {
      /* ignore */
    }
    setLogoCode(`#${n}`)
    const timer = window.setTimeout(() => setLogoCode('A'), 1600)
    return () => window.clearTimeout(timer)
  }, [dailyDone, n])
  const cycleLogo = () => {
    // Two-digit numbers only: three digits crowd the shield.
    const pool = data.roads.filter((r) => (r.kind === 'A' || r.kind === 'N') && r.num < 100)
    const pick = pool[Math.floor(Math.random() * pool.length)]
    if (pick) setLogoCode(pick.ref)
    sfx.tap()
  }

  const trialOpen = !plus && trialAvailable()
  // The mode you played last goes first.
  const lastMode = getLastMode()
  const orderedModes = lastMode ? [lastMode, ...MODES.filter((m) => m !== lastMode)] : MODES

  return (
    <div className={'home' + (s ? ` season-${s}` : '')}>
      <div className="home-backdrop" aria-hidden>
        <DriftMap data={data} />
      </div>
      <div className="home-inner">
        <header className="home-header">
          <div className="home-topbar">
            {ONLINE && account.signedIn ? (
              <button type="button" className={'avatar-btn' + (plus ? ' avatar-plus' : '')} onClick={onStats} aria-label={t('stats')}>
                {account.avatar ? <img className="avatar-img" src={account.avatar} alt="" referrerPolicy="no-referrer" /> : plus ? <span className="avatar-img avatar-shield"><InitialsShield text={initials(account)} style={settings.shieldStyle} /></span> : <span className="avatar-img avatar-fallback">{initials(account).slice(0, 1)}</span>}
                <span className="avatar-text">
                  <span className="avatar-name">{getNickname() || account.name || account.email?.split('@')[0]}</span>
                  <span className="avatar-sub">{t('stats')}</span>
                </span>
              </button>
            ) : (
              <span />
            )}
            <LangPost
              lang={lang}
              onChange={(l) => {
                sfx.post()
                setLang(l)
              }}
              label={t('language')}
            />
          </div>
          <div className="home-logo-wrap">
            <Logo code={logoCode} plus={plus} onShieldTap={cycleLogo} />
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
                {t('streak')} <StreakPosts count={streak.count} style={plus ? settings.postStyle : undefined} />
                {plus && streak.freeze === new Date().toISOString().slice(0, 7) && (
                  <small className="frozen-tag" title={t('freezeUsed')}>
                    <IconFreeze /> {t('frozen')}
                  </small>
                )}
                {streak.best > 1 && (
                  <small>
                    {t('best')} {streak.best}
                  </small>
                )}
              </span>
              {repair && (
                <button type="button" className="repair-btn" onClick={onRepair} title={t('repairHint')}>
                  {t('repairStreak', { n: repair.days })}
                </button>
              )}
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

        {plus && daily && (
          <Board className="personal-board">
            <div className="board-title daily-title">
              <span>{t('personalDaily')}</span>
              <span className="daily-mode">{t('mode_find')}</span>
            </div>
            {personal ? (
              <div className="daily-body">
                <span className="sign-pict">
                  <PictFind />
                </span>
                <div className="daily-text">
                  <span className="daily-line">{t('personalDone', { score: personal.score, good: personal.good, total: personal.total })}</span>
                  <span className="daily-sub">{t('personalPitch')}</span>
                </div>
                <Matrix value={personal.score} label={t('score')} />
              </div>
            ) : (
              <button type="button" className="sign-row" onClick={onPersonal}>
                <span className="sign-pict">
                  <PictFind />
                </span>
                <span className="sign-text">
                  <span className="sign-name">{t('playPersonal')}</span>
                  <span className="sign-desc">{t('personalPitch')}</span>
                </span>
                <IconSignArrow className="sign-arrow" />
              </button>
            )}
          </Board>
        )}

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
          {orderedModes.map((mode) => {
            const best = getBest(mode, settings.tier, settings.timer, settings.variant, settings.province)
            const Pict = PICTS[mode]
            const plusOnly = isPlusMode(mode) && !plus
            const trial = plusOnly && trialOpen
            const locked = plusOnly && !trial
            const last = mode === lastMode
            return (
              <button key={mode} type="button" className={'sign-row' + (locked ? ' sign-row-locked' : '')} onClick={() => (locked ? onPlus() : onPlay(mode))}>
                <span className="sign-pict">
                  <Pict />
                </span>
                <span className="sign-text">
                  <span className="sign-name">
                    {t(`mode_${mode}`)}
                    {locked && <span className="locked-tag">{t('plusTag')}</span>}
                    {trial && <span className="locked-tag trial-tag">{t('trialTag')}</span>}
                    {last && !locked && <span className="last-tag">{t('lastPlayed')}</span>}
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

        <AdSlot place="home" plus={plus} />

        {!plus && (
          <button type="button" className="google-row plus-row" onClick={onPlus}>
            <span className="google-row-icon plus-row-icon">
              <IconPlusSign />
            </span>
            <span className="sign-text">
              <span className="google-row-name">{t('plus')}</span>
              <span className="google-row-sub">{t('plusPitchBar')}</span>
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
                <span className="sign-name">
                  {t('groups')}
                  {groupsNew && <span className="new-dot" aria-label={t('newScores')} />}
                </span>
                <span className="sign-desc">{groupsNew ? t('newScores') : t('groups_desc')}</span>
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
          <div className="board-title">{t('settings')}</div>
          <div className="setting">
            <span className="setting-label">{t('roads')}</span>
            <Seg<Tier> wide label={t('roads')} value={plus || settings.tier !== 'P' ? settings.tier : 'A'} onChange={(tier) => (tier === 'P' && !plus ? onPlus() : onSettings({ ...settings, tier }))} options={tiers.map((v) => ({ v, label: t(`tier_${v}_short`), title: t(`tier_${v}`), locked: v === 'P' && !plus }))} />
            <span className="setting-hint">{t(`tier_${settings.tier}`)}</span>
          </div>
          <div className="setting-pair">
            <div className="setting">
              <span className="setting-label">{t('timer')}</span>
              <Seg<'on' | 'off'> wide label={t('timer')} value={settings.timer ? 'on' : 'off'} onChange={(v) => onSettings({ ...settings, timer: v === 'on' })} options={[{ v: 'on', label: t('timerOn') }, { v: 'off', label: t('timerOff') }]} />
            </div>
            <div className="setting">
              <span className="setting-label">{t('sound')}</span>
              <Seg<'on' | 'off'> wide label={t('sound')} value={settings.sound ? 'on' : 'off'} onChange={(v) => onSettings({ ...settings, sound: v === 'on' })} options={[{ v: 'on', label: t('timerOn') }, { v: 'off', label: t('timerOff') }]} />
            </div>
          </div>
          <div className="setting">
            <span className="setting-label">{t('variant')}</span>
            <Seg<Variant> wide label={t('variant')} value={settings.variant} onChange={(variant) => onSettings({ ...settings, variant })} options={VARIANTS.map((v) => ({ v, label: t(`variant_${v}`) }))} />
            <span className="setting-hint">{t(`variantHint_${settings.variant}`)}</span>
          </div>
          <div className="setting">
            <span className="setting-label">
              {t('theme')} <span className="locked-tag">{t('plusTag')}</span>
            </span>
            <Seg<ThemeName> wide label={t('theme')} value={plus ? settings.theme : 'signage'} onChange={(theme) => (plus || theme === 'signage' ? onSettings({ ...settings, theme }) : onPlus())} options={THEME_NAMES.map((v) => ({ v, label: t(`theme_${v}` as 'theme_signage'), locked: !plus && v !== 'signage' }))} />
            {!plus && (
              <button type="button" className="setting-hint setting-hint-link" onClick={onPlus}>
                {t('plusSettingsHint')}
              </button>
            )}
          </div>
          {plus && (
          <div className="setting">
            <span className="setting-label">{t('learnDeck')}</span>
            <Seg<Deck> wide label={t('learnDeck')} value={settings.learnDeck} onChange={(learnDeck) => onSettings({ ...settings, learnDeck })} options={[{ v: 'roads', label: t('deck_roads') }, { v: 'junctions', label: t('deck_junctions') }]} />
          </div>
          )}
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
