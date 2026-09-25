import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type Lang = 'nl' | 'en'

const nl = {
  title: 'The Dutch Highway Guesser',
  tagline: 'Hoe goed ken jij de Nederlandse snelwegen?',
  loading: 'Kaart laden...',
  loadError: 'De kaart kon niet geladen worden.',
  play: 'Spelen',
  best: 'Beste',
  noBest: 'Nog geen score',
  settings: 'Instellingen',
  roads: 'Wegen',
  tier_A: 'Alleen A-wegen',
  tier_AN: 'A-wegen + rijks-N-wegen',
  tier_ALL: 'Alles, ook provinciale N-wegen',
  tier_A_short: 'A-wegen',
  tier_AN_short: 'A + N',
  tier_ALL_short: 'Alles',
  timer: 'Timer',
  timerOn: 'Aan',
  timerOff: 'Uit',
  daily: 'Dagelijkse uitdaging',
  dailyHint: 'Iedereen krijgt vandaag dezelfde vragen. Deel je score!',
  language: 'Taal',
  mode_drag: 'Sleep de borden',
  mode_drag_desc: 'Sleep elk wegnummer naar de juiste weg op de kaart.',
  mode_find: 'Vind de weg',
  mode_find_desc: 'Je ziet een wegnummer. Tik op de juiste weg.',
  mode_junction: 'Knooppunten',
  mode_junction_desc: 'Je krijgt een knooppuntnaam. Tik waar het ligt. Zoom in voor precisie.',
  mode_quiz: 'Welke weg is dit?',
  mode_quiz_desc: 'Een weg licht op. Kies het juiste bord.',
  question: 'Vraag {n}/{total}',
  score: 'Score',
  time: 'Tijd',
  toGo: '{n} te gaan',
  placed: '{n}/{total} geplaatst',
  findPrompt: 'Tik op de',
  quizPrompt: 'Welke weg licht op?',
  junctionPrompt: 'Waar ligt knooppunt',
  dragPrompt: 'Sleep de borden naar de juiste weg',
  dragHelp: 'Zoom in met twee vingers of het scrollwiel. Sleep een bord omhoog uit de lade.',
  hint: 'Hint',
  hintCost: '-30 punten',
  hintText: 'Wegen: {roads}',
  correct: 'Goed!',
  wrong: 'Mis!',
  thatWas: 'Dat was de {ref}',
  itIs: 'Het is de {ref}',
  timeUp: 'Tijd om!',
  noRoad: 'Daar ligt geen weg. Zoom in en probeer opnieuw.',
  distanceOff: '{km} km ernaast',
  spotOn: 'Precies goed!',
  close: 'Bijna!',
  giveUp: 'Geef op',
  next: 'Volgende',
  done: 'Klaar',
  quit: 'Stoppen',
  cancel: 'Annuleren',
  quitConfirm: 'Spel stoppen? Je score gaat verloren.',
  results: 'Resultaat',
  accuracy: 'Goed',
  newBest: 'Nieuw record!',
  share: 'Delen',
  copied: 'Gekopieerd naar klembord!',
  again: 'Nog een keer',
  home: 'Menu',
  rank_4: 'Snelwegkoning',
  rank_3: 'Wegenwachter',
  rank_2: 'Zondagsrijder',
  rank_1: 'Verdwaald',
  attribution: 'Kaartdata (c) OpenStreetMap-bijdragers',
  points: 'punten',
  km: 'km',
  reveal: 'Toon antwoorden',
  zoomTip: 'Tip: zoom ver in, elke kilometer telt.',
} as const

export type Key = keyof typeof nl

const en: Record<Key, string> = {
  title: 'The Dutch Highway Guesser',
  tagline: 'How well do you know the Dutch highways?',
  loading: 'Loading map...',
  loadError: 'The map could not be loaded.',
  play: 'Play',
  best: 'Best',
  noBest: 'No score yet',
  settings: 'Settings',
  roads: 'Roads',
  tier_A: 'A-roads only',
  tier_AN: 'A-roads + national N-roads',
  tier_ALL: 'Everything, incl. provincial N-roads',
  tier_A_short: 'A-roads',
  tier_AN_short: 'A + N',
  tier_ALL_short: 'All',
  timer: 'Timer',
  timerOn: 'On',
  timerOff: 'Off',
  daily: 'Daily challenge',
  dailyHint: 'Everyone gets the same questions today. Share your score!',
  language: 'Language',
  mode_drag: 'Drag the signs',
  mode_drag_desc: 'Drag each road number onto the right road on the map.',
  mode_find: 'Find the road',
  mode_find_desc: 'You get a road number. Tap the right road.',
  mode_junction: 'Interchanges',
  mode_junction_desc: 'You get an interchange name. Tap where it is. Zoom in for precision.',
  mode_quiz: 'Which road is this?',
  mode_quiz_desc: 'A road lights up. Pick the right sign.',
  question: 'Question {n}/{total}',
  score: 'Score',
  time: 'Time',
  toGo: '{n} to go',
  placed: '{n}/{total} placed',
  findPrompt: 'Tap the',
  quizPrompt: 'Which road is highlighted?',
  junctionPrompt: 'Where is interchange',
  dragPrompt: 'Drag the signs onto the right road',
  dragHelp: 'Pinch or scroll to zoom. Drag a sign upwards out of the drawer.',
  hint: 'Hint',
  hintCost: '-30 points',
  hintText: 'Roads: {roads}',
  correct: 'Correct!',
  wrong: 'Wrong!',
  thatWas: 'That was the {ref}',
  itIs: "It's the {ref}",
  timeUp: "Time's up!",
  noRoad: 'No road there. Zoom in and try again.',
  distanceOff: '{km} km off',
  spotOn: 'Spot on!',
  close: 'Close!',
  giveUp: 'Give up',
  next: 'Next',
  done: 'Done',
  quit: 'Quit',
  cancel: 'Cancel',
  quitConfirm: 'Quit the game? Your score will be lost.',
  results: 'Results',
  accuracy: 'Correct',
  newBest: 'New best!',
  share: 'Share',
  copied: 'Copied to clipboard!',
  again: 'Play again',
  home: 'Menu',
  rank_4: 'Highway royalty',
  rank_3: 'Road ranger',
  rank_2: 'Sunday driver',
  rank_1: 'Lost',
  attribution: 'Map data (c) OpenStreetMap contributors',
  points: 'points',
  km: 'km',
  reveal: 'Show answers',
  zoomTip: 'Tip: zoom in far, every kilometre counts.',
}

const STRINGS: Record<Lang, Record<Key, string>> = { nl, en }

export type Vars = Record<string, string | number>

export function translate(lang: Lang, key: Key, vars?: Vars): string {
  let s: string = STRINGS[lang][key]
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
  return s
}

interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: Key, vars?: Vars) => string
}

const Ctx = createContext<LangCtx>({ lang: 'nl', setLang: () => {}, t: (k, v) => translate('nl', k, v) })

const LANG_KEY = 'tdhg:lang'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'nl' || saved === 'en') return saved
  } catch {
    /* ignore */
  }
  return navigator.language.toLowerCase().startsWith('nl') ? 'nl' : 'en'
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(LANG_KEY, l)
    } catch {
      /* ignore */
    }
  }, [])
  const value = useMemo<LangCtx>(() => ({ lang, setLang, t: (k, v) => translate(lang, k, v) }), [lang, setLang])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLang() {
  return useContext(Ctx)
}
