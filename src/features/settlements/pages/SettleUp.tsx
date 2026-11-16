import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGroup } from '@/contexts/GroupContext'
import { useAuth } from '@/contexts/AuthContext'
import { getSettlementSuggestions } from '@/services/balances'
import { listMembers } from '@/services/groups'
import { createSettlement, listSettlements, markSettlementPaidViaUpi, updateSettlementStatus } from '@/services/settlements'
import type { GroupMember, SettlementSuggestion, Settlement } from '@/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatMoney, sumMoney } from '@/lib/money'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { shareSettlementSuggestions } from '@/services/sharing'
import { Icon } from '@/components/ui/Icon'
import { UpiPaymentPrompt } from '@/components/UpiPaymentPrompt'
import type { UpiPendingPayment } from '@/components/UpiPaymentPrompt'
import { buildUpiLink, openUpiApp } from '@/lib/upi'
import { FEATURES } from '@/config/features'
import clsx from 'clsx'

export default function SettleUp() {
  const { activeGroup, activeMembership } = useGroup()
  const { user } = useAuth()
  const [suggestions, setSuggestions] = useState<SettlementSuggestion[]>([])
  const [pending, setPending] = useState<Settlement[]>([])
  const [members, setMembers] = useState<GroupMember[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [upiPayment, setUpiPayment] = useState<UpiPendingPayment | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const currency = activeGroup?.currency ?? 'INR'
  const myId = user?.id
  const isAdmin = activeMembership?.role === 'admin'

  const refresh = async () => {
    if (!activeGroup) return
    const [s, all, mem] = await Promise.all([
      getSettlementSuggestions(activeGroup.id),
      listSettlements(activeGroup.id),
      listMembers(activeGroup.id)
    ])
    setSuggestions(s)
    setPending(all.filter(x => x.status === 'pending' || x.status === 'paid'))
    setMembers(mem)
    setLoading(false)
  }

  useEffect(() => { refresh() }, [activeGroup])

  // Switching groups should not keep a member selected from the previous group.
  useEffect(() => {
    setSelectedMemberId('')
    setUpiPayment(null)
    setNotice(null)
  }, [activeGroup?.id])

  const upiIdFor = (userId: string) =>
    members.find(m => m.user_id === userId)?.profile?.upi_id?.trim() ?? ''

  /** Only used when FEATURES.settlements.record is on. */
  const recordSettlement = async (s: SettlementSuggestion) => {
    if (!activeGroup) return
    const key = `${s.from_user}-${s.to_user}`
    setBusy(key)
    setNotice(null)
    try {
      await createSettlement({ group_id: activeGroup.id, from_user_id: s.from_user, to_user_id: s.to_user, amount: s.amount })
      await refresh()
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : 'Could not record this settlement.' })
    } finally {
      setBusy(null)
    }
  }

  /**
   * Record the suggested transfer, then open the payer's UPI app with the
   * receiver's UPI ID and amount pre-filled. No gateway involved: the money
   * moves directly between the two people's bank accounts.
   */
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
      const link = buildUpiLink({
        upiId,
        payeeName: s.to_name,
        amount: s.amount,
        note: `${activeGroup.group_name} settlement`,
        transactionRef: settlement.id
      })
      setUpiPayment({ settlementId: settlement.id, amount: s.amount, currency, toName: s.to_name, upiId, link })
      openUpiApp(link)
      await refresh()
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : 'Could not start the UPI payment.' })
    } finally {
      setBusy(null)
    }
  }

  /** Pay an already-recorded pending settlement through UPI. */
  const payExistingWithUpi = (s: Settlement) => {
    if (!activeGroup) return
    const upiId = s.to_profile?.upi_id?.trim() || upiIdFor(s.to_user_id)
    const toName = s.to_profile?.name ?? 'the receiver'
    if (!upiId) {
      setNotice({ ok: false, text: `${toName} hasn't added a UPI ID yet. Ask them to add it in Profile.` })
      return
    }

    const link = buildUpiLink({
      upiId,
      payeeName: toName,
      amount: Number(s.amount),
      note: `${activeGroup.group_name} settlement`,
      transactionRef: s.id
    })
    setNotice(null)
    setUpiPayment({ settlementId: s.id, amount: Number(s.amount), currency, toName, upiId, link })
    openUpiApp(link)
  }

  /** Called by the prompt after the payer confirms in their UPI app. */
  const markUpiPaid = async () => {
    if (!upiPayment) return
    await markSettlementPaidViaUpi(upiPayment.settlementId, upiPayment.upiId)
    setUpiPayment(null)
    setNotice({ ok: true, text: 'Marked as paid. The receiver and group admins have been notified.' })
    await refresh()
  }

  /** Only used when FEATURES.settlements.markAsPaid is on. */
  const markPaid = async (id: string) => {
    setBusy(id)
    setNotice(null)
    try {
      await updateSettlementStatus(id, 'paid')
      await refresh()
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : 'Could not update this settlement.' })
    } finally {
      setBusy(null)
    }
  }

  const confirmPaid = async (id: string) => {
    setBusy(id)
    setNotice(null)
    try {
      await updateSettlementStatus(id, 'confirmed')
      await refresh()
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : 'Could not update this settlement.' })
    } finally {
      setBusy(null)
    }
  }

  const rejectPaid = async (id: string) => {
    setBusy(id)
    setNotice(null)
    try {
      await updateSettlementStatus(id, 'rejected')
      setNotice({ ok: false, text: 'Payment rejected. The payer has been asked to check and try again.' })
      await refresh()
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : 'Could not update this settlement.' })
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className="center-spinner"><Spinner /></div>

  const involvesMe = (s: SettlementSuggestion) => s.from_user === myId || s.to_user === myId

  // Admins start with the whole-group view and can drill into one member from
  // the dropdown. A regular member is always locked to their own view.
  const groupView = isAdmin && !selectedMemberId
  const focusId = isAdmin ? (selectedMemberId || null) : (myId ?? null)
  const selectedMember = members.find(m => m.user_id === selectedMemberId) ?? null
  const isSelf = Boolean(focusId) && focusId === myId
  const subject = isSelf ? 'You' : (selectedMember?.profile?.name ?? 'This member')

  const focusSuggestions = focusId
    ? suggestions.filter(s => s.from_user === focusId || s.to_user === focusId)
    : []
  const toPay = focusId ? focusSuggestions.filter(s => s.from_user === focusId) : []
  const toGet = focusId ? focusSuggestions.filter(s => s.to_user === focusId) : []
  const payTotal = sumMoney(toPay.map(s => s.amount))
  const getTotal = sumMoney(toGet.map(s => s.amount))
  const net = getTotal - payTotal
  const netState = Math.abs(net) < 0.01 ? 'settled' : net > 0 ? 'receive' : 'owe'
  const netText = netState === 'settled'
    ? 'Settled up'
    : isSelf
      ? (net > 0 ? `You get back ${formatMoney(net, currency)}` : `You owe ${formatMoney(-net, currency)}`)
      : (net > 0 ? `${subject} gets back ${formatMoney(net, currency)}` : `${subject} owes ${formatMoney(-net, currency)}`)

  const visiblePending = groupView
    ? pending
    : pending.filter(s => s.from_user_id === focusId || s.to_user_id === focusId)
  const shareList = groupView ? suggestions : focusSuggestions
  const total = sumMoney(suggestions.map(s => s.amount))

  // Manual "Record" / "Mark as paid" are currently off; the note points people
  // at UPI instead. Both the note and the buttons follow src/config/features.ts.
  const pendingIOwe = visiblePending.some(s => s.status === 'pending' && s.from_user_id === myId)
  const manualActionsOff = !FEATURES.settlements.record || !FEATURES.settlements.markAsPaid
  const showUpiOnlyNote = FEATURES.settlements.upiPay && manualActionsOff && !groupView
    && (toPay.length > 0 || pendingIOwe)

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Settle up</h1>
        {shareList.length > 0 && (
          <button className="link-btn" onClick={() => shareSettlementSuggestions(shareList, currency)}><Icon name="share" size={16} />Share</button>
        )}
      </div>

      <div className="row mt-sm">
        <Link to="/upi/pay" className="link-btn"><Icon name="wallet" size={15} />Pay with UPI</Link>
        {FEATURES.settlements.adminUpiDashboard && isAdmin && (
          <Link to="/upi/transactions" className="link-btn"><Icon name="banknote" size={15} />UPI transactions</Link>
        )}
      </div>

      {isAdmin && (
        <select
          className="select settle-filter mt-md"
          aria-label="Choose a member to view their settlements"
          value={selectedMemberId}
          onChange={e => setSelectedMemberId(e.target.value)}
        >
          <option value="">All members</option>
          {members.map(m => (
            <option key={m.user_id} value={m.user_id}>
              {m.profile?.name ?? 'Member'}{m.user_id === myId ? ' (you)' : ''}
            </option>
          ))}
        </select>
      )}

      {notice && (
        <p className={`banner ${notice.ok ? 'banner-ok' : 'banner-error'} mt-md`} role={notice.ok ? 'status' : 'alert'}>
          {notice.text}
        </p>
      )}

      {upiPayment && (
        <div className="mt-md">
          <UpiPaymentPrompt
            payment={upiPayment}
            onMarkPaid={markUpiPaid}
            onDismiss={() => setUpiPayment(null)}
          />
        </div>
      )}

      {showUpiOnlyNote && (
        <p className="banner banner-warn mt-md" role="note">
          <Icon name="info" size={16} />
          <span>Manual “Record” and “Mark as paid” are temporarily turned off. Settle with <strong>Pay via UPI</strong>.</span>
        </p>
      )}

      {groupView ? (
        <Card className={clsx('balance-card mt-lg', total > 0.01 ? 'owe' : '')}>
          <p className="card-label">Total pending</p>
          <p className="balance-amount tabular">{formatMoney(total, currency)}</p>
        </Card>
      ) : (
        <Card className={clsx('balance-card mt-lg', netState)}>
          <p className="card-label">{isSelf ? 'Your balance' : `${subject}'s balance`}</p>
          <p className="balance-amount tabular">{netText}</p>
          <div className="balance-meta">
            <span>To pay <strong className="tabular">{formatMoney(payTotal, currency)}</strong></span>
            <span>To get <strong className="tabular">{formatMoney(getTotal, currency)}</strong></span>
          </div>
        </Card>
      )}

      {groupView ? (
        <>
          <h2 className="section-title">Suggested transactions</h2>
          {suggestions.length === 0 ? (
            <EmptyState title="Nothing to settle" body="Everyone's balances are even." />
          ) : (
            <div className="stack-sm">
              {suggestions.map(s => {
                const key = `${s.from_user}-${s.to_user}`
                const mine = involvesMe(s)
                return (
                  <Card key={key} className="card-row">
                    <div className="flex-1">
                      <p className="transfer">{s.from_name}<Icon name="arrowRight" size={16} />{s.to_name}</p>
                      <p className="tabular fw-semibold mt-xs">{formatMoney(s.amount, currency)}</p>
                    </div>
                    {mine && (
                      <div className="row-actions">
                        {FEATURES.settlements.upiPay && s.from_user === myId && upiIdFor(s.to_user) && (
                          <Button className="btn-sm" disabled={busy === key} onClick={() => payWithUpi(s)}>
                            {busy === key ? 'Working…' : 'Pay via UPI'}
                          </Button>
                        )}
                        {FEATURES.settlements.record && (
                          <Button className="btn-sm" variant="secondary" disabled={busy === key} onClick={() => recordSettlement(s)}>
                            {busy === key ? 'Working…' : 'Record'}
                          </Button>
                        )}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {toPay.length === 0 && toGet.length === 0 ? (
            <EmptyState
              title="Nothing to settle"
              body={isSelf ? "You don't owe anyone, and nobody owes you." : `${subject} is all settled up.`}
            />
          ) : (
            <>
              {toPay.length > 0 && (
                <>
                  <h2 className="section-title">{isSelf ? 'You need to pay' : `${subject} needs to pay`}</h2>
                  <div className="stack-sm">
                    {toPay.map(s => {
                      const key = `${s.from_user}-${s.to_user}`
                      return (
                        <Card key={key} className="card-row">
                          <div className="flex-1">
                            <p className="transfer">{isSelf ? 'Pay to' : 'To'} <strong>{s.to_name}</strong></p>
                            <p className="tabular fw-semibold mt-xs text-owe">{formatMoney(s.amount, currency)}</p>
                          </div>
                          {isSelf && (
                            <div className="row-actions">
                              {FEATURES.settlements.upiPay && upiIdFor(s.to_user) && (
                                <Button className="btn-sm" disabled={busy === key} onClick={() => payWithUpi(s)}>
                                  {busy === key ? 'Working…' : 'Pay via UPI'}
                                </Button>
                              )}
                              {FEATURES.settlements.record && (
                                <Button className="btn-sm" variant="secondary" disabled={busy === key} onClick={() => recordSettlement(s)}>
                                  {busy === key ? 'Working…' : 'Record'}
                                </Button>
                              )}
                            </div>
                          )}
                        </Card>
                      )
                    })}
                  </div>
                </>
              )}

              {toGet.length > 0 && (
                <>
                  <h2 className="section-title">{isSelf ? 'You need to get' : `${subject} needs to get`}</h2>
                  <div className="stack-sm">
                    {toGet.map(s => {
                      const key = `${s.from_user}-${s.to_user}`
                      return (
                        <Card key={key} className="card-row">
                          <div className="flex-1">
                            <p className="transfer">{isSelf ? 'Collect from' : 'From'} <strong>{s.from_name}</strong></p>
                            <p className="tabular fw-semibold mt-xs text-receive">{formatMoney(s.amount, currency)}</p>
                          </div>
                          {isSelf && FEATURES.settlements.record && (
                            <Button variant="secondary" disabled={busy === key} onClick={() => recordSettlement(s)}>
                              {busy === key ? 'Recording…' : 'Record'}
                            </Button>
                          )}
                        </Card>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {visiblePending.length > 0 && (
        <>
          <h2 className="section-title">In progress</h2>
          <div className="stack-sm">
            {visiblePending.map(s => (
              <Card key={s.id} className="card-row">
                <div className="flex-1">
                  <p className="transfer">{s.from_profile?.name}<Icon name="arrowRight" size={16} />{s.to_profile?.name}</p>
                  <p className="row mt-xs">
                    <span className="tabular fw-semibold">{formatMoney(s.amount, currency)}</span>
                    <span className={clsx('status-tag', s.status)}>{s.status}</span>
                  </p>
                </div>
                <div className="row-actions">
                  {FEATURES.settlements.upiPay && s.status === 'pending' && s.from_user_id === myId && upiIdFor(s.to_user_id) && (
                    <Button className="btn-sm" disabled={busy === s.id} onClick={() => payExistingWithUpi(s)}>
                      {busy === s.id ? 'Working…' : 'Pay via UPI'}
                    </Button>
                  )}
                  {FEATURES.settlements.markAsPaid && s.status === 'pending' && s.from_user_id === myId && (
                    <Button className="btn-sm" variant="secondary" disabled={busy === s.id} onClick={() => markPaid(s.id)}>
                      {busy === s.id ? 'Working…' : 'Mark as paid'}
                    </Button>
                  )}
                  {FEATURES.settlements.confirmReceipt && s.status === 'paid' && s.to_user_id === myId && (
                    <Button className="btn-sm" disabled={busy === s.id} onClick={() => confirmPaid(s.id)}>
                      {busy === s.id ? 'Working…' : 'Confirm'}
                    </Button>
                  )}
                  {FEATURES.settlements.rejectReceipt && s.status === 'paid' && s.to_user_id === myId && (
                    <Button className="btn-sm" variant="danger" disabled={busy === s.id} onClick={() => rejectPaid(s.id)}>
                      {busy === s.id ? 'Working…' : 'Reject'}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
