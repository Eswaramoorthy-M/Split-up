import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { formatMoney } from '@/lib/money'
import { isMobileDevice, openUpiApp } from '@/lib/upi'
import { FEATURES } from '@/config/features'

export interface UpiPendingPayment {
  settlementId: string
  amount: number
  currency: string
  toName: string
  upiId: string
  link: string
}

interface Props {
  payment: UpiPendingPayment
  onMarkPaid: () => Promise<void>
  onDismiss: () => void
}

/**
 * Shown after "Pay via UPI".
 *
 * A UPI app has no callback into the browser, so SplitUp cannot know for sure
 * that money moved. What we can detect is the person leaving the page for their
 * UPI app and coming back. With `autoMarkPaidOnReturn` on, that return marks the
 * settlement "paid" (awaiting the receiver's confirmation), which keeps the
 * payment in the history without pretending SplitUp verified the bank transfer.
 */
export function UpiPaymentPrompt({ payment, onMarkPaid, onDismiss }: Props) {
  const [returned, setReturned] = useState(false)
  const [showQr, setShowQr] = useState(() => !isMobileDevice())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const autoMarked = useRef(false)
  const onMarkPaidRef = useRef(onMarkPaid)

  useEffect(() => { onMarkPaidRef.current = onMarkPaid }, [onMarkPaid])

  // If the UPI app took over the screen, coming back means the person is
  // probably done (or cancelled). Optionally record the claim right away.
  useEffect(() => {
    let leftApp = false
    let disposed = false

    const markAutomatically = async () => {
      autoMarked.current = true
      setBusy(true)
      setError(null)
      try {
        await onMarkPaidRef.current()
      } catch (err) {
        if (disposed) return
        setError(err instanceof Error ? err.message : 'Could not update this settlement.')
        setBusy(false)
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        leftApp = true
        return
      }
      if (!leftApp) return
      leftApp = false
      setReturned(true)
      if (FEATURES.settlements.autoMarkPaidOnReturn && !autoMarked.current) {
        void markAutomatically()
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [payment.settlementId])

  const markPaid = async () => {
    setBusy(true)
    setError(null)
    try {
      await onMarkPaid()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this settlement.')
      setBusy(false)
    }
  }

  const copyUpiId = async () => {
    try {
      await navigator.clipboard.writeText(payment.upiId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Could not copy automatically. Select the UPI ID and copy it manually.')
    }
  }

  const autoMode = FEATURES.settlements.autoMarkPaidOnReturn

  return (
    <Card className="upi-prompt">
      <div className="upi-prompt-head">
        <span className="notification-icon" aria-hidden="true"><Icon name="wallet" size={19} /></span>
        <div className="flex-1">
          <p className="fw-semibold">Complete your UPI payment</p>
          <p className="text-sm muted">
            Pay <strong className="tabular">{formatMoney(payment.amount, payment.currency)}</strong> to {payment.toName}
          </p>
        </div>
      </div>

      <div className="upi-id-row mt-md">
        <span className="upi-id">{payment.upiId}</span>
        <button type="button" className="link-btn" onClick={copyUpiId}>
          <Icon name={copied ? 'check' : 'copy'} size={15} />{copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {returned && (
        <p className="banner banner-warn mt-md" role="status">
          <Icon name="info" size={16} />
          <span>
            {autoMode
              ? (busy
                  ? 'Back from your UPI app — recording this payment…'
                  : 'Back from your UPI app — recorded as paid. The receiver will confirm.')
              : 'Back from your UPI app — did the payment go through?'}
          </span>
        </p>
      )}

      <div className="upi-actions mt-md">
        {FEATURES.settlements.upiConfirmPaid && (
          <Button onClick={markPaid} disabled={busy}>{busy ? 'Saving…' : 'Yes, I’ve paid'}</Button>
        )}
        <Button variant="secondary" onClick={() => openUpiApp(payment.link)} disabled={busy}>
          <Icon name="wallet" size={16} />Open UPI app
        </Button>
        <Button variant="ghost" onClick={onDismiss} disabled={busy}>Not yet</Button>
      </div>

      <div className="upi-qr-wrap mt-md">
        <button type="button" className="link-btn" onClick={() => setShowQr(v => !v)}>
          <Icon name="grid" size={15} />{showQr ? 'Hide QR code' : 'Show QR code'}
        </button>
        {showQr && (
          <>
            <div className="upi-qr">
              <QRCodeSVG value={payment.link} size={176} marginSize={2} level="M" title={`UPI payment to ${payment.toName}`} />
            </div>
            <p className="text-sm muted text-center">Scan with any UPI app on your phone.</p>
          </>
        )}
      </div>

      {error && <p className="error-text mt-sm" role="alert">{error}</p>}
      {autoMode ? (
        <p className="field-hint mt-sm">
          SplitUp can’t see your bank confirmation. Returning from your UPI app records the payment
          and asks {payment.toName} to confirm it.
        </p>
      ) : FEATURES.settlements.upiConfirmPaid ? (
        <p className="field-hint mt-sm">
          SplitUp can’t see your bank confirmation. Tapping “Yes, I’ve paid” marks it paid and notifies
          {' '}{payment.toName} and the group admins.
        </p>
      ) : (
        <p className="field-hint mt-sm">
          Once you’ve paid, ask {payment.toName} to confirm receipt in SplitUp.
        </p>
      )}
    </Card>
  )
}
