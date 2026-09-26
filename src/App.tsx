import { useEffect, useState, type ReactNode } from 'react'
import { loadData, type GameData } from './data'
import { LangProvider, useLang } from './i18n'
import { loadSettings, newSession, parseChallenge, saveSettings, submitBest, type Challenge, type ModeId, type Session, type Settings } from './game/session'
import { Home } from './ui/Home'
import { Results } from './ui/Results'
import { DragMode } from './modes/DragMode'
import { FindMode } from './modes/FindMode'
import { JunctionMode } from './modes/JunctionMode'
import { QuizMode } from './modes/QuizMode'
import { LearnMode } from './modes/LearnMode'
import { ExitMode } from './modes/ExitMode'
import { RouteMode } from './modes/RouteMode'
import { Stats } from './ui/Stats'
import { recordSession } from './game/history'
import { setSoundEnabled } from './game/sound'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
}

type Screen = { kind: 'home' } | { kind: 'learn' } | { kind: 'stats' } | { kind: 'game'; session: Session } | { kind: 'results'; session: Session; newBest: boolean }

const MODE_COMPONENTS = { drag: DragMode, find: FindMode, junction: JunctionMode, quiz: QuizMode, exit: ExitMode, route: RouteMode } as const

function Shell() {
  const { t } = useLang()
  const [data, setData] = useState<GameData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettingsState] = useState<Settings>(loadSettings)
  const [screen, setScreen] = useState<Screen>({ kind: 'home' })
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null)
  const [challenge, setChallenge] = useState<Challenge | null>(() => {
    const c = parseChallenge(location.search)
    if (c) history.replaceState(null, '', location.pathname)
    return c
  })

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', () => setInstallEvt(null))
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  useEffect(() => {
    loadData().then(setData).catch((e: unknown) => setError(String(e)))
  }, [])

  const setSettings = (s: Settings) => {
    setSettingsState(s)
    saveSettings(s)
    setSoundEnabled(s.sound)
  }

  useEffect(() => {
    setSoundEnabled(settings.sound)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const play = (mode: ModeId) => setScreen({ kind: 'game', session: newSession(mode, settings) })
  const playChallenge = () => {
    if (!challenge) return
    setScreen({ kind: 'game', session: newSession(challenge.mode, settings, challenge) })
    setChallenge(null)
  }
  const finish = (session: Session) => {
    recordSession(session)
    setScreen({ kind: 'results', session, newBest: submitBest(session) })
  }

  // Each screen slides in like a sign coming up along the road.
  const wrap = (key: string, node: ReactNode) => (
    <div className="screen" key={key}>
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
    return wrap(
      'game' + screen.session.seed,
      <Mode data={data} session={screen.session} onQuit={() => setScreen({ kind: 'home' })} onFinish={finish} />,
    )
  }
  if (screen.kind === 'learn') return wrap('learn', <LearnMode data={data} settings={settings} onExit={() => setScreen({ kind: 'home' })} />)
  if (screen.kind === 'stats') return wrap('stats', <Stats data={data} onHome={() => setScreen({ kind: 'home' })} />)
  if (screen.kind === 'results') {
    return wrap('results', <Results data={data} session={screen.session} newBest={screen.newBest} onAgain={() => play(screen.session.mode)} onHome={() => setScreen({ kind: 'home' })} />)
  }
  return wrap(
    'home',
    <Home
      data={data}
      settings={settings}
      onSettings={setSettings}
      onPlay={play}
      onLearn={() => setScreen({ kind: 'learn' })}
      onStats={() => setScreen({ kind: 'stats' })}
      challenge={challenge}
      onChallenge={playChallenge}
      onInstall={installEvt ? () => installEvt.prompt().then(() => setInstallEvt(null)) : undefined}
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
