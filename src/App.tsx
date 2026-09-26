import { useEffect, useState, type ReactNode } from 'react'
import { loadData, type GameData } from './data'
import { LangProvider, useLang } from './i18n'
import { dailySeedOn, dateKey, loadSettings, MODES, newSession, parseChallenge, saveSettings, submitBest, summarize, type Challenge, type ModeId, type Session, type Settings } from './game/session'
import { dailyDate, dailyMode, dailyNumber, getDailyResult, marksOf, saveDailyResult, updateBadge } from './game/daily'
import { loadArchive, picksFor } from './game/archive'
import { hasPlus, isPlusMode, rememberPlus } from './game/premium'
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
import { recordSession } from './game/history'
import { setSoundEnabled } from './game/sound'
import { getAccount, ONLINE, signInWithGoogle, signOut, type Account } from './game/backend'
import { pushSoon, syncNow } from './game/sync'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
}

type Screen = { kind: 'home' } | { kind: 'learn' } | { kind: 'stats' } | { kind: 'about' } | { kind: 'plus' } | { kind: 'archive' } | { kind: 'groups'; joinCode?: string } | { kind: 'game'; session: Session } | { kind: 'results'; session: Session; newBest: boolean; streak: number }

const MODE_COMPONENTS = { drag: DragMode, find: FindMode, junction: JunctionMode, quiz: QuizMode, exit: ExitMode, route: RouteMode } as const

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
    setHash(mode)
    setScreen({ kind: 'game', session: newSession(mode, settings) })
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
      setScreen({ kind: 'results', session, newBest: false, streak: 0 })
      return
    }
    recordSession(session)
    let streak = 0
    if (session.dailyNumber) {
      const sum = summarize(session)
      const st = saveDailyResult(session.dailyNumber, { score: sum.score, good: sum.good, total: sum.total, ms: sum.ms, marks: marksOf(session) })
      if (session.dailyNumber === dailyNumber()) streak = st.count
      updateBadge()
    }
    setScreen({ kind: 'results', session, newBest: submitBest(session), streak })
    if (account.signedIn) pushSoon()
  }

  // Deep links: on first load and whenever the hash changes while the app is open (invite links, back button).
  const route = (h: string) => {
    if (h === 'daily') playDaily()
    else if (MODES.includes(h as ModeId)) play(h as ModeId)
    else if (h === 'stats' || h === 'about' || h === 'groups' || h === 'plus') go(h)
    else if (h === 'archive') go(plus ? 'archive' : 'plus')
    else if (h === 'learn') go(plus ? 'learn' : 'plus')
    else if (h.startsWith('join-')) setScreen({ kind: 'groups', joinCode: h.slice(5).toUpperCase() })
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
    <div className="screen" key={key}>
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
  )

  if (error) return <div className="loading">{t('loadError')}</div>
  if (!data)
    return (
      <div className="loading">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="loading-logo" />
        <div className="road-loader" />
        <span>{t('loading')}</span>
      </div>
    )

  if (screen.kind === 'game') {
    const Mode = MODE_COMPONENTS[screen.session.mode]
    return wrap('game' + screen.session.seed, <Mode data={data} session={screen.session} onQuit={() => go('home')} onFinish={finish} />)
  }
  if (screen.kind === 'learn') return wrap('learn', <LearnMode data={data} settings={settings} onExit={() => go('home')} />)
  if (screen.kind === 'stats') return wrap('stats', <Stats data={data} onHome={() => go('home')} />)
  if (screen.kind === 'about') return wrap('about', <About data={data} onHome={() => go('home')} />)
  if (screen.kind === 'plus') return wrap('plus', <Plus data={data} account={account} onSignIn={signIn} onRefresh={refreshAccount} onHome={() => go('home')} />)
  if (screen.kind === 'archive') return wrap('archive', <Archive data={data} onPlay={(n) => void playDaily(n)} onHome={() => go('home')} />)
  if (screen.kind === 'groups') return wrap('groups', <Groups data={data} onHome={() => go('home')} joinCode={screen.joinCode} />)
  if (screen.kind === 'results') {
    const again = () => (screen.session.dailyNumber ? void playDaily(screen.session.dailyNumber) : play(screen.session.mode))
    return wrap('results', <Results data={data} session={screen.session} newBest={screen.newBest} streak={screen.streak} onAgain={again} onHome={() => go('home')} />)
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
      onStats={() => go('stats')}
      onAbout={() => go('about')}
      onGroups={() => go('groups')}
      challenge={challenge}
      onChallenge={playChallenge}
      onInstall={installEvt ? () => installEvt.prompt().then(() => setInstallEvt(null)) : undefined}
      account={account}
      onSignIn={signIn}
      onSignOut={doSignOut}
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
