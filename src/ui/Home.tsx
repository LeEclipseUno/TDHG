import { useMemo } from 'react'
import type { GameData, Tier } from '../data'
import { buildDeck, deckStats, loadStates, type Deck } from '../game/learn'
import { useLang, type Lang } from '../i18n'
import { MODES, VARIANTS, getBest, type Challenge, type ModeId, type Settings, type Variant } from '../game/session'
import { dailyMode, dailyNumber, getDailyResult, getStreak, msUntilNextDaily } from '../game/daily'
import { season, SEASON_TEXT } from '../game/season'
import { Board, Matrix } from './widgets'
import { IconSignArrow, PictDrag, PictExit, PictFind, PictGroup, PictJunction, PictLearn, PictQuiz, PictRoute, PictStats, SeasonIcon } from './icons'
import { ONLINE } from '../game/backend'
import MapView from '../map/MapView'
import { useNow } from '../game/hooks'

export interface HomeProps {
  data: GameData
  settings: Settings
  onSettings: (s: Settings) => void
  onPlay: (mode: ModeId) => void
  onDaily: () => void
  onLearn: () => void
  onStats: () => void
  onAbout: () => void
  onGroups: () => void
  challenge: Challenge | null
  onChallenge: () => void
  onInstall?: () => void
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

/** Language switch drawn as a hectometerpaal: green post, two plates, the active language lit. */
function LangPost({ lang, onChange, label }: { lang: Lang; onChange: (l: Lang) => void; label: string }) {
  const plate = (l: Lang, y: number) => {
    const on = l === lang
    return (
      <g key={l} onClick={() => onChange(l)} style={{ cursor: 'pointer' }}>
        <rect x="3" y={y} width="30" height="24" rx="2.5" fill={on ? '#fff' : '#155c34'} stroke={on ? '#fff' : '#2aa563'} strokeWidth="1" />
        <text x="18" y={y + 16.5} textAnchor="middle" fontFamily="'Barlow Condensed', system-ui, sans-serif" fontSize="14" fontWeight="800" fill={on ? '#111' : 'rgba(255,255,255,0.55)'}>
          {l.toUpperCase()}
        </text>
      </g>
    )
  }
  return (
    <div className="home-lang">
      <svg className="lang-post" width="36" height="78" viewBox="0 0 36 78" role="group" aria-label={label}>
        <rect x="11" y="2" width="14" height="76" rx="3" fill="#1f8f4e" />
        <rect x="11" y="2" width="14" height="4" rx="2" fill="#7fd5a3" />
        {plate('nl', 8)}
        {plate('en', 40)}
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

export function Home({ data, settings, onSettings, onPlay, onDaily, onLearn, onStats, onAbout, onGroups, challenge, onChallenge, onInstall }: HomeProps) {
  const { t, lang, setLang } = useLang()
  const tiers: Tier[] = ['A', 'AN', 'ALL']
  const learnStats = useMemo(() => deckStats(buildDeck(data, settings.tier, settings.learnDeck), loadStates()), [data, settings.tier, settings.learnDeck])
  const n = dailyNumber()
  const daily = getDailyResult(n)
  const streak = getStreak()
  const now = useNow(!!daily, 1000)
  const left = msUntilNextDaily(new Date(now))
  const hh = Math.floor(left / 3_600_000)
  const mm = Math.floor((left % 3_600_000) / 60_000)
  const s = season()
  const DailyPict = PICTS[dailyMode(n)]

  return (
    <div className={'home' + (s ? ` season-${s}` : '')}>
      <div className="home-backdrop" aria-hidden>
        <MapView data={data} tier="A" interactive={false} drift />
      </div>
      <div className="home-inner">
        <header className="home-header">
          <LangPost lang={lang} onChange={setLang} label={t('language')} />
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
          <button type="button" className="sign-row daily-play" onClick={onDaily}>
            <span className="sign-text">
              <span className="sign-name">{daily ? t('playAgain') : t('playDaily')}</span>
            </span>
            <IconSignArrow className="sign-arrow" />
          </button>
        </Board>

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
            const best = getBest(mode, settings.tier, settings.timer, settings.variant)
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
                {learnStats.due} {t('due')} {'·'} {learnStats.total - learnStats.seen} {t('newCards')} {'·'} {learnStats.mature} {t('learned')}
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
              <span className="setting-label">{t('sound')}</span>
              <Seg<'on' | 'off'> label={t('sound')} value={settings.sound ? 'on' : 'off'} onChange={(v) => onSettings({ ...settings, sound: v === 'on' })} options={[{ v: 'on', label: t('timerOn') }, { v: 'off', label: t('timerOff') }]} />
            </div>
          </div>
          <div className="setting">
            <span className="setting-label">{t('variant')}</span>
            <Seg<Variant> wide label={t('variant')} value={settings.variant} onChange={(variant) => onSettings({ ...settings, variant })} options={VARIANTS.map((v) => ({ v, label: t(`variant_${v}`) }))} />
            <span className="setting-hint">{t(`variantHint_${settings.variant}`)}</span>
          </div>
          <div className="setting">
            <span className="setting-label">{t('learnDeck')}</span>
            <Seg<Deck> label={t('learnDeck')} value={settings.learnDeck} onChange={(learnDeck) => onSettings({ ...settings, learnDeck })} options={[{ v: 'roads', label: t('deck_roads') }, { v: 'junctions', label: t('deck_junctions') }]} />
          </div>
        </Board>

        <button type="button" className="install-row" onClick={onStats}>
          <span className="install-icon" aria-hidden>
            <PictStats width={30} height={30} />
          </span>
          <span className="sign-text">
            <span className="install-name">{t('stats')}</span>
          </span>
        </button>
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
