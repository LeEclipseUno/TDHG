import { useEffect, useState, type ReactNode } from 'react'
import { loadData, type GameData } from './data'
import { LangProvider, useLang } from './i18n'
import { loadSettings, MODES, newSession, parseChallenge, saveSettings, submitBest, summarize, type Challenge, type ModeId, type Session, type Settings } from './game/session'
import { dailyMode, dailyNumber, marksOf, saveDailyResult, updateBadge } from './game/daily'
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

type Screen = { kind: 'home' } | { kind: 'learn' } | { kind: 'stats' } | { kind: 'about' } | { kind: 'groups'; joinCode?: string } | { kind: 'game'; session: Session } | { kind: 'results'; session: Session; newBest: boolean; streak: number }

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
    loadData()
      .then(async (d) => {
        if (ONLINE) {
          const acc = await getAccount().catch(() => ({ signedIn: false }) as Account)
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
  }

  useEffect(() => {
    setSoundEnabled(settings.sound)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const play = (mode: ModeId) => {
    setHash(mode)
    setScreen({ kind: 'game', session: newSession(mode, settings) })
  }
  const playDaily = () => {
    const n = dailyNumber()
    setHash('daily')
    setScreen({ kind: 'game', session: newSession(dailyMode(n), settings, undefined, n) })
  }
  const playChallenge = () => {
    if (!challenge) return
    setHash('')
    setScreen({ kind: 'game', session: newSession(challenge.mode, settings, challenge) })
    setChallenge(null)
  }
  const go = (kind: 'home' | 'learn' | 'stats' | 'about' | 'groups') => {
    setHash(kind === 'home' ? '' : kind)
    setScreen({ kind })
  }
  const finish = (session: Session) => {
    recordSession(session)
    let streak = 0
    if (session.dailyNumber) {
      const sum = summarize(session)
      streak = saveDailyResult(session.dailyNumber, { score: sum.score, good: sum.good, total: sum.total, ms: sum.ms, marks: marksOf(session) }).count
      updateBadge()
    }
    setScreen({ kind: 'results', session, newBest: submitBest(session), streak })
    if (account.signedIn) pushSoon()
  }

  // Deep links: on first load and whenever the hash changes while the app is open (invite links, back button).
  const route = (h: string) => {
    if (h === 'daily') playDaily()
    else if (MODES.includes(h as ModeId)) play(h as ModeId)
    else if (h === 'stats' || h === 'about' || h === 'groups') go(h)
    else if (h === 'learn') go('home') // locked for now
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
  if (screen.kind === 'groups') return wrap('groups', <Groups data={data} onHome={() => go('home')} joinCode={screen.joinCode} />)
  if (screen.kind === 'results') {
    const again = () => (screen.session.dailyNumber ? playDaily() : play(screen.session.mode))
    return wrap('results', <Results data={data} session={screen.session} newBest={screen.newBest} streak={screen.streak} onAgain={again} onHome={() => go('home')} />)
  }
  return wrap(
    'home',
    <Home
      data={data}
      settings={settings}
      onSettings={setSettings}
      onPlay={play}
      onDaily={playDaily}
      onLearn={() => go('learn')}
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
