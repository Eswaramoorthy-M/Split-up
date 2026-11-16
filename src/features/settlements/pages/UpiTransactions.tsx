import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGroup } from '@/contexts/GroupContext'
import { getSettlementSuggestions } from '@/services/balances'
import { listMembers } from '@/services/groups'
import { closeAllSettlements, listSettlements, resetAllSettlements } from '@/services/settlements'
import type { GroupMember, Settlement, SettlementSuggestion, SettlementStatus } from '@/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { confirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatMoney, sumMoney } from '@/lib/money'
import { FEATURES } from '@/config/features'
import clsx from 'clsx'

const statusFilters: Array<{ value: 'all' | SettlementStatus; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Awaiting confirmation' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' }
]

export default function UpiTransactions() {
  const { activeGroup, activeMembership } = useGroup()
  const [members, setMembers] = useState<GroupMember[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [suggestions, setSuggestions] = useState<SettlementSuggestion[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | SettlementStatus>('all')
  const [memberFilter, setMemberFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'close' | 'reset' | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  const isAdmin = activeMembership?.role === 'admin'
  const currency = activeGroup?.currency ?? 'INR'

  const refresh = async (groupId: string) => {
    const [mem, all, sug] = await Promise.all([
      listMembers(groupId),
      listSettlements(groupId),
      getSettlementSuggestions(groupId)
    ])
    setMembers(mem)
    setSettlements(all)
    setSuggestions(sug)
  }

  useEffect(() => {
    if (!activeGroup || !FEATURES.settlements.adminUpiDashboard) { setLoading(false); return }
    refresh(activeGroup.id)
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [activeGroup])

  /** Admin: confirm every pending / awaiting payment so the group reads settled. */
  const closeAll = async () => {
    if (!activeGroup) return
    const confirmed = await confirmDialog({
      title: 'Close all transactions?',
      message: 'Every pending and awaiting payment will be marked confirmed, so the group reads settled up. This cannot be undone.',
      confirmLabel: 'Close & settle all'
    })
    if (!confirmed) return
    setBusy('close')
    setNotice(null)
    try {
      const count = await closeAllSettlements(activeGroup.id)
      setNotice({
        ok: true,
        text: count > 0
          ? `Closed ${count} ${count === 1 ? 'transaction' : 'transactions'}. The group is settled up.`
          : 'There was nothing to close — the group is already settled up.'
      })
      await refresh(activeGroup.id)
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : 'Could not close the transactions.' })
    } finally {
      setBusy(null)
    }
  }

  /** Admin: delete the settlement history so suggestions start over. */
  const resetAll = async () => {
    if (!activeGroup) return
    const confirmed = await confirmDialog({
      title: 'Reset all transactions?',
      message: 'This permanently deletes the settlement history for this group, and “who pays whom” is recalculated from the expenses. This cannot be undone.',
      confirmLabel: 'Reset everything',
      tone: 'danger'
    })
    if (!confirmed) return
    setBusy('reset')
    setNotice(null)
    try {
      const count = await resetAllSettlements(activeGroup.id)
      setNotice({
        ok: true,
        text: count > 0
          ? `Reset ${count} ${count === 1 ? 'transaction' : 'transactions'}. Suggestions start fresh.`
          : 'There were no transactions to reset.'
      })
      await refresh(activeGroup.id)
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : 'Could not reset the transactions.' })
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className="center-spinner"><Spinner /></div>

  if (!isAdmin || !FEATURES.settlements.adminUpiDashboard) {
    return (
      <div>
        <h1 className="page-title">UPI transactions</h1>
        <EmptyState
          title="Admins only"
          body="Only a group admin can see every member’s UPI payment history."
        />
      </div>
    )
  }

  const sum = (rows: Settlement[]) => sumMoney(rows.map(s => Number(s.amount)))

  const pendingTotal = sumMoney(suggestions.map(s => Number(s.amount)))
  const awaitingRows = settlements.filter(s => s.status === 'paid')
  const confirmedRows = settlements.filter(s => s.status === 'confirmed')
  const rejectedRows = settlements.filter(s => s.status === 'rejected')

  const perMember = members.map(m => {
    const outgoing = settlements.filter(s => s.from_user_id === m.user_id)
    const incoming = settlements.filter(s => s.to_user_id === m.user_id)
    return {
      member: m,
      upiId: m.profile?.upi_id?.trim() ?? '',
      pendingToPay: sumMoney(suggestions.filter(s => s.from_user === m.user_id).map(s => Number(s.amount))),
      awaiting: sum(outgoing.filter(s => s.status === 'paid')),
      paidOut: sum(outgoing.filter(s => s.status === 'confirmed')),
      pendingToReceive: sum(incoming.filter(s => s.status === 'paid')),
      received: sum(incoming.filter(s => s.status === 'confirmed'))
    }
  })

  const visible = settlements.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    if (memberFilter && s.from_user_id !== memberFilter && s.to_user_id !== memberFilter) return false
    return true
  })

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">UPI transactions</h1>
        <Link to="/more" className="link-btn"><Icon name="chevronLeft" size={15} />More</Link>
      </div>
      <p className="text-sm muted">Every member’s UPI payments in this group. Admin view.</p>

      <div className="upi-summary-grid mt-lg">
        <Card className="text-center">
          <p className="card-label">Pending</p>
          <p className="stat-value text-owe">{formatMoney(pendingTotal, currency)}</p>
          <p className="text-sm muted">{suggestions.length} open {suggestions.length === 1 ? 'transfer' : 'transfers'}</p>
        </Card>
        <Card className="text-center">
          <p className="card-label">Awaiting confirmation</p>
          <p className="stat-value">{formatMoney(sum(awaitingRows), currency)}</p>
          <p className="text-sm muted">{awaitingRows.length} claimed by payers</p>
        </Card>
        <Card className="text-center">
          <p className="card-label">Confirmed paid</p>
          <p className="stat-value text-receive">{formatMoney(sum(confirmedRows), currency)}</p>
          <p className="text-sm muted">{confirmedRows.length} confirmed</p>
        </Card>
      </div>

      {rejectedRows.length > 0 && (
        <p className="banner banner-warn mt-md" role="note">
          <Icon name="alert" size={16} />
          <span>{rejectedRows.length} payment {rejectedRows.length === 1 ? 'was' : 'were'} rejected by the receiver and still count as unpaid.</span>
        </p>
      )}

      {(FEATURES.settlements.closeAllSettlements || FEATURES.settlements.resetSettlements) && (
        <Card className="admin-settlement-actions mt-lg">
          <p className="fw-semibold">Close out this cycle</p>
          <p className="text-sm muted">
            Closing marks every pending / awaiting payment as confirmed. Resetting deletes the
            transaction history so “who pays whom” starts over from the expenses.
          </p>
          <div className="admin-settlement-buttons mt-md">
            {FEATURES.settlements.closeAllSettlements && (
              <Button disabled={busy !== null} onClick={closeAll}>
                {busy === 'close' ? 'Closing…' : 'Close & settle all'}
              </Button>
            )}
            {FEATURES.settlements.resetSettlements && (
              <Button variant="danger" disabled={busy !== null} onClick={resetAll}>
                {busy === 'reset' ? 'Resetting…' : 'Reset all transactions'}
              </Button>
            )}
          </div>
          <p className="field-hint mt-sm">
            Both actions affect every member in this group. Only admins can run them.
          </p>
        </Card>
      )}

      {notice && (
        <p className={`banner ${notice.ok ? 'banner-ok' : 'banner-error'} mt-md`} role={notice.ok ? 'status' : 'alert'}>
          {notice.text}
        </p>
      )}

      <h2 className="section-title">Members</h2>
      <div className="stack-sm">
        {perMember.map(row => (
          <Card key={row.member.user_id}>
            <div className="card-row">
              <div className="flex-1">
                <p className="fw-semibold">{row.member.profile?.name ?? 'Member'}</p>
                <p className="text-sm muted">
                  {row.upiId || 'No UPI ID saved'}
                  {row.member.role === 'admin' ? ' · Admin' : ''}
                </p>
              </div>
              <Link to={`/members/${row.member.user_id}`} className="link-btn">
                View<Icon name="chevronRight" size={15} />
              </Link>
            </div>
            <div className="upi-member-stats mt-md">
              <div>
                <p className="stat-label">To pay</p>
                <p className={clsx('stat-value', row.pendingToPay > 0 && 'text-owe')}>
                  {formatMoney(row.pendingToPay, currency)}
                </p>
              </div>
              <div>
                <p className="stat-label">Claimed paid</p>
                <p className="stat-value">{formatMoney(row.awaiting, currency)}</p>
              </div>
              <div>
                <p className="stat-label">Paid</p>
                <p className="stat-value text-receive">{formatMoney(row.paidOut, currency)}</p>
              </div>
              <div>
                <p className="stat-label">To receive</p>
                <p className="stat-value">{formatMoney(row.pendingToReceive, currency)}</p>
              </div>
              <div>
                <p className="stat-label">Received</p>
                <p className="stat-value text-receive">{formatMoney(row.received, currency)}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <h2 className="section-title">Transaction history</h2>
      <div className="upi-filters">
        <select
          className="select"
          aria-label="Filter by status"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as 'all' | SettlementStatus)}
        >
          {statusFilters.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select
          className="select"
          aria-label="Filter by member"
          value={memberFilter}
          onChange={e => setMemberFilter(e.target.value)}
        >
          <option value="">All members</option>
          {members.map(m => (
            <option key={m.user_id} value={m.user_id}>{m.profile?.name ?? 'Member'}</option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No transactions" body="Nothing matches these filters yet." />
      ) : (
        <div className="stack-sm mt-md">
          {visible.map(s => (
            <Card key={s.id} className="card-row">
              <div className="flex-1">
                <p className="transfer">
                  {s.from_profile?.name ?? 'Member'}<Icon name="arrowRight" size={16} />{s.to_profile?.name ?? 'Member'}
                </p>
                <p className="row mt-xs">
                  <span className="tabular fw-semibold">{formatMoney(s.amount, currency)}</span>
                  <span className={clsx('status-tag', s.status)}>{s.status}</span>
                </p>
                <p className="text-sm muted mt-xs">
                  {s.payment_method === 'upi' ? 'UPI' : 'Manual'}
                  {s.upi_id_used ? ` · to ${s.upi_id_used}` : ''}
                  {' · '}{new Date(s.created_at).toLocaleString()}
                </p>
              </div>
              <Link to={`/settlements/${s.id}`} className="link-btn">
                Open<Icon name="chevronRight" size={15} />
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
