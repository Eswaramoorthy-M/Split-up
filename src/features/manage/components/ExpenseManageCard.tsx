import { Link } from 'react-router-dom'
import clsx from 'clsx'
import type { Expense } from '@/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatMoney, toCents } from '@/lib/money'
import { shareExpense } from '@/services/sharing'
import { CategoryTile, Icon } from '@/components/ui/Icon'

interface Props {
  expense: Expense
  currency: string
  expanded: boolean
  onToggle: () => void
  canManage: boolean
  lockedReason?: string
  isMine: boolean
  busy: boolean
  onEditBreakdown: () => void
  onDelete: () => void
}

interface Row { userId: string; name: string; share: number; net: number; pct: number }

// Per-member picture of one expense: what each person's share is, and what
// they end up paying (negative) or getting back (positive) for this expense.
function buildRows(expense: Expense): Row[] {
  const totalCents = toCents(expense.amount)
  const rows: Row[] = (expense.participants ?? []).map(p => {
    const shareCents = toCents(p.amount)
    const paidCents = p.user_id === expense.paid_by_user_id ? totalCents : 0
    return {
      userId: p.user_id,
      name: p.profile?.name ?? 'Member',
      share: shareCents / 100,
      net: (paidCents - shareCents) / 100,
      pct: totalCents ? (shareCents / totalCents) * 100 : 0
    }
  })
  if (!rows.some(r => r.userId === expense.paid_by_user_id)) {
    rows.unshift({
      userId: expense.paid_by_user_id,
      name: expense.paid_by?.name ?? 'Member',
      share: 0,
      net: totalCents / 100,
      pct: 0
    })
  }
  return rows
}

export function ExpenseManageCard(props: Props) {
  const { expense, currency, expanded, onToggle, canManage, lockedReason, isMine, busy, onEditBreakdown, onDelete } = props
  const rows = expanded ? buildRows(expense) : []
  const date = new Date(expense.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  return (
    <Card className="manage-card">
      <button className="manage-card-head" onClick={onToggle} aria-expanded={expanded}>
        <CategoryTile icon={expense.category?.icon} />
        <span className="manage-card-main">
          <span className="expense-title">{expense.description}</span>
          <span className="expense-meta">
            {date} · Paid by {expense.paid_by?.name} · Added by {isMine ? 'you' : expense.creator?.name}
          </span>
          <span className="badge-row">
            <span className="badge">{expense.participants?.length ?? 0} members</span>
            {isMine && <span className="badge badge-brand">Your expense</span>}
            {lockedReason && !canManage && lockedReason.includes('closed') && <span className="badge badge-locked"><Icon name="lock" size={12} strokeWidth={2.2} />Month closed</span>}
          </span>
        </span>
        <span className="manage-card-amount">
          <span className="expense-amount">{formatMoney(expense.amount, currency)}</span>
          <span className={clsx('chevron', expanded && 'open')} aria-hidden="true"><Icon name="chevronDown" size={18} /></span>
        </span>
      </button>

      {expanded && (
        <div className="manage-card-body">
          <p className="breakdown-title">Payment breakdown</p>
          <div className="breakdown">
            {rows.map(r => (
              <div key={r.userId} className="breakdown-row">
                <span className="breakdown-name">{r.name}</span>
                <span className="breakdown-bar" aria-hidden="true"><span style={{ width: `${Math.min(r.pct, 100)}%` }} /></span>
                <span className="breakdown-share tabular">{formatMoney(r.share, currency)}</span>
                <span className={clsx('breakdown-net tabular', r.net > 0 && 'text-receive', r.net < 0 && 'text-owe')}>
                  {r.net > 0 ? `gets ${formatMoney(r.net, currency)}` : r.net < 0 ? `owes ${formatMoney(r.net, currency)}` : 'even'}
                </span>
              </div>
            ))}
          </div>
          {expense.notes && <p className="text-sm muted mt-sm">Note: {expense.notes}</p>}

          {canManage ? (
            <div className="manage-actions">
              <Link to={`/expenses/${expense.id}/edit`}><Button size="md" variant="secondary" className="btn-sm"><Icon name="edit" size={15} />Edit</Button></Link>
              <Button variant="secondary" className="btn-sm" onClick={onEditBreakdown} disabled={busy}><Icon name="sliders" size={15} />Edit breakdown</Button>
              <Button variant="ghost" className="btn-sm" onClick={() => shareExpense(expense, currency)}><Icon name="share" size={15} />Share</Button>
              <Button variant="danger" className="btn-sm" onClick={onDelete} disabled={busy}><Icon name="trash" size={15} />{busy ? 'Deleting…' : 'Delete'}</Button>
            </div>
          ) : (
            <div className="manage-actions">
              <Button variant="ghost" className="btn-sm" onClick={() => shareExpense(expense, currency)}><Icon name="share" size={15} />Share</Button>
              {lockedReason && <p className="text-xs muted flex-1">{lockedReason}</p>}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
