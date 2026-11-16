import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGroup } from '@/contexts/GroupContext'
import { useAuth } from '@/contexts/AuthContext'
import { getSettlementSuggestions } from '@/services/balances'
import { listMembers } from '@/services/groups'
import {
  createSettlement,
  listSettlements,
  markSettlementPaidViaUpi,
  updateSettlementStatus
} from '@/services/settlements'
import type { GroupMember, Settlement, SettlementSuggestion } from '@/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { UpiPaymentPrompt } from '@/components/UpiPaymentPrompt'
import type { UpiPendingPayment } from '@/components/UpiPaymentPrompt'
import { formatMoney, sumMoney } from '@/lib/money'
import { buildUpiLink, openUpiApp } from '@/lib/upi'
import { FEATURES } from '@/config/features'
import clsx from 'clsx'

const historyStatuses = ['confirmed', 'rejected', 'cancelled']

export default function PayWithUpi() {
  const { activeGroup } = useGroup()
  const { user } = useAuth()
  const [suggestions, setSuggestions] = useState<SettlementSuggestion[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [members, setMembers] = useState<GroupMember[]>([])
  const [payment, setPayment] = useState<UpiPendingPayment | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const myId = user?.id
  const currency = activeGroup?.currency ?? 'INR'

  const refresh = async () => {
    if (!activeGroup) return
    const [s, all, mem] = await Promise.all([
      getSettlementSuggestions(activeGroup.id),
      listSettlements(activeGroup.id),
      listMembers(activeGroup.id)
    ])
    setSuggestions(s)
    setSettlements(all)
    setMembers(mem)
    setLoading(false)
  }

  useEffect(() => {
    setPayment(null)
    setNotice(null)
    refresh()
  }, [activeGroup])

  const memberFor = (id: string) => members.find(m => m.user_id === id)
  const upiIdFor = (id: string) => memberFor(id)?.profile?.upi_id?.trim() ?? ''
  const myUpiId = myId ? upiIdFor(myId) : ''

  const suggestionsToPay = suggestions.filter(s => s.from_user === myId)
  const pendingIOwe = settlements.filter(s => s.from_user_id === myId && s.status === 'pending')
  const awaitingOther = settlements.filter(s => s.from_user_id === myId && s.status === 'paid')
  const awaitingMyConfirm = settlements.filter(s => s.to_user_id === myId && s.status === 'paid')
  const myHistory = settlements.filter(
    s => (s.from_user_id === myId || s.to_user_id === myId) && historyStatuses.includes(s.status)
  )
  const toPayTotal = sumMoney(suggestionsToPay.map(s => s.amount))
  const awaitingTotal = sumMoney(awaitingMyConfirm.map(s => Number(s.amount)))
  const receivedTotal = sumMoney(
    settlements.filter(s => s.to_user_id === myId && s.status === 'confirmed').map(s => Number(s.amount))
  )

  const openPrompt = (settlement: Settlement, upiId: string, toName: string) => {
    if (!activeGroup) return
    const amount = Number(settlement.amount)
    const link = buildUpiLink({
      upiId,
      payeeName: toName,
      amount,
      note: `${activeGroup.group_name} settlement`,
      transactionRef: settlement.id
    })
    setNotice(null)
    setPayment({ settlementId: settlement.id, amount, currency, toName, upiId, link })
    openUpiApp(link)
  }

  /** Record the suggested transfer as a UPI payment, then open the UPI app. */
  const payWithUpi = async (s: SettlementSuggestion) => {
    if (!activeGroup) return
    const upiId = upiIdFor(s.to_user)
    if (!upiId) {
      setNotice({ ok: false, text: `${s.to_name} hasn't added a UPI ID yet. Ask them to add it in Profile.` })
      return
    }

    const key = `${s.from_user}-${s.to_user}`
    setBusy(key)
    setNotice(null)
    try {
      const settlement = await createSettlement({
        group_id: activeGroup.id,
        from_user_id: s.from_user,
        to_user_id: s.to_user,
        amount: s.amount,
        payment_method: 'upi',
        upi_id_used: upiId
      })
      setBusy(null)
      openPrompt(settlement, upiId, s.to_name)
      await refresh()
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : 'Could not start the UPI payment.' })
      setBusy(null)
    }
  }

  /** Pay an already-recorded pending settlement through UPI. */
  const payExistingWithUpi = (s: Settlement) => {
    const upiId = s.to_profile?.upi_id?.trim() || upiIdFor(s.to_user_id)
    const toName = s.to_profile?.name ?? 'the receiver'
    if (!upiId) {
      setNotice({ ok: false, text: `${toName} hasn't added a UPI ID yet. Ask them to add it in Profile.` })
      return
    }
    openPrompt(s, upiId, toName)
  }

  /** Called by the prompt after the payer confirms / returns from the UPI app. */
  const markUpiPaid = async () => {
    if (!payment) return
    await markSettlementPaidViaUpi(payment.settlementId, payment.upiId)
    setPayment(null)
    setNotice({ ok: true, text: 'Payment recorded. The receiver and group admins have been notified.' })
    await refresh()
  }

  const decide = async (id: string, status: 'confirmed' | 'rejected') => {
    setBusy(id)
    setNotice(null)
    try {
      await updateSettlementStatus(id, status)
      setNotice({
        ok: status === 'confirmed',
        text: status === 'confirmed'
          ? 'Payment confirmed.'
          : 'Payment rejected. The payer has been asked to check and try again.'
      })
      await refresh()
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : 'Could not update this settlement.' })
    } finally {
      setBusy(null)
    }
  }

  const claimPaid = async (id: string) => {
    setBusy(id)
    setNotice(null)
    try {
      await updateSettlementStatus(id, 'paid')
      setNotice({ ok: true, text: 'Marked as paid. Waiting for the receiver to confirm.' })
      await refresh()
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : 'Could not update this settlement.' })
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className="center-spinner"><Spinner /></div>

  const hasAnything = suggestionsToPay.length > 0 || pendingIOwe.length > 0
    || awaitingOther.length > 0 || awaitingMyConfirm.length > 0 || myHistory.length > 0

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Pay with UPI</h1>
        <Link to="/settle" className="link-btn"><Icon name="chevronLeft" size={15} />Settle up</Link>
      </div>

      {!myUpiId && (
        <p className="banner banner-warn mt-md" role="note">
          <Icon name="info" size={16} />
          <span>
            You haven’t added a UPI ID yet, so others can’t pay you. Add it in <Link to="/profile">Profile</Link>.
          </span>
        </p>
      )}

      {notice && (
        <p className={`banner ${notice.ok ? 'banner-ok' : 'banner-error'} mt-md`} role={notice.ok ? 'status' : 'alert'}>
          {notice.text}
        </p>
      )}

      {payment && (
        <div className="mt-md">
          <UpiPaymentPrompt payment={payment} onMarkPaid={markUpiPaid} onDismiss={() => setPayment(null)} />
        </div>
      )}

      <div className="upi-summary-grid mt-lg">
        <Card className="text-center">
          <p className="card-label">You need to pay</p>
          <p className="stat-value text-owe">{formatMoney(toPayTotal, currency)}</p>
        </Card>
        <Card className="text-center">
          <p className="card-label">To confirm</p>
          <p className="stat-value">{formatMoney(awaitingTotal, currency)}</p>
        </Card>
        <Card className="text-center">
          <p className="card-label">Received</p>
          <p className="stat-value text-receive">{formatMoney(receivedTotal, currency)}</p>
        </Card>
      </div>

      {awaitingMyConfirm.length > 0 && (
        <>
          <h2 className="section-title">Payments waiting for your confirmation</h2>
          <p className="text-sm muted">Confirm only after the money shows in your bank / UPI app.</p>
          <div className="stack-sm mt-sm">
            {awaitingMyConfirm.map(s => (
              <Card key={s.id} className="card-row">
                <div className="flex-1">
                  <p className="transfer">From <strong>{s.from_profile?.name ?? 'a member'}</strong></p>
                  <p className="row mt-xs">
                    <span className="tabular fw-semibold text-receive">{formatMoney(s.amount, currency)}</span>
                    <span className={clsx('status-tag', s.status)}>{s.status}</span>
                  </p>
                  <p className="text-sm muted mt-xs">
                    {s.payment_method === 'upi' ? 'Paid via UPI' : 'Recorded manually'}
                    {s.upi_id_used ? ` · to ${s.upi_id_used}` : ''}
                    {s.paid_at ? ` · ${new Date(s.paid_at).toLocaleString()}` : ''}
                  </p>
                </div>
                <div className="row-actions">
                  {FEATURES.settlements.confirmReceipt && (
                    <Button className="btn-sm" disabled={busy === s.id} onClick={() => decide(s.id, 'confirmed')}>
                      {busy === s.id ? 'Saving…' : 'Confirm'}
                    </Button>
                  )}
                  {FEATURES.settlements.rejectReceipt && (
                    <Button className="btn-sm" variant="danger" disabled={busy === s.id} onClick={() => decide(s.id, 'rejected')}>
                      {busy === s.id ? 'Saving…' : 'Reject'}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {awaitingOther.length > 0 && (
        <>
          <h2 className="section-title">Waiting for the receiver to confirm</h2>
          <div className="stack-sm">
            {awaitingOther.map(s => (
              <Card key={s.id} className="card-row">
                <div className="flex-1">
                  <p className="transfer">You paid <strong>{s.to_profile?.name ?? 'the receiver'}</strong></p>
                  <p className="row mt-xs">
                    <span className="tabular fw-semibold">{formatMoney(s.amount, currency)}</span>
                    <span className={clsx('status-tag', s.status)}>{s.status}</span>
                  </p>
                  <p className="text-sm muted mt-xs">
                    {s.payment_method === 'upi' ? 'UPI' : 'Manual'}
                    {s.paid_at ? ` · ${new Date(s.paid_at).toLocaleString()}` : ''}
                  </p>
                </div>
                <div className="row-actions">
                  {FEATURES.settlements.upiPay && s.payment_method === 'upi' && upiIdFor(s.to_user_id) && (
                    <Button className="btn-sm" variant="secondary" disabled={busy === s.id} onClick={() => payExistingWithUpi(s)}>
                      {busy === s.id ? 'Working…' : 'Open again'}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {suggestionsToPay.length > 0 && (
        <>
          <h2 className="section-title">You need to pay</h2>
          <div className="stack-sm">
            {suggestionsToPay.map(s => {
              const key = `${s.from_user}-${s.to_user}`
              const upiId = upiIdFor(s.to_user)
              return (
                <Card key={key} className="card-row">
                  <div className="flex-1">
                    <p className="transfer">Pay to <strong>{s.to_name}</strong></p>
                    <p className="row mt-xs">
                      <span className="tabular fw-semibold text-owe">{formatMoney(s.amount, currency)}</span>
                      {upiId
                        ? <span className="text-sm muted">{upiId}</span>
                        : <span className="text-sm muted">No UPI ID yet</span>}
                    </p>
                  </div>
                  {FEATURES.settlements.upiPay && upiId && (
                    <Button className="btn-sm" disabled={busy === key} onClick={() => payWithUpi(s)}>
                      {busy === key ? 'Working…' : 'Pay via UPI'}
                    </Button>
                  )}
                </Card>
              )
            })}
          </div>
        </>
      )}

      {pendingIOwe.length > 0 && (
        <>
          <h2 className="section-title">Recorded, not confirmed yet</h2>
          <div className="stack-sm">
            {pendingIOwe.map(s => (
              <Card key={s.id} className="card-row">
                <div className="flex-1">
                  <p className="transfer">To <strong>{s.to_profile?.name ?? 'the receiver'}</strong></p>
                  <p className="row mt-xs">
                    <span className="tabular fw-semibold">{formatMoney(s.amount, currency)}</span>
                    <span className={clsx('status-tag', s.status)}>{s.status}</span>
                  </p>
                  <p className="text-sm muted mt-xs">{new Date(s.created_at).toLocaleString()}</p>
                </div>
                <div className="row-actions">
                  {FEATURES.settlements.upiPay && upiIdFor(s.to_user_id) && (
                    <Button className="btn-sm" disabled={busy === s.id} onClick={() => payExistingWithUpi(s)}>
                      {busy === s.id ? 'Working…' : 'Pay via UPI'}
                    </Button>
                  )}
                  {FEATURES.settlements.markAsPaid && (
                    <Button className="btn-sm" variant="secondary" disabled={busy === s.id} onClick={() => claimPaid(s.id)}>
                      {busy === s.id ? 'Saving…' : 'Mark as paid'}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {myHistory.length > 0 && (
        <>
          <h2 className="section-title">UPI history</h2>
          <div className="stack-sm">
            {myHistory.map(s => {
              const outgoing = s.from_user_id === myId
              const other = outgoing ? s.to_profile?.name : s.from_profile?.name
              return (
                <Card key={s.id} className="card-row">
                  <div className="flex-1">
                    <p className="transfer">
                      {outgoing ? 'You paid' : 'You received from'} <strong>{other ?? 'a member'}</strong>
                    </p>
                    <p className="row mt-xs">
                      <span className={clsx('tabular fw-semibold', outgoing ? 'text-owe' : 'text-receive')}>
                        {formatMoney(s.amount, currency)}
                      </span>
                      <span className={clsx('status-tag', s.status)}>{s.status}</span>
                    </p>
                    <p className="text-sm muted mt-xs">
                      {s.payment_method === 'upi' ? 'UPI' : 'Manual'}
                      {s.confirmed_at ? ` · ${new Date(s.confirmed_at).toLocaleString()}` : ''}
                      {s.rejected_at ? ` · rejected ${new Date(s.rejected_at).toLocaleString()}` : ''}
                    </p>
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {!hasAnything && (
        <EmptyState title="Nothing to pay" body="Your balance is settled." />
      )}

      {FEATURES.settlements.adminUpiDashboard && (
        <p className="text-sm muted mt-lg text-center">
          SplitUp cannot verify a bank transfer. The receiver confirms each payment.
        </p>
      )}
    </div>
  )
}
