import { useEffect, useState } from 'react'
import type { GameData } from '../data'
import { adminStats, type AdminStats } from '../game/backend'
import { Backdrop } from './Backdrop'
import { BackBar, Board } from './widgets'

const pct = (a: number, b: number): string => (b > 0 ? `${((a / b) * 100).toFixed(1).replace('.', ',')}%` : '-')

function Meter({ label, value, of, hint }: { label: string; value: number; of: number; hint: string }) {
  const share = of > 0 ? Math.min(1, value / of) : 0
  return (
    <div className="meter">
      <div className="meter-head">
        <span>{label}</span>
        <strong>{pct(value, of)}</strong>
      </div>
      <div className="meter-bar">
        <span style={{ width: `${Math.max(share * 100, value > 0 ? 2 : 0)}%` }} />
      </div>
      <div className="meter-hint">{hint}</div>
    </div>
  )
}

const STEPS: [string, string][] = [
  ['home', 'Beginscherm geopend'],
  ['plus_view', 'Plus-pagina bekeken'],
  ['checkout_open', 'Betaalpagina geopend'],
  ['purchase', 'Plus gekocht'],
]

/** Owner only: how many players there are, how many of them have Plus, and where the others drop off. */
export function Admin({ data, onHome }: { data: GameData; onHome: () => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading')
  useEffect(() => {
    let alive = true
    void adminStats().then((s) => {
      if (!alive) return
      setStats(s)
      setState(s ? 'ok' : 'denied')
    })
    return () => {
      alive = false
    }
  }, [])
  const f = stats?.funnel30 ?? {}
  return (
    <div className="results">
      <Backdrop data={data} />
      <div className="results-inner">
        <BackBar label="Home" onBack={onHome} />
        {state !== 'ok' || !stats ? (
          <Board className="results-board">
            <div className="board-title">Cijfers</div>
            <p className="learn-note">{state === 'loading' ? 'Laden' : 'Alleen voor de beheerder. Log in met het beheerdersaccount.'}</p>
          </Board>
        ) : (
          <>
            <Board className="results-board">
              <div className="board-title">Conversie</div>
              <div className="admin-body">
                <Meter label="Plus per actieve speler, 30 dagen" value={stats.plus} of={stats.active30} hint={`${stats.plus} Plus-leden op ${stats.active30} actieve spelers`} />
                <Meter label="Plus per speler ooit" value={stats.plus} of={stats.players} hint={`${stats.plus} Plus-leden op ${stats.players} spelers in totaal`} />
                <Meter label="Ingelogd met Google, van de actieve spelers" value={stats.signed30} of={stats.active30} hint={`${stats.signed30} van ${stats.active30}`} />
              </div>
            </Board>
            <Board tone="dark">
              <div className="stats-title">Spelers</div>
              <ul className="stats-list admin-list">
                <li>
                  <span>Actief, laatste 7 dagen</span>
                  <span className="results-points">{stats.active7}</span>
                </li>
                <li>
                  <span>Actief, laatste 30 dagen</span>
                  <span className="results-points">{stats.active30}</span>
                </li>
                <li>
                  <span>Spelers in totaal</span>
                  <span className="results-points">{stats.players}</span>
                </li>
                <li>
                  <span>Plus-leden nu</span>
                  <span className="results-points">{stats.plus}</span>
                </li>
                <li>
                  <span>Nieuw of verlengd, 30 dagen</span>
                  <span className="results-points">{stats.plus30}</span>
                </li>
                <li>
                  <span>Vriendengroepen</span>
                  <span className="results-points">{stats.groups}</span>
                </li>
              </ul>
            </Board>
            <Board tone="dark">
              <div className="stats-title">Trechter, laatste 30 dagen</div>
              <div className="admin-body">
                {STEPS.map(([key, label], i) => {
                  const n = f[key] ?? 0
                  const prev = i > 0 ? (f[STEPS[i - 1][0]] ?? 0) : n
                  const top = f[STEPS[0][0]] ?? 0
                  return (
                    <div key={key} className="meter">
                      <div className="meter-head">
                        <span>{label}</span>
                        <strong>{n}</strong>
                      </div>
                      <div className="meter-bar">
                        <span style={{ width: `${top > 0 ? Math.max((n / top) * 100, n > 0 ? 2 : 0) : 0}%` }} />
                      </div>
                      <div className="meter-hint">{i === 0 ? 'Bezoeken, één per browsersessie' : `${pct(n, prev)} van de vorige stap, ${pct(n, top)} van alle bezoeken`}</div>
                    </div>
                  )
                })}
                <div className="meter-hint">
                  Proefritten: {f.trial ?? 0}. Cadeau geopend: {f.gift_open ?? 0}. Cadeau gekocht: {f.purchase_gift ?? 0}.
                </div>
              </div>
            </Board>
          </>
        )}
      </div>
    </div>
  )
}
