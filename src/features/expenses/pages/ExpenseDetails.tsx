import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useGroup } from '@/contexts/GroupContext'
import { getExpense, deleteExpense } from '@/services/expenses'
import type { Expense } from '@/types'
import { canManageExpense } from '@/lib/permissions'
import { formatMoney } from '@/lib/money'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { shareExpense } from '@/services/sharing'
import { EmptyState } from '@/components/ui/EmptyState'
import { CategoryTile, Icon } from '@/components/ui/Icon'
import { confirmDialog } from '@/components/ui/ConfirmDialog'

export default function ExpenseDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { activeGroup, activeMembership } = useGroup()
  const [expense, setExpense] = useState<Expense | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getExpense(id)
      .then(e => { setExpense(e); setLoading(false) })
      .catch(err => { setError(err.message ?? 'Unable to load this expense.'); setLoading(false) })
  }, [id])

  if (loading) return <div className="center-spinner"><Spinner /></div>
  if (!expense) return <EmptyState title="Expense not found" body={error ?? undefined} />

  const closed = expense.cycle?.status === 'closed'
  const decision = canManageExpense({
    expense,
    userId: user?.id,
    role: activeMembership?.role,
    cycleClosed: closed
  })
  const canManage = decision.allowed
  const currency = activeGroup?.currency ?? 'INR'

  const onDelete = async () => {
    const confirmed = await confirmDialog({
      title: 'Delete this expense?',
      message: 'Everyone’s balances will be recalculated. This cannot be undone.',
      confirmLabel: 'Delete expense',
      tone: 'danger'
    })
    if (!confirmed) return
    setError(null)
    setDeleting(true)
    try {
      await deleteExpense(expense.id)
      navigate('/expenses')
    } catch (err: any) {
      setError(err.message ?? 'Unable to delete this expense. Try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="details-head">
        <CategoryTile icon={expense.category?.icon} size="lg" />
        <button className="link-btn" onClick={() => shareExpense(expense, currency)}><Icon name="share" size={16} />Share</button>
      </div>

      <h1 className="page-title mt-md">{expense.description}</h1>
      <p className="details-amount">{formatMoney(expense.amount, currency)}</p>
      <p className="details-meta">
        <span><Icon name="user" size={16} />Paid by {expense.paid_by?.name}</span>
        <span>{new Date(expense.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </p>

      <Card className="mt-lg">
        <p className="card-label mb-sm capitalize">Split ({expense.participants?.[0]?.split_type})</p>
        <div className="detail-list">
          {expense.participants?.map(p => (
            <div key={p.id} className="detail-line">
              <span><span className="avatar avatar-xs" aria-hidden="true">{p.profile?.name?.[0]?.toUpperCase()}</span>{p.profile?.name}</span>
              <span className="tabular fw-semibold">{formatMoney(p.amount, currency)}{p.percentage ? ` (${p.percentage}%)` : ''}</span>
            </div>
          ))}
        </div>
      </Card>

      {expense.notes && (
        <Card className="mt-md">
          <p className="card-label">Notes</p>
          <p className="text-sm mt-xs">{expense.notes}</p>
        </Card>
      )}

      {expense.receipt_path && (
        <Card className="mt-md">
          <p className="card-label mb-sm">Receipt</p>
          <p className="text-sm faint">Stored at {expense.receipt_path}</p>
        </Card>
      )}

      <p className="text-xs faint mt-md">Added by {expense.creator?.name ?? 'a member'} on {new Date(expense.created_at).toLocaleString('en-IN')}</p>

      {error && <p className="banner banner-error mt-md" role="alert">{error}</p>}

      {canManage ? (
        <div className="action-row mt-lg">
          <Link to={`/expenses/${expense.id}/edit`}><Button fullWidth variant="secondary"><Icon name="edit" size={17} />Edit</Button></Link>
          <Button variant="danger" onClick={onDelete} disabled={deleting}><Icon name="trash" size={17} />{deleting ? 'Deleting…' : 'Delete'}</Button>
        </div>
      ) : decision.reason ? (
        <p className="banner banner-warn mt-lg" role="status">{decision.reason}</p>
      ) : null}
    </div>
  )
}
