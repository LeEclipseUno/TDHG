import { useState } from 'react'
import type { GameData } from '../data'
import { useLang } from '../i18n'
import { BackBar, Board } from './widgets'
import { IconGoogle, IconMenu, IconReplay, PictGroup, PictLearn, PictExit, PictJunction, PictRoute, PictDistance, PictStats, PictFind, PictQuiz } from './icons'
import { Backdrop } from './Backdrop'
import { getReferralCode, ONLINE, redeemGift, type Account } from '../game/backend'
import { checkoutUrl, GIFT_CHECKOUT, hasPlus, pendingReferral, PLUS_PRICE, plusUntil, referralLink } from '../game/premium'
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
  const [giftKey, setGiftKey] = useState('')
  const [giftBusy, setGiftBusy] = useState(false)
  const friend = pendingReferral()
  const fetchCode = async () => {
    setRefBusy(true)
    const r = await getReferralCode()
    setRefBusy(false)
    if (r.code) setRefCode(r.code)
    else onNotice(r.error === 'not configured' ? t('plusSoon') : t('signInError'))
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
  const until = untilMs ? new Date(untilMs).toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
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
            {active ? (
              <p className="plus-active">{t('plusActive', { date: until })}</p>
            ) : !ONLINE || !account.signedIn ? (
              <>
                <p className="plus-note">{t('plusSignIn')}</p>
                {ONLINE && (
                  <button type="button" className="btn btn-primary btn-wide" onClick={onSignIn}>
                    <IconGoogle /> {t('signInGoogle')}
                  </button>
                )}
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
        {ONLINE && (GIFT_CHECKOUT || account.signedIn) && (
          <Board className="results-board">
            <div className="board-title">{t('giftTitle')}</div>
            <div className="plus-body">
              {GIFT_CHECKOUT && (
                <>
                  <p className="plus-note">{t('giftPitch')}</p>
                  <a className="btn btn-wide plus-buy" href={GIFT_CHECKOUT}>
                    {t('giftBuy')}
                  </a>
                </>
              )}
              {account.signedIn && (
                <>
                  <p className="plus-note">{t('giftRedeemPitch')}</p>
                  <div className="gift-row">
                    <input className="gift-input" value={giftKey} placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" onChange={(e) => setGiftKey(e.target.value)} aria-label={t('giftRedeem')} />
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
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            <IconMenu /> {t('home')}
          </button>
        </div>
      </div>
    </div>
  )
}
