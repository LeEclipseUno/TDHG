import { useEffect, useState } from 'react'
import type { GameData } from '../data'
import { formatDate, useLang } from '../i18n'
import { BackBar, Board, BottomHome } from './widgets'
import { IconGoogle, IconMenu, IconReplay, PictGroup, PictLearn, PictExit, PictJunction, PictRoute, PictDistance, PictStats, PictFind, PictQuiz } from './icons'
import { Backdrop } from './Backdrop'
import { fetchGiftCode, getReferralCode, getReferralStats, groupBoard, myGroups, ONLINE, redeemGift, type Account } from '../game/backend'
import { allDailyResults, dailyNumber } from '../game/daily'
import { loadLabelStats } from '../game/history'
import { bump } from '../game/funnel'
import { onPaddleEvent, openCheckout, paddleConfigured, paddleGiftConfigured } from '../game/paddle'
import { checkoutUrl, GIFT_CHECKOUT, hasPlus, pendingReferral, PLUS_PRICE, plusDaysLeft, plusUntil, referralLink, RENEW_CODE, renewUrl, SHOP } from '../game/premium'
import { IconShare } from './icons'

export interface PlusProps {
  data: GameData
  account: Account
  onSignIn: () => void
  onRefresh: () => Promise<void>
  onNotice: (m: string) => void
  onHome: () => void
}

/** The Plus pass: what it opens, and the way to get it. */
export function Plus({ data, account, onSignIn, onRefresh, onNotice, onHome }: PlusProps) {
  const { t, lang } = useLang()
  const [busy, setBusy] = useState(false)
  const [refCode, setRefCode] = useState<string | null>(null)
  const [refBusy, setRefBusy] = useState(false)
  const [refStats, setRefStats] = useState<{ uses: number; saved: number } | null>(null)
  const [giftKey, setGiftKey] = useState('')
  const [giftBusy, setGiftBusy] = useState(false)
  const [giftCode, setGiftCode] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const paddle = SHOP === 'paddle' && paddleConfigured
  // Paddle overlay: when a checkout completes, wait for the webhook, then refresh the pass or fetch the gift code.
  useEffect(() => {
    if (!paddle) return
    return onPaddleEvent((e) => {
      // Until Paddle has approved the account, or when a price is wrong, the overlay fails to open.
      if (e.name === 'checkout.error') onNotice(t('plusSoon'))
      if (e.name !== 'checkout.completed') return
      const txn = e.data?.transaction_id ?? ''
      const kind = e.data?.custom_data?.kind ?? 'plus'
      setPaying(true)
      void (async () => {
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 2000))
          if (kind === 'gift') {
            const code = txn ? await fetchGiftCode(txn) : null
            if (code) {
              setGiftCode(code)
              setPaying(false)
              onNotice(t('giftReady'))
              return
            }
          } else {
            await onRefresh()
            if (hasPlus(account)) break
          }
        }
        setPaying(false)
        if (kind !== 'gift') onNotice(t('paidCheck'))
      })()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paddle])
  // For you: what Plus would open for this player right now.
  const today = dailyNumber()
  const played = Object.keys(allDailyResults()).filter((k) => Number(k) < today).length
  const missed = Math.max(0, today - 1 - played)
  const weakest = Object.entries(loadLabelStats())
    .map(([label, s]) => ({ label, n: s.r + s.w, ratio: s.r / Math.max(1, s.r + s.w) }))
    .filter((e) => e.n >= 2 && e.ratio < 0.75 && data.byRef.has(e.label))
    .sort((a, b) => a.ratio - b.ratio || b.n - a.n)
    .slice(0, 3)
    .map((e) => e.label)
  const [mates, setMates] = useState<{ plus: number; all: number } | null>(null)
  useEffect(() => {
    if (!ONLINE || !account.signedIn || hasPlus(account)) return
    let alive = true
    void (async () => {
      const groups = await myGroups()
      if (!groups[0]) return
      const rows = (await groupBoard(groups[0].code, today)).filter((r) => !r.is_me)
      if (alive && rows.length) setMates({ plus: rows.filter((r) => r.plus).length, all: rows.length })
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.signedIn])
  // "Inloggen en Plus nemen": back from Google, the checkout opens by itself.
  useEffect(() => {
    if (!paddle || !account.signedIn || hasPlus(account)) return
    let wanted = false
    try {
      wanted = !!localStorage.getItem('tdhg:v1:buyAfterLogin')
      localStorage.removeItem('tdhg:v1:buyAfterLogin')
    } catch {
      /* ignore */
    }
    if (wanted) void buy('plus')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paddle, account.signedIn])
  const signInAndBuy = () => {
    try {
      localStorage.setItem('tdhg:v1:buyAfterLogin', '1')
    } catch {
      /* ignore */
    }
    onSignIn()
  }
  const buy = async (kind: 'plus' | 'gift', discount?: string) => {
    bump(kind === 'gift' ? 'gift_open' : 'checkout_open')
    const ok = await openCheckout(kind, { playerId: account.id, email: account.email, discountCode: discount || pendingReferral() || undefined, locale: lang })
    if (!ok) onNotice(t('shopOffline'))
  }
  const shareGift = async () => {
    if (!giftCode) return
    const text = t('giftShare', { code: giftCode })
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        onNotice(t('copied'))
      }
    } catch {
      /* cancelled */
    }
  }
  const friend = pendingReferral()
  const daysLeft = plusDaysLeft(account)
  const fetchCode = async () => {
    setRefBusy(true)
    const r = await getReferralCode()
    setRefBusy(false)
    if (r.code) {
      setRefCode(r.code)
      void getReferralStats().then(setRefStats)
    } else onNotice(r.error === 'not configured' ? t('plusSoon') : t('signInError'))
  }
  const shareCode = async () => {
    if (!refCode) return
    const text = `${t('referralShare')} ${referralLink(refCode)}`
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        onNotice(t('copied'))
      }
    } catch {
      /* cancelled */
    }
  }
  const redeem = async () => {
    const key = giftKey.trim()
    if (!key) return
    setGiftBusy(true)
    const r = await redeemGift(key)
    setGiftBusy(false)
    if (r.until) {
      setGiftKey('')
      onNotice(t('giftRedeemed'))
      await onRefresh()
    } else onNotice(t('giftInvalid'))
  }
  const active = hasPlus(account)
  const shop = account.id ? checkoutUrl(account.id, account.email) : ''
  const untilMs = plusUntil(account)
  const until = untilMs ? formatDate(untilMs, lang, 'long') : ''
  const refresh = async () => {
    setBusy(true)
    await onRefresh()
    setBusy(false)
  }
  return (
    <div className="results">
      <Backdrop data={data} />
      <div className="results-inner">
        <BackBar label={t('home')} onBack={onHome} />
        <Board className="results-board plus-board">
          <div className="board-title">{t('plus')}</div>
          <div className="plus-body">
            <p className="plus-pitch">{t('plusPitch')}</p>
            {!active && <p className="plus-permonth">{t('plusPerMonth')}</p>}
            {!active && (missed > 0 || weakest.length > 0 || (mates && mates.plus > 0)) && (
              <ul className="plus-you">
                {missed > 0 && <li>{t('youMissed', { n: missed })}</li>}
                {weakest.length > 0 && <li>{t('youWeakest', { roads: weakest.join(', ') })}</li>}
                {mates && mates.plus > 0 && <li>{t('youMates', { n: mates.plus, total: mates.all })}</li>}
              </ul>
            )}
            <ul className="plus-list">
              <li>
                <span className="plus-pict">
                  <PictJunction />
                </span>
                {t('plusFeat2')}
              </li>
              <li>
                <span className="plus-pict">
                  <PictExit />
                </span>
                {t('plusFeat1')}
              </li>
              <li>
                <span className="plus-pict">
                  <PictLearn />
                </span>
                {t('plusFeat3')}
              </li>
              <li>
                <span className="plus-pict">
                  <PictDistance />
                </span>
                {t('plusFeat5')}
              </li>
              <li>
                <span className="plus-pict">
                  <PictStats />
                </span>
                {t('plusFeat6')}
              </li>
              <li>
                <span className="plus-pict">
                  <PictFind />
                </span>
                {t('plusFeat7')}
              </li>
              <li>
                <span className="plus-pict">
                  <PictQuiz />
                </span>
                {t('plusFeat8')}
              </li>
              <li>
                <span className="plus-pict">
                  <PictGroup />
                </span>
                {t('plusFeat9')}
              </li>
              <li>
                <span className="plus-pict">
                  <PictRoute />
                </span>
                {t('plusFeat4')}
              </li>
            </ul>
            {!active && friend && <p className="plus-friend">{t('friendDiscount', { code: friend })}</p>}
            {active && daysLeft !== null && daysLeft <= 14 && account.id ? (
              <>
                <p className="plus-active">{t('plusEnding', { n: daysLeft })}</p>
                {paddle ? (
                  <button type="button" className="btn btn-wide plus-buy" onClick={() => void buy('plus', RENEW_CODE)} disabled={paying}>
                    {paying ? t('paying') : t('renewYear')}
                    {PLUS_PRICE && !paying && <span className="plus-price">{PLUS_PRICE}</span>}
                  </button>
                ) : (
                  <a className="btn btn-wide plus-buy" href={renewUrl(account.id, account.email)}>
                    {t('renewYear')}
                    {PLUS_PRICE && <span className="plus-price">{PLUS_PRICE}</span>}
                  </a>
                )}
              </>
            ) : active ? (
              <p className="plus-active">{t('plusActive', { date: until })}</p>
            ) : !ONLINE || !account.signedIn ? (
              <>
                <p className="plus-note">{t('plusSignIn')}</p>
                {ONLINE && (
                  <button type="button" className="btn btn-primary btn-wide plus-buy" onClick={paddle ? signInAndBuy : onSignIn}>
                    <IconGoogle /> {paddle ? t('signInAndBuy') : t('signInGoogle')}
                    {paddle && PLUS_PRICE && <span className="plus-price">{PLUS_PRICE}</span>}
                  </button>
                )}
                {paddle && <p className="plus-note plus-pay">{t('plusPayWith')}</p>}
              </>
            ) : paddle ? (
              <>
                <button type="button" className="btn btn-primary btn-wide plus-buy" onClick={() => void buy('plus')} disabled={paying}>
                  {paying ? t('paying') : t('plusBuy')}
                  {PLUS_PRICE && !paying && <span className="plus-price">{PLUS_PRICE}</span>}
                </button>
                <p className="plus-note plus-pay">{t('plusPayWith')}</p>
              </>
            ) : shop ? (
              <a className="btn btn-primary btn-wide plus-buy" href={shop}>
                {t('plusBuy')}
                {PLUS_PRICE && <span className="plus-price">{PLUS_PRICE}</span>}
              </a>
            ) : (
              <p className="plus-note">{t('plusSoon')}</p>
            )}
          </div>
        </Board>
        {ONLINE && account.signedIn && active && (
          <Board className="results-board">
            <div className="board-title">{t('referralTitle')}</div>
            <div className="plus-body">
              <p className="plus-note">{t('referralPitch')}</p>
              {refCode ? (
                <>
                  <div className="ref-code">{refCode}</div>
                  {refStats && (
                    <p className="plus-note ref-stats">
                      {refStats.uses === 0 ? t('referralNone') : t('referralStats', { n: refStats.uses, amount: (lang === 'nl' ? '€ ' : '€') + (refStats.saved / 100).toFixed(2).replace('.', lang === 'nl' ? ',' : '.') })}
                    </p>
                  )}
                  <button type="button" className="btn btn-primary btn-wide" onClick={shareCode}>
                    <IconShare /> {t('referralSend')}
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-primary btn-wide" onClick={fetchCode} disabled={refBusy}>
                  {t('referralGet')}
                </button>
              )}
            </div>
          </Board>
        )}
        {ONLINE && (GIFT_CHECKOUT || (paddle && paddleGiftConfigured) || account.signedIn) && (
          <Board className="results-board">
            <div className="board-title">{t('giftTitle')}</div>
            <div className="plus-body">
              {paddle && paddleGiftConfigured ? (
                <>
                  <p className="plus-note">{t('giftPitchPaddle')}</p>
                  {giftCode ? (
                    <>
                      <p className="plus-note">{t('giftReadyPitch')}</p>
                      <div className="ref-code">{giftCode}</div>
                      <button type="button" className="btn btn-primary btn-wide" onClick={shareGift}>
                        <IconShare /> {t('giftSend')}
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn btn-wide plus-buy" onClick={() => void buy('gift')} disabled={paying}>
                      {paying ? t('paying') : t('giftBuy')}
                    </button>
                  )}
                </>
              ) : GIFT_CHECKOUT ? (
                <>
                  <p className="plus-note">{t('giftPitch')}</p>
                  <a className="btn btn-wide plus-buy" href={GIFT_CHECKOUT}>
                    {t('giftBuy')}
                  </a>
                </>
              ) : null}
              {account.signedIn && (
                <>
                  <p className="plus-note">{t('giftRedeemPitch')}</p>
                  <div className="gift-row">
                    <input className="gift-input" value={giftKey} placeholder={paddle ? 'WKG-XXXX-XXXX' : 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'} onChange={(e) => setGiftKey(e.target.value.toUpperCase())} aria-label={t('giftRedeem')} />
                    <button type="button" className="btn btn-small" onClick={redeem} disabled={giftBusy || !giftKey.trim()}>
                      {t('giftRedeem')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </Board>
        )}
        <div className="results-actions">
          {ONLINE && account.signedIn && !active && (
            <button type="button" className="btn btn-ghost" onClick={refresh} disabled={busy}>
              <IconReplay /> {t('plusRestore')}
            </button>
          )}
          <BottomHome label={t('home')} onHome={onHome}>
            <IconMenu />
          </BottomHome>
        </div>
      </div>
    </div>
  )
}
