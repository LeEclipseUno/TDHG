import { useMemo, useState } from 'react'
import type { GameData } from '../data'
import { formatDate, formatNumber, useLang } from '../i18n'
import { clearHistory, loadHistory, loadLabelStats } from '../game/history'
import { formatTime, MODES, POST_STYLES, SHIELD_STYLES, type PostStyle, type Settings, type ShieldStyle } from '../game/session'
import { BackBar, Board, BottomHome, Matrix, Seg } from './widgets'
import { Shield } from './Shield'
import { IconLock, IconMenu, IconPencil, PlusMark, SeasonIcon, PictStats, PictDrag, PictFind, PictJunction, PictQuiz, PictRoute, PictPost } from './icons'
import MapView, { type Highlight } from '../map/MapView'
import { BADGES, computeBadges, loadBadges, type BadgeId } from '../game/achievements'
import { Backdrop } from './Backdrop'
import { deleteAccount, exportAccount, getNickname, ONLINE, setNickname, validNickname, type Account } from '../game/backend'
import { pushSoon } from '../game/sync'
import { disableReminder, enableReminder, getReminder, pushSupported, setReminderTime } from '../game/push'
import { plusUntil } from '../game/premium'
import { initials, isIosSafari, isStandalone } from './Home'
import { InitialsShield } from './icons'

export function Stats({ data, account, plus, settings, onSettings, onSignOut, onPlus, onDeleted, onNotice, onHome }: { data: GameData; account: Account; plus: boolean; settings: Settings; onSettings: (s: Settings) => void; onSignOut: () => void; onPlus: () => void; onDeleted: () => void; onNotice: (m: string) => void; onHome: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  // Display name on the boards: the nickname, or the Google name until one is set.
  const [nick, setNick] = useState(getNickname())
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const startEdit = () => {
    setDraft(nick || account.name || '')
    setEditing(true)
  }
  const saveNick = () => {
    const v = draft.trim().replace(/\s+/g, ' ')
    if (v && !validNickname(v)) return onNotice(t('nickInvalid'))
    setNickname(v)
    setNick(v)
    setEditing(false)
    if (account.signedIn) pushSoon()
  }
  // Daily reminder (web push).
  const [reminder, setReminder] = useState(getReminder)
  const [reminderNote, setReminderNote] = useState('')
  const applyReminder = async (on: boolean, hour: number, minute: number) => {
    setReminderNote('')
    setReminderTime(hour, minute)
    // The chosen time shows at once; only the on switch waits for the server.
    setReminder((r) => ({ ...r, hour, minute }))
    if (!on) {
      await disableReminder()
      setReminder({ on: false, hour, minute })
      return
    }
    const fail = await enableReminder(hour, minute, lang)
    if (!fail) setReminder({ on: true, hour, minute })
    else if (fail === 'permission') setReminderNote(isIosSafari && !isStandalone ? t('reminderInstall') : t('reminderDenied'))
    else {
      setReminder((r) => ({ ...r, on: false }))
      setReminderNote(t('reminderFail', { code: fail }))
    }
  }
  const reminderTime = `${String(reminder.hour).padStart(2, '0')}:${String(reminder.minute).padStart(2, '0')}`
  const doExport = async () => {
    setBusy(true)
    const remote = await exportAccount()
    setBusy(false)
    if (!remote.ok) return onNotice(t('exportFail', { code: remote.code }))
    const local: Record<string, string> = {}
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('tdhg:')) local[k] = localStorage.getItem(k) ?? ''
    } catch {
      /* ignore */
    }
    const name = `wegenkenner-${new Date().toISOString().slice(0, 10)}.json`
    const text = JSON.stringify({ ...remote.data, this_device: local }, null, 2)
    // Installed on a phone, the share sheet is the reliable way to save a file; otherwise a plain download.
    try {
      const file = new File([text], name, { type: 'application/json' })
      if (isStandalone && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name })
        return
      }
    } catch {
      /* fall through to the download */
    }
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 10000)
    onNotice(t('exportDone'))
  }
  const doDelete = async () => {
    setBusy(true)
    const ok = await deleteAccount()
    setBusy(false)
    setConfirmDelete(false)
    if (ok) onDeleted()
    else onNotice(t('signInError'))
  }
  const { t, lang } = useLang()
  const untilMs = plusUntil(account)
  const until = untilMs ? formatDate(untilMs, lang, 'long') : ''
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
  const hardestAll = entries.filter((e) => e.n >= 2).sort((a, b) => a.ratio - b.ratio || b.n - a.n).slice(0, 10)
  const hardest = plus ? hardestAll : hardestAll.slice(0, 2)
  const strongest = entries.filter((e) => e.n >= 2 && e.ratio >= 0.75).sort((a, b) => b.ratio - a.ratio || b.n - a.n).slice(0, 10)
  const recent = hist.slice(-3).reverse()
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
  const provAll = Object.entries(provAcc).map(([c, v]) => ({ c, n: v.r + v.w, ratio: v.r / (v.r + v.w) })).filter((p) => p.n >= 3).sort((a, b) => b.ratio - a.ratio)
  const provList = plus ? provAll : provAll.slice(0, 2)
  const fastest = MODES.map((m) => {
    const clean = hist.filter((g) => g.mode === m && g.total > 0 && g.good / g.total >= 0.8 && g.ms > 0)
    return { mode: m, ms: clean.reduce((a, g) => Math.min(a, g.ms), Infinity) }
  }).filter((f) => Number.isFinite(f.ms))

  return (
    <div className="results">
      <Backdrop data={data} />
      <div className="results-inner">
        <BackBar label={t('home')} onBack={onHome} />
        {ONLINE && account.signedIn && (
          <Board className="results-board profile-board">
            <div className="board-title">{t('stats')}</div>
            <div className="profile-body">
              {account.avatar ? <img className={'avatar-img profile-avatar' + (plus ? ' avatar-plus' : '')} src={account.avatar} alt="" referrerPolicy="no-referrer" /> : plus ? <span className="avatar-img profile-avatar avatar-shield avatar-plus"><InitialsShield text={initials({ name: nick || account.name, email: account.email })} size={52} style={settings.shieldStyle} /></span> : <span className="avatar-img avatar-fallback profile-avatar">{initials({ name: nick || account.name, email: account.email }).slice(0, 1)}</span>}
              <div className="profile-text">
                {editing ? (
                  <form
                    className="profile-edit"
                    onSubmit={(e) => {
                      e.preventDefault()
                      saveNick()
                    }}
                  >
                    <input autoFocus value={draft} maxLength={16} placeholder={t('nickPlaceholder')} onChange={(e) => setDraft(e.target.value)} onBlur={saveNick} aria-label={t('nickname')} />
                    <button type="submit" className="btn btn-small">
                      {t('save')}
                    </button>
                  </form>
                ) : (
                  <button type="button" className="profile-name-btn" onClick={startEdit} title={t('editName')}>
                    <span className="profile-name">{nick || account.name || account.email?.split('@')[0]}</span>
                    <IconPencil className="profile-pencil" />
                  </button>
                )}
                <span className="profile-email">{account.email}</span>
              </div>
              <button type="button" className="btn btn-small btn-ghost" onClick={onSignOut}>
                {t('signOut')}
              </button>
            </div>
            {plus ? (
              <div className="profile-plus-band">
                <PlusMark />
                <span>
                  <strong>{t('plus')}</strong> {t('plusActive', { date: until })}
                </span>
              </div>
            ) : (
              <button type="button" className="profile-plus-band profile-plus-off" onClick={onPlus}>
                <PlusMark />
                <span>
                  <strong>{t('plus')}</strong> {t('plusPitch')}
                </span>
              </button>
            )}
            <div className="profile-tools">
              <button type="button" className="link-btn" onClick={doExport} disabled={busy}>
                {t('exportData')}
              </button>
              <button type="button" className="link-btn link-danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
                {t('deleteAccount')}
              </button>
            </div>
          </Board>
        )}
        {confirmDelete && (
          <div className="modal-backdrop" onClick={() => setConfirmDelete(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <p>{t('deleteConfirm')}</p>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                  {t('cancel')}
                </button>
                <button type="button" className="btn btn-danger" onClick={doDelete} disabled={busy}>
                  {t('deleteAccount')}
                </button>
              </div>
            </div>
          </div>
        )}
        <Board tone="dark" className="settings-board">
          <div className="board-title">{t('settings')}</div>
          <div className="setting">
            <span className="setting-label">
              {t('postStyle')} <span className="locked-tag">{t('plusTag')}</span>
            </span>
            <Seg<PostStyle> wide label={t('postStyle')} value={plus ? settings.postStyle : 'green'} onChange={(postStyle) => (plus ? onSettings({ ...settings, postStyle }) : onPlus())} options={POST_STYLES.map((v) => ({ v, label: t(`post_${v}`), locked: !plus && v !== 'green' }))} />
          </div>
          <div className="setting">
            <span className="setting-label">
              {t('shieldStyle')} <span className="locked-tag">{t('plusTag')}</span>
            </span>
            <Seg<ShieldStyle> wide label={t('shieldStyle')} value={plus ? settings.shieldStyle : 'A'} onChange={(shieldStyle) => (plus ? onSettings({ ...settings, shieldStyle }) : onPlus())} options={SHIELD_STYLES.map((v) => ({ v, label: t(`shield_${v}` as 'shield_A'), locked: !plus && v !== 'A' }))} />
          </div>
          <div className="setting">
            <span className="setting-label">{t('colors')}</span>
            <Seg<'normal' | 'cb'> wide label={t('colors')} value={settings.colorblind ? 'cb' : 'normal'} onChange={(v) => onSettings({ ...settings, colorblind: v === 'cb' })} options={[{ v: 'normal', label: t('colors_normal') }, { v: 'cb', label: t('colors_cb') }]} />
            <span className="setting-hint">{t('colorsHint')}</span>
          </div>
          {ONLINE && pushSupported() && (
            <div className="setting">
              <span className="setting-label">{t('reminder')}</span>
              <div className="reminder-row">
                <Seg<string> wide label={t('reminder')} value={reminder.on ? 'on' : 'off'} onChange={(v) => void applyReminder(v === 'on', reminder.hour, reminder.minute)} options={[{ v: 'on', label: t('timerOn') }, { v: 'off', label: t('timerOff') }]} />
                <div className="time-pick" aria-label={reminderTime}>
                  <select className="time-input" aria-label={t('reminderHour')} value={reminder.hour} onChange={(e) => void applyReminder(reminder.on, Number(e.target.value), reminder.minute)}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                  <span className="time-colon">:</span>
                  <select className="time-input" aria-label={t('reminderMinute')} value={reminder.minute - (reminder.minute % 5)} onChange={(e) => void applyReminder(reminder.on, reminder.hour, Number(e.target.value))}>
                    {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                      <option key={m} value={m}>
                        {String(m).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <span className="setting-hint">{reminderNote || t('reminderHint')}</span>
            </div>
          )}
        </Board>
        <Board className="results-board">
          <div className="board-title">{t('badges')}</div>
          {earned.size === 0 && <p className="learn-note badges-empty">{t('badgesEmpty')}</p>}
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
                  <span className="badge-when">{on ? (earnedAt[id] ? formatDate(earnedAt[id], lang) : '') : <IconLock />}</span>
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
        {provList.length > 0 && (
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
              {!plus && provAll.length > 2 && <MoreWithPlus onPlus={onPlus} label={t('morePlus', { n: provAll.length - 2 })} />}
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
              <span className="stat-label">{t('games', { n: games })}</span>
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
                    {m.games} {t('games', { n: m.games }).toLowerCase()}
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
              {!plus && hardestAll.length > 2 && <MoreWithPlus onPlus={onPlus} label={t('morePlus', { n: hardestAll.length - 2 })} />}
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
                    {t(`tier_${g.tier}_short`)} {'·'} {formatDate(g.at, lang)}
                  </small>
                  <span className="results-points">{formatNumber(g.score, lang)}</span>
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
          <BottomHome label={t('home')} onHome={onHome}>
            <IconMenu />
          </BottomHome>
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
          {mark('5/5')}
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
    case 'allN':
      return (
        <>
          <svg width="40" height="40" viewBox="0 0 48 48" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 12c10 2 14 10 22 12s12 8 14 14" />
            <path d="M10 40c4-10 10-14 18-16s10-8 12-16" />
            <path d="M4 26h40" strokeDasharray="4 5" opacity="0.7" />
          </svg>
          <Shield code={id === 'allA' ? 'A' : 'N'} kind={id === 'allA' ? 'A' : 'N'} size="sm" className="badge-shield" />
        </>
      )
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
    case 'season_kingsday':
    case 'season_sinterklaas':
    case 'season_christmas':
    case 'season_carnaval':
      return (
        <span className="badge-season">
          <SeasonIcon season={id.slice(7) as 'kingsday' | 'sinterklaas' | 'christmas' | 'carnaval'} />
        </span>
      )
  }
}

/** Locked tail of a list: the rest opens with Plus. */
function MoreWithPlus({ onPlus, label }: { onPlus: () => void; label: string }) {
  return (
    <li className="stats-more">
      <button type="button" className="stats-more-btn" onClick={onPlus}>
        <IconLock /> {label}
      </button>
    </li>
  )
}
