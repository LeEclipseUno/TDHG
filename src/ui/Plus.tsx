import { useState } from 'react'
import type { GameData } from '../data'
import { useLang } from '../i18n'
import { Board } from './widgets'
import { IconGoogle, IconMenu, IconReplay, PictLearn, PictExit, PictJunction, PictRoute } from './icons'
import { Backdrop } from './Backdrop'
import { ONLINE, type Account } from '../game/backend'
import { checkoutUrl, hasPlus, PLUS_PRICE } from '../game/premium'

export interface PlusProps {
  data: GameData
  account: Account
  onSignIn: () => void
  onRefresh: () => Promise<void>
  onHome: () => void
}

/** The Plus pass: what it opens, and the way to get it. */
export function Plus({ data, account, onSignIn, onRefresh, onHome }: PlusProps) {
  const { t, lang } = useLang()
  const [busy, setBusy] = useState(false)
  const active = hasPlus(account)
  const shop = account.id ? checkoutUrl(account.id, account.email) : ''
  const until = account.plusUntil ? new Date(account.plusUntil).toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const refresh = async () => {
    setBusy(true)
    await onRefresh()
    setBusy(false)
  }
  return (
    <div className="results">
      <Backdrop data={data} />
      <div className="results-inner">
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
                  <PictRoute />
                </span>
                {t('plusFeat4')}
              </li>
            </ul>
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
