import { useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../i18n'
import { dateKey, formatTime, rankKey, shareText, summarize, type Session } from '../game/session'
import type { GameData } from '../data'
import MapView, { type Highlight, type Marker } from '../map/MapView'
import { Shield } from './Shield'
import { Board, Matrix, RouteStrip } from './widgets'
import { IconChat, IconCheck, IconClock, IconCross, IconMenu, IconReplay, IconShare, IconTilde } from './icons'
import { Backdrop } from './Backdrop'
import { haptic, sfx } from '../game/sound'
import { useNow } from '../game/hooks'
import { renderCard } from '../game/card'
import { StreakPosts } from './Home'
import { createShare, ONLINE, submitDaily, type Percentile } from '../game/backend'
import { challengeParam } from '../game/session'
import { dailyNumber } from '../game/daily'
import { AdSlot } from './AdSlot'
import type { BadgeId } from '../game/achievements'

export interface ResultsProps {
  data: GameData
  session: Session
  newBest: boolean
  streak: number
  plus: boolean
  badges: BadgeId[]
  onAgain: () => void
  onHome: () => void
}

const MARK = { good: IconCheck, partial: IconTilde, bad: IconCross }
const STEP_MS = 160
const COUNT_MS = 1100
const RANK_HAPTIC: Record<string, number[]> = { rank_4: [30, 60, 30, 60, 90], rank_3: [30, 60, 30], rank_2: [40], rank_1: [90] }

export function Results({ data, session, newBest, streak, plus, badges, onAgain, onHome }: ResultsProps) {
  const { t, lang } = useLang()
  const sum = summarize(session)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const url = `${location.origin}${import.meta.env.BASE_URL}`
  const t0 = useMemo(() => Date.now(), [])
  const total = session.results.length
  const revealMs = total * STEP_MS
  const now = useNow(true, 40)
  const elapsed = now - t0
  const finished = elapsed > revealMs + COUNT_MS + 200
  const shownCount = Math.min(total, Math.floor(elapsed / STEP_MS) + 1)
  const countP = Math.max(0, Math.min(1, (elapsed - revealMs) / COUNT_MS))
  const shownScore = Math.round(sum.score * (1 - Math.pow(1 - countP, 3)))
  const lastTick = useRef(0)
  const rank = rankKey(sum.accuracy)
  const [pct, setPct] = useState<Percentile | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  // Daily scores go to the board, and come back as a percentile.
  useEffect(() => {
    if (!ONLINE || !session.dailyNumber || session.practice || session.dailyNumber !== dailyNumber()) return
    let alive = true
    submitDaily(session.dailyNumber, sum.score, sum.good, sum.total, sum.ms).then((p) => alive && setPct(p))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const step = countP < 1 ? Math.floor(elapsed / 70) : -1
    if (elapsed < revealMs + COUNT_MS && step !== lastTick.current) {
      lastTick.current = step
      if (elapsed >= revealMs || elapsed % STEP_MS < 70) sfx.count()
    }
    if (countP >= 1 && lastTick.current !== -1) {
      lastTick.current = -1
      sfx.done()
      haptic(RANK_HAPTIC[rank])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed])

  const grades = session.results.slice(0, shownCount).map((r) => r.grade)
  const highlights: Record<string, Highlight> = {}
  const markers: Marker[] = []
  session.results.slice(0, shownCount).forEach((r) => {
    if (data.byRef.has(r.label)) highlights[r.label] = r.grade === 'bad' ? 'wrong' : 'correct'
    else {
      const j = data.junctions.find((jj) => jj.name === r.label)
      if (j) markers.push({ x: j.x, y: j.y, kind: r.grade === 'bad' ? 'guess' : 'answer' })
    }
  })

  const text = shareText(session, lang, preview ?? url)

  const canShareFiles = typeof navigator.share === 'function' && typeof navigator.canShare === 'function'

  /** Phones: the card image plus the text through the share sheet. Elsewhere: text to the clipboard. */
  const share = async () => {
    if (busy) return
    setBusy(true)
    try {
      let link = preview
      let file: File | null = null
      if (canShareFiles) {
        const blob = await renderCard(data, session, lang, 'square', streak)
        if (blob) {
          file = new File([blob], session.dailyNumber ? `wegenkenner-${session.dailyNumber}.png` : 'wegenkenner.png', { type: 'image/png' })
          if (ONLINE && !link) {
            link = await createShare(blob, session.dailyNumber ? `Wegenkenner #${session.dailyNumber}` : 'Wegenkenner', `${sum.score} ${t('points')} \u00b7 ${sum.good}/${sum.total}`, session.dailyNumber ? null : challengeParam(session))
            if (link) setPreview(link)
          }
        }
      }
      const finalText = shareText(session, lang, link ?? url)
      if (navigator.share) {
        try {
          if (file && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text: finalText })
          else await navigator.share({ text: finalText })
          return
        } catch {
          /* cancelled, fall back to the clipboard */
        }
      }
      try {
        await navigator.clipboard.writeText(finalText)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        window.prompt('Copy:', finalText)
      }
    } finally {
      setBusy(false)
    }
  }

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(text)}`

  return (
    <div className="results">
      <Backdrop data={data} />
      <div className="results-inner">
        <Board className="results-board">
          <div className="board-title">{session.dailyNumber ? `Wegenkenner #${session.dailyNumber}` : t('results')}</div>
          <div className="results-mode">
            {t(`mode_${session.mode}`)} <span className="sep" /> {t(`tier_${session.tier}_short`)}
            {session.variant !== 'normal' && (
              <>
                <span className="sep" /> {t(`variant_${session.variant}`)}
              </>
            )}
            {session.daily && !session.dailyNumber && (
              <>
                <span className="sep" /> {dateKey()}
              </>
            )}
            {session.practice && (
              <>
                <span className="sep" /> {t('practiceNote')}
              </>
            )}
          </div>
          <div className="results-map">
            <MapView data={data} tier={session.tier} highlights={highlights} markers={markers} interactive={false} />
          </div>
          <RouteStrip grades={grades} total={total} />
          <Matrix big value={shownScore} label={t('points')} />
          <div className={'results-after' + (finished ? ' results-after-in' : '')}>
            <div className="rank-post">
              <span>{t(rank)}</span>
            </div>
            {newBest && <div className="newbest">{t('newBest')}</div>}
            {badges.map((b) => (
              <div key={b} className="newbest newbadge">
                {t('newBadge')}: {t(`badge_${b}`)}
              </div>
            ))}
            {session.challenge !== undefined && (
              <div className="versus">
                <span>
                  {t('challenger')} <strong>{session.challenge}</strong>
                </span>
                <span className="versus-verdict">{sum.score > session.challenge ? t('youWon') : sum.score < session.challenge ? t('youLost') : t('tie')}</span>
                <span>
                  {t('you')} <strong>{sum.score}</strong>
                </span>
              </div>
            )}
            <div className="results-stats">
              <div className="stat">
                <IconCheck />
                <span className="stat-value">
                  {sum.good}
                  {sum.partial > 0 && <small> +{sum.partial}</small>}
                  <span className="stat-of">/{sum.total}</span>
                </span>
              </div>
              <div className="stat">
                <IconClock />
                <span className="stat-value">{formatTime(sum.ms)}</span>
              </div>
            </div>
            {session.dailyNumber && streak > 0 && (
              <div className="results-streak">
                {t('streak')} <StreakPosts count={streak} />
              </div>
            )}
            {pct && (
              <div className="results-pct">
                {pct.betterThan === null ? t('onlyYou') : t('betterThan', { p: pct.betterThan })}
                <small>{t('players', { n: pct.players })}</small>
              </div>
            )}
          </div>
        </Board>

        <AdSlot place="results" plus={plus} />
        <ul className="results-list">
          {session.results.map((r, i) => {
            const road = data.byRef.get(r.label)
            const Mark = MARK[r.grade]
            return (
              <li key={i} className={`grade-${r.grade}` + (i < shownCount ? ' row-in' : ' row-hidden')}>
                <span className={`mark mark-${r.grade}`}>
                  <Mark />
                </span>
                {road ? <Shield code={road.ref} kind={road.kind} size="sm" /> : <span className="results-label">{r.label}</span>}
                <span className="results-detail">{r.detail}</span>
                <span className="results-points">{r.points}</span>
              </li>
            )
          })}
        </ul>

        <div className="results-actions">
          {!session.practice && (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={share}>
              <IconShare /> {copied ? t('copied') : t('share')}
            </button>
          )}
          {!navigator.share && !session.practice && (
            <a className="btn" href={whatsapp} target="_blank" rel="noreferrer">
              <IconChat /> {t('whatsapp')}
            </a>
          )}
          <button type="button" className="btn btn-ghost" onClick={onAgain}>
            <IconReplay /> {t('again')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            <IconMenu /> {t('home')}
          </button>
        </div>
      </div>
    </div>
  )
}
