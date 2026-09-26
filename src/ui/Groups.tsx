import { useEffect, useState } from 'react'
import { useLang } from '../i18n'
import { Board } from './widgets'
import { IconMenu, IconReplay, IconShare, PictGroup, PlusMark } from './icons'
import { createGroup, getNickname, groupBoard, groupWeek, joinGroup, leaveGroup, myGroups, ONLINE, setNickname, validNickname, type BoardRow, type Group, type WeekRow } from '../game/backend'
import { dailyNumber } from '../game/daily'
import { formatTime } from '../game/session'
import type { GameData } from '../data'
import { Backdrop } from './Backdrop'

export function Groups({ data, onHome, joinCode }: { data: GameData; onHome: () => void; joinCode?: string }) {
  const { t } = useLang()
  const [nick, setNick] = useState(getNickname())
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [board, setBoard] = useState<BoardRow[]>([])
  const [week, setWeek] = useState<WeekRow[]>([])
  const [name, setName] = useState('')
  const [code, setCode] = useState(joinCode ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const n = dailyNumber()
  const nickOk = validNickname(nick)

  const refresh = async (select?: string) => {
    const g = await myGroups()
    setGroups(g)
    setOpen(select ?? open ?? g[0]?.code ?? null)
  }
  useEffect(() => {
    if (ONLINE) void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!open) return
    let alive = true
    Promise.all([groupBoard(open, n), groupWeek(open, n)]).then(([b, w]) => {
      if (!alive) return
      setBoard(b)
      setWeek(w)
    })
    return () => {
      alive = false
    }
  }, [open, n, tick])

  const saveNick = () => {
    if (nickOk) setNickname(nick.trim())
  }
  const doCreate = async () => {
    if (!nickOk || name.trim().length < 2) return
    saveNick()
    setBusy(true)
    const g = await createGroup(name.trim(), nick.trim())
    setBusy(false)
    if (!g) {
      setMsg(t('groupError'))
      return
    }
    setName('')
    setMsg(null)
    await refresh(g.code)
  }
  const doJoin = async () => {
    if (!nickOk || code.trim().length < 4) return
    saveNick()
    setBusy(true)
    const g = await joinGroup(code.trim().toUpperCase(), nick.trim())
    setBusy(false)
    if (!g) {
      setMsg(t('groupUnknown'))
      return
    }
    setCode('')
    setMsg(null)
    await refresh(g.code)
  }
  const invite = async (g: Group) => {
    const text = t('inviteText', { name: g.name, code: g.code }) + '\n' + `${location.origin}${import.meta.env.BASE_URL}#join-${g.code}`
    if (navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch {
        /* fall through */
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      setMsg(t('copied'))
    } catch {
      window.prompt('Copy:', text)
    }
  }
  const doLeave = async (g: Group) => {
    if (!window.confirm(t('leaveConfirm', { name: g.name }))) return
    await leaveGroup(g.code)
    setOpen(null)
    await refresh()
  }

  const current = groups?.find((g) => g.code === open) ?? null

  return (
    <div className="results">
      <Backdrop data={data} />
      <div className="results-inner">
        <Board className="results-board">
          <div className="board-title">{t('groups')}</div>
          {!ONLINE ? (
            <p className="learn-note">{t('offlineFeature')}</p>
          ) : (
            <div className="groups-setup">
              <label className="field">
                <span>{t('nickname')}</span>
                <input value={nick} maxLength={16} placeholder={t('nickPlaceholder')} onChange={(e) => setNick(e.target.value)} onBlur={saveNick} />
              </label>
              {!nickOk && nick.length > 0 && <span className="field-hint">{t('nickInvalid')}</span>}
              <div className="groups-forms">
                <form
                  className="field"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void doCreate()
                  }}
                >
                  <span>{t('newGroup')}</span>
                  <div className="field-row">
                    <input value={name} maxLength={32} placeholder={t('groupName')} onChange={(e) => setName(e.target.value)} />
                    <button type="submit" className="btn btn-small" disabled={busy || !nickOk || name.trim().length < 2}>
                      {t('create')}
                    </button>
                  </div>
                </form>
                <form
                  className="field"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void doJoin()
                  }}
                >
                  <span>{t('joinGroup')}</span>
                  <div className="field-row">
                    <input value={code} maxLength={6} placeholder="ABC123" onChange={(e) => setCode(e.target.value.toUpperCase())} />
                    <button type="submit" className="btn btn-small" disabled={busy || !nickOk || code.trim().length < 4}>
                      {t('join')}
                    </button>
                  </div>
                </form>
              </div>
              {msg && (
                <span role="status" className="field-hint">
                  {msg}
                </span>
              )}
            </div>
          )}
        </Board>

        {groups && groups.length > 0 && (
          <div className="group-tabs">
            {groups.map((g) => (
              <button key={g.code} type="button" className={'chip-tab' + (g.code === open ? ' chip-tab-on' : '')} onClick={() => setOpen(g.code)}>
                {g.name} <small>{g.members}</small>
              </button>
            ))}
          </div>
        )}

        {current && (
          <Board tone="dark">
            <div className="group-head">
              <div className="stats-title">
                {current.name} <span className="group-code">{current.code}</span>
              </div>
              <div className="group-actions">
                <button type="button" className="btn btn-small" onClick={() => invite(current)}>
                  <IconShare /> {t('invite')}
                </button>
                <button type="button" className="btn btn-small btn-ghost" onClick={() => setTick((x) => x + 1)} title={t('refresh')} aria-label={t('refresh')}>
                  <IconReplay />
                </button>
              </div>
            </div>
            <div className="stats-title group-sub">Wegenkenner #{n}</div>
            <ul className="stats-list group-board">
              {board.map((r, i) => (
                <li key={i} className={r.is_me ? 'is-me' : ''}>
                  <span className="group-rank">{r.played ? i + 1 : '-'}</span>
                  <span className="group-nick">
                    {r.nickname}
                    {r.plus && <PlusMark />}
                    {r.is_me && <small> ({t('you').toLowerCase()})</small>}
                  </span>
                  <span className="group-detail">{r.played ? `${r.good}/${r.total} · ${formatTime(r.ms)}` : t('notPlayed')}</span>
                  <span className="results-points">{r.played ? r.score : ''}</span>
                </li>
              ))}
            </ul>
            <div className="stats-title group-sub">{t('thisWeek')}</div>
            <ul className="stats-list group-board">
              {week.map((r, i) => (
                <li key={i} className={r.is_me ? 'is-me' : ''}>
                  <span className="group-rank">{i + 1}</span>
                  <span className="group-nick">
                    {r.nickname}
                    {r.plus && <PlusMark />}
                  </span>
                  <span className="group-detail">
                    {r.days} {t('days')}
                  </span>
                  <span className="results-points">{r.total}</span>
                </li>
              ))}
            </ul>
            <button type="button" className="link-btn group-leave" onClick={() => doLeave(current)}>
              {t('leave')}
            </button>
          </Board>
        )}

        {groups && groups.length === 0 && ONLINE && (
          <div className="empty">
            <PictGroup />
            <p>{t('groupsHint')}</p>
          </div>
        )}

        <div className="results-actions">
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            <IconMenu /> {t('home')}
          </button>
        </div>
      </div>
    </div>
  )
}
