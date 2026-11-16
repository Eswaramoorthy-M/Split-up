import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useGroup } from '@/contexts/GroupContext'
import { useAuth } from '@/contexts/AuthContext'
import { listSettlements, markSettlementPaidViaUpi, updateSettlementStatus } from '@/services/settlements'
import type { Settlement } from '@/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatMoney } from '@/lib/money'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { UpiPaymentPrompt } from '@/components/UpiPaymentPrompt'
import type { UpiPendingPayment } from '@/components/UpiPaymentPrompt'
import { buildUpiLink, openUpiApp } from '@/lib/upi'
import { FEATURES } from '@/config/features'
import clsx from 'clsx'

export default function SettlementDetails() {
  const { id } = useParams()
  const { activeGroup } = useGroup()
  const { user } = useAuth()
  const [settlement, setSettlement] = useState<Settlement | null>(null)
  const [payment, setPayment] = useState<UpiPendingPayment | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    if (!activeGroup || !id) return
    const all = await listSettlements(activeGroup.id)
    setSettlement(all.find(s => s.id === id) ?? null)
    setLoading(false)
  }
  useEffect(() => { refresh() }, [activeGroup, id])

  if (loading) return <div className="center-spinner"><Spinner /></div>
  if (!settlement) return <EmptyState title="Settlement not found" />

  const currency = activeGroup?.currency ?? 'INR'
  const isPayer = settlement.from_user_id === user?.id
  const isReceiver = settlement.to_user_id === user?.id
  const toName = settlement.to_profile?.name ?? 'the receiver'
  const upiId = settlement.to_profile?.upi_id?.trim() ?? ''

  const payWithUpi = () => {
    if (!upiId) {
      setNotice({ ok: false, text: `${toName} hasn't added a UPI ID yet. Ask them to add it in Profile.` })
      return
    }
    const link = buildUpiLink({
      upiId,
      payeeName: toName,
      amount: Number(settlement.amount),
      note: `${activeGroup?.group_name ?? 'SplitUp'} settlement`,
      transactionRef: settlement.id
    })
    setNotice(null)
    setPayment({
      settlementId: settlement.id,
      amount: Number(settlement.amount),
      currency,
      toName,
      upiId,
      link
    })
    openUpiApp(link)
  }

  const markUpiPaid = async () => {
    if (!payment) return
    await markSettlementPaidViaUpi(payment.settlementId, payment.upiId)
    setPayment(null)
    setNotice({ ok: true, text: 'Marked as paid. The receiver and group admins have been notified.' })
    await refresh()
  }

  const setStatus = async (status: 'paid' | 'confirmed' | 'cancelled' | 'rejected') => {
    setBusy(true)
    setNotice(null)
    try {
      await updateSettlementStatus(settlement.id, status)
      await refresh()
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : 'Could not update this settlement.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="page-title">Settlement</h1>
      <Card className="mt-lg text-center settlement-card">
        <p className="transfer">{settlement.from_profile?.name}<Icon name="arrowRight" size={16} />{settlement.to_profile?.name}</p>
        <p className="big-number mt-sm">{formatMoney(settlement.amount, currency)}</p>
        <p className="mt-sm"><span className={clsx('status-tag', settlement.status)}>{settlement.status}</span></p>
        <p className="text-sm muted mt-sm">
          {settlement.payment_method === 'upi' ? 'UPI' : 'Manual'}
          {settlement.upi_id_used ? ` · ${settlement.upi_id_used}` : ''}
          {settlement.paid_at ? ` · ${new Date(settlement.paid_at).toLocaleString()}` : ''}
        </p>
      </Card>

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

      <div className="stack-sm mt-lg">
        {FEATURES.settlements.upiPay && settlement.status === 'pending' && isPayer && upiId && (
          <Button fullWidth onClick={payWithUpi}>Pay via UPI</Button>
        )}
        {FEATURES.settlements.markAsPaid && settlement.status === 'pending' && isPayer && (
          <Button fullWidth variant={upiId ? 'secondary' : 'primary'} disabled={busy} onClick={() => setStatus('paid')}>
            {busy ? 'Saving…' : 'Mark as paid'}
          </Button>
        )}
        {FEATURES.settlements.confirmReceipt && settlement.status === 'paid' && isReceiver && (
          <Button fullWidth disabled={busy} onClick={() => setStatus('confirmed')}>
            {busy ? 'Saving…' : 'Confirm payment'}
          </Button>
        )}
        {FEATURES.settlements.rejectReceipt && settlement.status === 'paid' && isReceiver && (
          <Button fullWidth variant="danger" disabled={busy} onClick={() => setStatus('rejected')}>
            {busy ? 'Saving…' : 'Payment didn’t arrive'}
          </Button>
        )}
        {FEATURES.settlements.cancel && settlement.status === 'pending' && (isPayer || isReceiver) && (
          <Button fullWidth variant="danger" disabled={busy} onClick={() => setStatus('cancelled')}>Cancel</Button>
        )}
      </div>
    </div>
  )
}
