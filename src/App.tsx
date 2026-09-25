import { useEffect, useState } from 'react'
import { loadData, type GameData } from './data'
import { LangProvider, useLang } from './i18n'
import { loadSettings, newSession, saveSettings, submitBest, type ModeId, type Session, type Settings } from './game/session'
import { Home } from './ui/Home'
import { Results } from './ui/Results'
import { DragMode } from './modes/DragMode'
import { FindMode } from './modes/FindMode'
import { JunctionMode } from './modes/JunctionMode'
import { QuizMode } from './modes/QuizMode'

type Screen = { kind: 'home' } | { kind: 'game'; session: Session } | { kind: 'results'; session: Session; newBest: boolean }

const MODE_COMPONENTS = { drag: DragMode, find: FindMode, junction: JunctionMode, quiz: QuizMode } as const

function Shell() {
  const { t } = useLang()
  const [data, setData] = useState<GameData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettingsState] = useState<Settings>(loadSettings)
  const [screen, setScreen] = useState<Screen>({ kind: 'home' })

  useEffect(() => {
    loadData().then(setData).catch((e: unknown) => setError(String(e)))
  }, [])

  const setSettings = (s: Settings) => {
    setSettingsState(s)
    saveSettings(s)
  }

  const play = (mode: ModeId) => setScreen({ kind: 'game', session: newSession(mode, settings) })

  if (error) return <div className="loading">{t('loadError')}</div>
  if (!data)
    return (
      <div className="loading">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="loading-logo" />
        <span>{t('loading')}</span>
      </div>
    )

  if (screen.kind === 'game') {
    const Mode = MODE_COMPONENTS[screen.session.mode]
    return (
      <Mode
        key={screen.session.seed + screen.session.mode}
        data={data}
        session={screen.session}
        onQuit={() => setScreen({ kind: 'home' })}
        onFinish={(session) => setScreen({ kind: 'results', session, newBest: submitBest(session) })}
      />
    )
  }
  if (screen.kind === 'results') {
    return <Results data={data} session={screen.session} newBest={screen.newBest} onAgain={() => play(screen.session.mode)} onHome={() => setScreen({ kind: 'home' })} />
  }
  return <Home settings={settings} onSettings={setSettings} onPlay={play} />
}

export default function App() {
  return (
    <LangProvider>
      <Shell />
    </LangProvider>
  )
}
