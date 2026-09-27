import { useEffect, useState, type ReactNode } from 'react'
import { loadData, type GameData } from './data'
import { LangProvider, useLang } from './i18n'
import { dailySeedOn, dateKey, loadSettings, MODES, newSession, parseChallenge, saveSettings, submitBest, summarize, type Challenge, type ModeId, type Session, type Settings } from './game/session'
import { dailyDate, dailyMode, dailyNumber, getDailyResult, marksOf, repairStreak, saveDailyResult, savePersonal, updateBadge } from './game/daily'
import { loadLabelStats } from './game/history'
import { roadsForTier } from './data'
import { loadArchive, picksFor } from './game/archive'
import { hasPlus, isPlusMode, rememberPlus, rememberReferral } from './game/premium'
import { updateBadges, type BadgeId } from './game/achievements'
import { Plus } from './ui/Plus'
import { Archive } from './ui/Archive'
import { Home } from './ui/Home'
import { Results } from './ui/Results'
import { Stats } from './ui/Stats'
import { About } from './ui/About'
import { Groups } from './ui/Groups'
import { DragMode } from './modes/DragMode'
import { FindMode } from './modes/FindMode'
import { JunctionMode } from './modes/JunctionMode'
import { QuizMode } from './modes/QuizMode'
import { LearnMode } from './modes/LearnMode'
import { ExitMode } from './modes/ExitMode'
import { RouteMode } from './modes/RouteMode'
import { DistanceMode } from './modes/DistanceMode'
import { SignMode } from './modes/SignMode'
import { AccessCtx, seasonalTheme, ThemeCtx } from './map/theme'
import { recordSession } from './game/history'
import { setSoundEnabled } from './game/sound'
import { getAccount, ONLINE, signInWithGoogle, signOut, type Account } from './game/backend'
import { pushSoon, syncNow } from './game/sync'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
}

type Screen = { kind: 'home' } | { kind: 'learn' } | { kind: 'stats' } | { kind: 'about' } | { kind: 'plus' } | { kind: 'archive' } | { kind: 'groups'; joinCode?: string } | { kind: 'game'; session: Session } | { kind: 'results'; session: Session; newBest: boolean; streak: number; badges: BadgeId[] }

const MODE_COMPONENTS = { drag: DragMode, find: FindMode, junction: JunctionMode, quiz: QuizMode, exit: ExitMode, route: RouteMode, distance: DistanceMode, sign: SignMode } as const

/** Deep links: #daily, #find, #quiz, #junction, #drag, #exit, #route, #learn, #stats, #about, #groups, #join-CODE */
function readHash(): string {
  return location.hash.replace('#', '').toLowerCase()
}
function setHash(h: string) {
  const url = location.pathname + location.search + (h ? '#' + h : '')
  if (location.hash !== (h ? '#' + h : '')) history.replaceState(null, '', url)
}

function Shell() {
  const { t } = useLang()
  const [data, setData] = useState<GameData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettingsState] = useState<Settings>(loadSettings)
  const [screen, setScreen] = useState<Screen>({ kind: 'home' })
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [account, setAccount] = useState<Account>({ signedIn: false })
  const [notice, setNotice] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<Challenge | null>(() => {
    const c = parseChallenge(location.search)
    if (c) history.replaceState(null, '', location.pathname + location.hash)
    return c
  })

  useEffect(() => {
    // Cloud state comes in before the menu reads local storage, so a signed-in player sees their progress at once.
    // Back from Google with "identity already linked to another user": that account exists already,
    // so sign in as it instead of linking this device's anonymous player.
    if (ONLINE && /error_code=identity_already_exists/.test(location.hash)) {
      history.replaceState(null, '', location.pathname + location.search)
      void signInWithGoogle(true)
      return
    }
    loadData()
      .then(async (d) => {
        if (ONLINE) {
          // Only a successful answer may clear a cached Plus pass; offline keeps the last known state.
          const acc = await getAccount().then((a) => (rememberPlus(a.plusUntil), a)).catch(() => ({ signedIn: false }) as Account)
          setAccount(acc)
          // Back from Google: drop the one-time code (or error) from the address bar.
          const q = new URLSearchParams(location.search)
          if (q.has('code') || q.has('error')) {
            for (const k of ['code', 'error', 'error_code', 'error_description']) q.delete(k)
            const rest = q.toString()
            history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash)
          }
          if (acc.signedIn) await syncNow().catch(() => {})
        }
        setData(d)
      })
      .catch((e: unknown) => setError(String(e)))
    updateBadge()
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', () => setInstallEvt(null))
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const setSettings = (s: Settings) => {
    setSettingsState(s)
    saveSettings(s)
    setSoundEnabled(s.sound)
    if (account.signedIn) pushSoon()
  }
  const signIn = async () => {
    const r = await signInWithGoogle()
    if (r === 'off') setNotice(t('googleOff'))
    else if (r === 'error') setNotice(t('signInError'))
    if (r !== 'redirect') setTimeout(() => setNotice(null), 3000)
  }
  const doSignOut = async () => {
    await signOut()
    setAccount({ signedIn: false })
    rememberPlus(undefined)
  }
  const refreshAccount = async () => {
    const acc = await getAccount().then((a) => (rememberPlus(a.plusUntil), a)).catch(() => ({ signedIn: false }) as Account)
    setAccount(acc)
  }
  const plus = hasPlus(account)

  useEffect(() => {
    setSoundEnabled(settings.sound)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const play = (mode: ModeId) => {
    if (isPlusMode(mode) && !plus) return go('plus')
    const tierSettings = settings.tier === 'P' && !plus ? { ...settings, tier: 'A' as const } : settings
    setHash(mode)
    const start = () => setScreen({ kind: 'game', session: newSession(mode, tierSettings) })
    if (tierSettings.tier === 'P' && data) void data.ready.then(start)
    else start()
  }
  /** Plus: five of your weakest roads as a second daily, only after the real one. */
  const playPersonal = () => {
    if (!plus || !data || !getDailyResult(dailyNumber())) return
    const labels = loadLabelStats()
    const pool = roadsForTier(data, settings.tier === 'N' ? 'N' : 'A')
    const scored = pool
      .map((r) => ({ r, s: labels[r.ref] }))
      .filter((x) => x.s && x.s.r + x.s.w > 0)
      .sort((a, b) => a.s.r / (a.s.r + a.s.w) - b.s.r / (b.s.r + b.s.w) || b.s.w - a.s.w)
    const picks = scored.slice(0, 5).map((x) => x.r.ref)
    const unseen = pool.filter((r) => !labels[r.ref]).sort(() => Math.random() - 0.5)
    for (const r of unseen) {
      if (picks.length >= 5) break
      picks.push(r.ref)
    }
    if (picks.length < 5) return
    setHash('personal')
    const session = newSession('find', { ...settings, timer: true, variant: 'normal' })
    setScreen({ kind: 'game', session: { ...session, picks, personal: true } })
  }
  const doRepair = () => {
    if (!plus) return
    if (repairStreak()) {
      setNotice(t('repaired'))
      setTimeout(() => setNotice(null), 2500)
      setScreen({ kind: 'home' })
    }
  }
  /** Today's daily, or an earlier one from the archive (Plus). A day already scored replays as practice. */
  const playDaily = async (n?: number) => {
    const today = dailyNumber()
    const num = n ?? today
    if (num !== today && !plus) return go('plus')
    if (num > today || num < 1) return
    setHash('daily')
    const picks = picksFor(await loadArchive(), num)
    const mode = dailyMode(num)
    const seed = num === today ? undefined : dailySeedOn(dateKey(dailyDate(num)), mode, 'A')
    setScreen({ kind: 'game', session: newSession(mode, settings, undefined, num, { picks: picks ?? undefined, practice: !!getDailyResult(num), seed }) })
  }
  const playChallenge = () => {
    if (!challenge) return
    setHash('')
    setScreen({ kind: 'game', session: newSession(challenge.mode, settings, challenge) })
    setChallenge(null)
  }
  const go = (kind: 'home' | 'learn' | 'stats' | 'about' | 'groups' | 'plus' | 'archive') => {
    setHash(kind === 'home' ? '' : kind)
    setScreen({ kind })
  }
  const finish = (session: Session) => {
    if (session.practice) {
      setScreen({ kind: 'results', session, newBest: false, streak: 0, badges: [] })
      return
    }
    recordSession(session)
    let streak = 0
    if (session.personal) {
      const sum = summarize(session)
      savePersonal({ score: sum.score, good: sum.good, total: sum.total })
    }
    if (session.dailyNumber) {
      const sum = summarize(session)
      const st = saveDailyResult(session.dailyNumber, { score: sum.score, good: sum.good, total: sum.total, ms: sum.ms, marks: marksOf(session) })
      if (session.dailyNumber === dailyNumber()) streak = st.count
      updateBadge()
    }
    const newBest = submitBest(session)
    setScreen({ kind: 'results', session, newBest, streak, badges: data ? updateBadges(data) : [] })
    if (account.signedIn) pushSoon()
  }

  // Deep links: on first load and whenever the hash changes while the app is open (invite links, back button).
  const route = (h: string) => {
    if (h === 'daily') playDaily()
    else if (h === 'personal') playPersonal()
    else if (MODES.includes(h as ModeId)) play(h as ModeId)
    else if (h === 'stats' || h === 'about' || h === 'groups' || h === 'plus') go(h)
    else if (h === 'archive') go(plus ? 'archive' : 'plus')
    else if (h === 'learn') go(plus ? 'learn' : 'plus')
    else if (h.startsWith('join-')) setScreen({ kind: 'groups', joinCode: h.slice(5).toUpperCase() })
    else if (h.startsWith('plus-')) {
      rememberReferral(h.slice(5).toUpperCase())
      go('plus')
    }
    else if (h === '') setScreen({ kind: 'home' })
  }
  useEffect(() => {
    if (!data) return
    if (readHash()) route(readHash())
    const onHash = () => route(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const wrap = (key: string, node: ReactNode) => (
    <ThemeCtx.Provider value={seasonalTheme(plus ? settings.theme : 'signage') ?? (plus ? settings.theme : 'signage')} key={key}>
    <AccessCtx.Provider value={settings.colorblind}>
    <div className={'screen' + (settings.colorblind ? ' cb' : '')}>
      {!online && (
        <div role="status" className="offline-bar">
          {t('offline')}
        </div>
      )}
      {notice && (
        <div role="status" className="offline-bar notice-bar">
          {notice}
        </div>
      )}
      {node}
    </div>
    </AccessCtx.Provider>
    </ThemeCtx.Provider>
  )

  if (error) return <div className="loading">{t('loadError')}</div>
  if (!data)
    return (
      <div className="loading skeleton" aria-busy="true" aria-label={t('loading')}>
        <div className="skeleton-inner">
          <div className="skeleton-lang" />
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="loading-logo" />
          <div className="skeleton-line" />
          <div className="skeleton-board tall" />
          <div className="skeleton-row" />
          <div className="skeleton-board" />
          <div className="skeleton-board" />
        </div>
      </div>
    )

  if (screen.kind === 'game') {
    const Mode = MODE_COMPONENTS[screen.session.mode]
    return wrap('game' + screen.session.seed, <Mode data={data} session={screen.session} onQuit={() => go('home')} onFinish={finish} />)
  }
  if (screen.kind === 'learn') return wrap('learn', <LearnMode data={data} settings={settings} onExit={() => go('home')} />)
  const wipeLocal = () => {
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('tdhg:')) localStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  }
  const afterDelete = () => {
    wipeLocal()
    setAccount({ signedIn: false })
    rememberPlus(undefined)
    setNotice(t('deleted'))
    setTimeout(() => setNotice(null), 3000)
    go('home')
  }
  if (screen.kind === 'stats') return wrap('stats', <Stats data={data} account={account} plus={plus} onSignOut={doSignOut} onPlus={() => go('plus')} onDeleted={afterDelete} onNotice={(m) => { setNotice(m); setTimeout(() => setNotice(null), 3000) }} onHome={() => go('home')} />)
  if (screen.kind === 'about') return wrap('about', <About data={data} onHome={() => go('home')} />)
  if (screen.kind === 'plus') return wrap('plus', <Plus data={data} account={account} onSignIn={signIn} onRefresh={refreshAccount} onNotice={(m) => { setNotice(m); setTimeout(() => setNotice(null), 2500) }} onHome={() => go('home')} />)
  if (screen.kind === 'archive') return wrap('archive', <Archive data={data} onPlay={(n) => void playDaily(n)} onHome={() => go('home')} />)
  if (screen.kind === 'groups') return wrap('groups', <Groups data={data} onHome={() => go('home')} joinCode={screen.joinCode} />)
  if (screen.kind === 'results') {
    const again = () => (screen.session.dailyNumber ? void playDaily(screen.session.dailyNumber) : play(screen.session.mode))
    return wrap('results', <Results data={data} session={screen.session} newBest={screen.newBest} streak={screen.streak} badges={screen.badges} plus={plus} onAgain={again} onHome={() => go('home')} />)
  }
  return wrap(
    'home',
    <Home
      data={data}
      settings={settings}
      onSettings={setSettings}
      onPlay={play}
      onDaily={() => void playDaily()}
      onLearn={() => go(plus ? 'learn' : 'plus')}
      plus={plus}
      onPlus={() => go('plus')}
      onArchive={() => go(plus ? 'archive' : 'plus')}
      onPersonal={playPersonal}
      onRepair={doRepair}
      onStats={() => go('stats')}
      onAbout={() => go('about')}
      onGroups={() => go('groups')}
      challenge={challenge}
      onChallenge={playChallenge}
      onInstall={installEvt ? () => installEvt.prompt().then(() => setInstallEvt(null)) : undefined}
      account={account}
      onSignIn={signIn}
    />,
  )
}

export default function App() {
  return (
    <LangProvider>
      <Shell />
    </LangProvider>
  )
}
