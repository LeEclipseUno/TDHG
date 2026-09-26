import { useMemo, useState } from 'react'
import type { GameData } from '../data'
import { useLang } from '../i18n'
import { clearHistory, loadHistory, loadLabelStats } from '../game/history'
import { formatTime, MODES } from '../game/session'
import { Board, Matrix } from './widgets'
import { Shield } from './Shield'
import { IconLock, IconMenu, PictStats, PictDrag, PictFind, PictJunction, PictQuiz, PictRoute, PictPost } from './icons'
import MapView, { type Highlight } from '../map/MapView'
import { BADGES, computeBadges, loadBadges, type BadgeId } from '../game/achievements'
import { Backdrop } from './Backdrop'
import { ONLINE, type Account } from '../game/backend'
import { plusUntil } from '../game/premium'

export function Stats({ data, account, plus, onSignOut, onPlus, onHome }: { data: GameData; account: Account; plus: boolean; onSignOut: () => void; onPlus: () => void; onHome: () => void }) {
  const { t, lang } = useLang()
  const untilMs = plusUntil(account)
  const until = untilMs ? new Date(untilMs).toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const [tick, setTick] = useState(0)
  const hist = useMemo(() => loadHistory(), [tick])
  const labels = useMemo(() => loadLabelStats(), [tick])
  const games = hist.length
  const questions = hist.reduce((a, g) => a + g.total, 0)
  const good = hist.reduce((a, g) => a + g.good, 0)
  const played = hist.reduce((a, g) => a + g.ms, 0)
  const perMode = MODES.map((m) => {
    const gs = hist.filter((g) => g.mode === m)
    return { mode: m, games: gs.length, best: gs.reduce((a, g) => Math.max(a, g.score), 0) }
  }).filter((m) => m.games > 0)
  const entries = Object.entries(labels).map(([label, s]) => ({ label, ...s, n: s.r + s.w, ratio: s.r / (s.r + s.w) }))
  const hardest = entries.filter((e) => e.n >= 2).sort((a, b) => a.ratio - b.ratio || b.n - a.n).slice(0, 10)
  const strongest = entries.filter((e) => e.n >= 2 && e.ratio >= 0.75).sort((a, b) => b.ratio - a.ratio || b.n - a.n).slice(0, 10)
  const recent = hist.slice(-10).reverse()
  const earned = useMemo(() => computeBadges(data), [data, tick])
  const earnedAt = loadBadges()
  // Plus: which roads you know, per province, and your fastest clean run per mode.
  const known: Record<string, Highlight> = {}
  const provAcc: Record<string, { r: number; w: number }> = {}
  for (const e of entries) {
    const road = data.byRef.get(e.label)
    const codes = road?.p ?? data.junctions.find((j) => j.name === e.label)?.p ?? []
    for (const c of codes) {
      const p = (provAcc[c] ??= { r: 0, w: 0 })
      p.r += e.r
      p.w += e.w
    }
    if (road && e.n >= 1) known[road.ref] = e.ratio >= 0.75 ? 'correct' : e.ratio < 0.5 ? 'wrong' : 'active'
  }
  const provList = Object.entries(provAcc).map(([c, v]) => ({ c, n: v.r + v.w, ratio: v.r / (v.r + v.w) })).filter((p) => p.n >= 3).sort((a, b) => b.ratio - a.ratio)
  const fastest = MODES.map((m) => {
    const clean = hist.filter((g) => g.mode === m && g.total > 0 && g.good / g.total >= 0.8 && g.ms > 0)
    return { mode: m, ms: clean.reduce((a, g) => Math.min(a, g.ms), Infinity) }
  }).filter((f) => Number.isFinite(f.ms))

  return (
    <div className="results">
      <Backdrop data={data} />
      <div className="results-inner">
        {ONLINE && account.signedIn && (
          <Board className="results-board profile-board">
            <div className="board-title">{t('stats')}</div>
            <div className="profile-body">
              {account.avatar ? <img className={'avatar-img profile-avatar' + (plus ? ' avatar-plus' : '')} src={account.avatar} alt="" referrerPolicy="no-referrer" /> : <span className={'avatar-img avatar-fallback profile-avatar' + (plus ? ' avatar-plus' : '')}>{(account.name ?? account.email ?? '?').slice(0, 1).toUpperCase()}</span>}
              <div className="profile-text">
                <span className="profile-name">{account.name ?? account.email?.split('@')[0]}</span>
                <span className="profile-email">{account.email}</span>
                {plus ? <span className="profile-plus">{t('plusActive', { date: until })}</span> : <button type="button" className="profile-plus-link" onClick={onPlus}>{t('plus')}</button>}
              </div>
              <button type="button" className="btn btn-small btn-ghost" onClick={onSignOut}>
                {t('signOut')}
              </button>
            </div>
          </Board>
        )}
        <Board className="results-board">
          <div className="board-title">{t('badges')}</div>
          <ul className="badge-list">
            {BADGES.map((id) => {
              const on = earned.has(id)
              return (
                <li key={id} className={'badge-row' + (on ? ' badge-on' : '')}>
                  <span className="badge-sign">
                    <BadgeArt id={id} />
                  </span>
                  <span className="badge-text">
                    <span className="badge-name">{t(`badge_${id}`)}</span>
                    <span className="badge-desc">{t(`badge_${id}_desc`)}</span>
                  </span>
                  <span className="badge-when">{on ? (earnedAt[id] ? new Date(earnedAt[id]).toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-GB', { day: 'numeric', month: 'short' }) : '') : <IconLock />}</span>
                </li>
              )
            })}
          </ul>
        </Board>
        {plus && Object.keys(known).length > 0 && (
          <Board className="results-board">
            <div className="board-title">{t('knownRoads')}</div>
            <div className="results-map profile-map">
              <MapView data={data} tier="AN" highlights={known} interactive={false} labels={false} />
            </div>
            <div className="legend">
              <span className="legend-dot legend-ok" /> {t('legendKnown')} <span className="legend-dot legend-mid" /> {t('legendMixed')} <span className="legend-dot legend-bad" /> {t('legendUnknown')}
            </div>
          </Board>
        )}
        {plus && provList.length > 0 && (
          <Board tone="dark">
            <div className="stats-title">{t('perProvince')}</div>
            <ul className="stats-list">
              {provList.map((p) => (
                <li key={p.c}>
                  <span className="results-label">{t(`prov_${p.c}` as 'prov_UT')}</span>
                  <span className="stats-bar">
                    <span style={{ width: `${Math.round(p.ratio * 100)}%` }} />
                  </span>
                  <span className="stats-ratio">{Math.round(p.ratio * 100)}%</span>
                </li>
              ))}
            </ul>
          </Board>
        )}
        {plus && fastest.length > 0 && (
          <Board tone="dark">
            <div className="stats-title">{t('fastestRuns')}</div>
            <ul className="stats-list stats-recent">
              {fastest.map((f) => (
                <li key={f.mode}>
                  <span>{t(`mode_${f.mode}`)}</span>
                  <span className="stats-ratio">{formatTime(f.ms)}</span>
                </li>
              ))}
            </ul>
          </Board>
        )}
        <Board className="results-board">
          <div className="board-title">{t('statsSection')}</div>
          <div className="learn-stats">
            <div>
              <span className="stat-value">{games}</span>
              <span className="stat-label">{t('games')}</span>
            </div>
            <div>
              <span className="stat-value">{questions ? Math.round((good / questions) * 100) : 0}%</span>
              <span className="stat-label">{t('accuracy')}</span>
            </div>
            <div>
              <span className="stat-value">{formatTime(played)}</span>
              <span className="stat-label">{t('time')}</span>
            </div>
          </div>
          {perMode.length > 0 && (
            <div className="stats-modes">
              {perMode.map((m) => (
                <div key={m.mode} className="stats-mode">
                  <span>{t(`mode_${m.mode}`)}</span>
                  <small>
                    {m.games} {t('games').toLowerCase()}
                  </small>
                  <Matrix value={m.best} label={t('best')} />
                </div>
              ))}
            </div>
          )}
        </Board>

        {hardest.length > 0 && (
          <Board tone="dark">
            <div className="stats-title">{t('hardest')}</div>
            <ul className="stats-list">
              {hardest.map((e) => {
                const road = data.byRef.get(e.label)
                return (
                  <li key={e.label}>
                    {road ? <Shield code={road.ref} kind={road.kind} size="sm" /> : <span className="results-label">{e.label}</span>}
                    <span className="stats-bar">
                      <span style={{ width: `${Math.round(e.ratio * 100)}%` }} />
                    </span>
                    <span className="stats-ratio">
                      {e.r}/{e.n}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Board>
        )}
        {strongest.length > 0 && (
          <Board tone="dark">
            <div className="stats-title">{t('strongest')}</div>
            <ul className="stats-list">
              {strongest.map((e) => {
                const road = data.byRef.get(e.label)
                return (
                  <li key={e.label}>
                    {road ? <Shield code={road.ref} kind={road.kind} size="sm" /> : <span className="results-label">{e.label}</span>}
                    <span className="stats-bar">
                      <span style={{ width: `${Math.round(e.ratio * 100)}%` }} />
                    </span>
                    <span className="stats-ratio">
                      {e.r}/{e.n}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Board>
        )}
        {recent.length > 0 && (
          <Board tone="dark">
            <div className="stats-title">{t('recent')}</div>
            <ul className="stats-list stats-recent">
              {recent.map((g, i) => (
                <li key={i}>
                  <span>{t(`mode_${g.mode}`)}</span>
                  <small>
                    {t(`tier_${g.tier}_short`)} {'·'} {new Date(g.at).toLocaleDateString()}
                  </small>
                  <span className="results-points">{g.score}</span>
                </li>
              ))}
            </ul>
          </Board>
        )}
        {games === 0 && (
          <div className="empty">
            <PictStats />
            <p>{t('statsEmpty')}</p>
          </div>
        )}
        <div className="results-actions">
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            <IconMenu /> {t('home')}
          </button>
          {games > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => {
                if (window.confirm(t('clearConfirm'))) {
                  clearHistory()
                  setTick((x) => x + 1)
                }
              }}
            >
              {t('clearStats')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Signage-style badge art: a pictogram, sometimes with a number plate. */
function BadgeArt({ id }: { id: BadgeId }) {
  const mark = (text: string) => <span className="badge-mark">{text}</span>
  switch (id) {
    case 'firstRide':
      return <PictRoute />
    case 'perfectDaily':
      return (
        <>
          <PictQuiz />
          {mark('10/10')}
        </>
      )
    case 'streak7':
    case 'streak30':
    case 'streak100':
      return (
        <>
          <PictPost width={22} height={34} />
          {mark(id.replace('streak', ''))}
        </>
      )
    case 'dailies10':
    case 'dailies100':
      return (
        <>
          <PictFind />
          {mark(id.replace('dailies', ''))}
        </>
      )
    case 'allA':
      return <Shield code="A" kind="A" size="md" />
    case 'allN':
      return <Shield code="N" kind="N" size="md" />
    case 'junctions50':
      return (
        <>
          <PictJunction />
          {mark('50')}
        </>
      )
    case 'allModes':
      return <PictDrag />
    case 'nightRider':
      return (
        <svg width="40" height="40" viewBox="0 0 48 48" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M30 6a16 16 0 1 0 12 26 13 13 0 0 1-12-26z" fill="#fff" stroke="none" />
          <path d="M6 42h14M9 37h5" />
        </svg>
      )
    case 'thousand':
      return (
        <>
          <PictStats />
          {mark('1000')}
        </>
      )
  }
}
