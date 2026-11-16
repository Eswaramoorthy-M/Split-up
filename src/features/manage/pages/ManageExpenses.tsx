import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { useGroup } from '@/contexts/GroupContext'
import { useAuth } from '@/contexts/AuthContext'
import { deleteExpense, listCycles, listExpensesForManage } from '@/services/expenses'
import { getGroupBalances } from '@/services/balances'
import { listCategories, listMembers } from '@/services/groups'
import type { Category, CycleInfo, Expense, GroupBalance, GroupMember } from '@/types'
import { canManageExpense } from '@/lib/permissions'
import { formatMoney, sumMoney } from '@/lib/money'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { Icon } from '@/components/ui/Icon'
import { confirmDialog } from '@/components/ui/ConfirmDialog'
import { ExpenseManageCard } from '../components/ExpenseManageCard'
import { BreakdownEditor } from '../components/BreakdownEditor'
import { MemberBreakdown } from '../components/MemberBreakdown'

type Tab = 'expenses' | 'members'

export default function ManageExpenses() {
  const { activeGroup, activeMembership } = useGroup()
  const { user } = useAuth()
  const currency = activeGroup?.currency ?? 'INR'
  const role = activeMembership?.role
  const isAdmin = role === 'admin'

  const [tab, setTab] = useState<Tab>('expenses')
  const [cycles, setCycles] = useState<CycleInfo[]>([])
  const [cycleId, setCycleId] = useState('') // '' = all months
  const [ready, setReady] = useState(false)

  const [members, setMembers] = useState<GroupMember[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [balances, setBalances] = useState<GroupBalance[]>([])

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [payerId, setPayerId] = useState('')
  const [onlyMine, setOnlyMine] = useState(false)

  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  // One-time setup: months, members and categories.
  useEffect(() => {
    if (!activeGroup) return
    Promise.all([listCycles(activeGroup.id), listMembers(activeGroup.id), listCategories(activeGroup.id)])
      .then(([c, m, cat]) => {
        setCycles(c); setMembers(m); setCategories(cat)
        setCycleId(c[0]?.id ?? '')
        setReady(true)
      })
      .catch(err => { setMessage({ kind: 'error', text: err.message ?? 'Could not load the group.' }); setLoading(false) })
  }, [activeGroup])

  const load = useCallback(async () => {
    if (!activeGroup) return
    setLoading(true)
    try {
      const [ex, bal] = await Promise.all([
        listExpensesForManage(activeGroup.id, cycleId || undefined),
        getGroupBalances(activeGroup.id, cycleId || undefined)
      ])
      setExpenses(ex)
      setBalances(bal)
    } catch (err: any) {
      setMessage({ kind: 'error', text: err.message ?? 'Unable to load expenses. Check your connection and try again.' })
    } finally {
      setLoading(false)
    }
  }, [activeGroup, cycleId])

  useEffect(() => { if (ready) load() }, [ready, load])

  const cycleById = useMemo(() => new Map(cycles.map(c => [c.id, c])), [cycles])
  const selectedCycle = cycleId ? cycleById.get(cycleId) : undefined

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return expenses.filter(e =>
      (!q || e.description.toLowerCase().includes(q)) &&
      (!categoryId || e.category_id === categoryId) &&
      (!payerId || e.paid_by_user_id === payerId) &&
      (!onlyMine || e.created_by === user?.id)
    )
  }, [expenses, search, categoryId, payerId, onlyMine, user?.id])

  const total = sumMoney(visible.map(e => e.amount))
  const filtersActive = Boolean(search || categoryId || payerId || onlyMine)

  const onDelete = async (expense: Expense) => {
    const confirmed = await confirmDialog({
      title: `Delete "${expense.description}"?`,
      message: 'Everyone’s balances will be recalculated. This cannot be undone.',
      confirmLabel: 'Delete expense',
      tone: 'danger'
    })
    if (!confirmed) return
    setBusyId(expense.id)
    setMessage(null)
    try {
      await deleteExpense(expense.id)
      setMessage({ kind: 'ok', text: `Deleted "${expense.description}".` })
      await load()
    } catch (err: any) {
      setMessage({ kind: 'error', text: err.message ?? 'Unable to delete. Try again.' })
    } finally {
      setBusyId(null)
    }
  }

  const onSaved = async () => {
    setEditing(null)
    setMessage({ kind: 'ok', text: 'Payment breakdown updated. Balances are recalculated.' })
    await load()
  }

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Manage expenses</h1>
        <span className={clsx('role-badge', isAdmin && 'admin')}><Icon name={isAdmin ? 'settings' : 'user'} size={14} strokeWidth={2} />{isAdmin ? 'Admin' : 'Member'}</span>
      </div>
      <p className="page-sub">
        {isAdmin
          ? 'As an admin you can edit, delete and re-split every expense in the group.'
          : 'You can see every expense. You can change the ones you added.'}
      </p>

      <div className="tabs mt-lg" role="tablist">
        <button role="tab" aria-selected={tab === 'expenses'} className={clsx('tab', tab === 'expenses' && 'active')} onClick={() => setTab('expenses')}>All expenses</button>
        <button role="tab" aria-selected={tab === 'members'} className={clsx('tab', tab === 'members' && 'active')} onClick={() => setTab('members')}>Member breakdown</button>
      </div>

      <select className="select mt-md report-month" aria-label="Month" value={cycleId} onChange={e => { setCycleId(e.target.value); setExpandedId(null) }}>
        <option value="">All months</option>
        {cycles.map(c => <option key={c.id} value={c.id}>{c.label}{c.status === 'closed' ? ' (closed)' : ''}</option>)}
      </select>

      {selectedCycle?.status === 'closed' && (
        <p className="banner banner-warn mt-sm" role="status">
          <Icon name="lock" size={18} />
          {selectedCycle.label} is closed, so it is read-only.{' '}
          {isAdmin ? <Link to="/group-settings" className="link-btn">Reopen in Group settings</Link> : 'Ask an admin to reopen it.'}
        </p>
      )}

      {message && (
        <p className={clsx('banner mt-sm', message.kind === 'ok' ? 'banner-ok' : 'banner-error')} role={message.kind === 'ok' ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}

      {loading ? (
        <div className="center-spinner"><Spinner /></div>
      ) : tab === 'members' ? (
        <div className="mt-md">
          <MemberBreakdown balances={balances} expenses={expenses} currency={currency} currentUserId={user?.id} />
        </div>
      ) : (
        <>
          <Card className="mt-md">
            <div className="stats-grid">
              <div><p className="stat-label">{filtersActive ? 'Matching' : 'Expenses'}</p><p className="stat-value">{visible.length}</p></div>
              <div><p className="stat-label">Total</p><p className="stat-value">{formatMoney(total, currency)}</p></div>
              <div><p className="stat-label">Members</p><p className="stat-value">{members.length}</p></div>
            </div>
          </Card>

          <div className="search-field mt-md">
            <Icon name="search" size={18} />
            <input
              className="input search-input" placeholder="Search expenses…" aria-label="Search expenses"
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="filter-bar">
            <select className="pill-select" aria-label="Filter by category" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
            <select className="pill-select" aria-label="Filter by who paid" value={payerId} onChange={e => setPayerId(e.target.value)}>
              <option value="">Anyone paid</option>
              {members.map(m => <option key={m.user_id} value={m.user_id}>{m.profile?.name}</option>)}
            </select>
            <button className={clsx('pill-select pill-toggle', onlyMine && 'active')} onClick={() => setOnlyMine(v => !v)} aria-pressed={onlyMine}>
              {onlyMine && <Icon name="check" size={14} strokeWidth={2.4} />}Added by me
            </button>
          </div>

          <div className="stack-sm mt-md">
            {visible.length === 0 ? (
              <EmptyState
                title={filtersActive ? 'No expenses match' : 'No expenses yet'}
                body={filtersActive ? 'Try clearing a filter.' : 'Add the first one with the + button.'}
              />
            ) : (
              visible.map(e => {
                const closed = cycleById.get(e.monthly_cycle_id)?.status === 'closed'
                const decision = canManageExpense({ expense: e, userId: user?.id, role, cycleClosed: closed })
                return (
                  <ExpenseManageCard
                    key={e.id}
                    expense={e}
                    currency={currency}
                    expanded={expandedId === e.id}
                    onToggle={() => setExpandedId(expandedId === e.id ? null : e.id)}
                    canManage={decision.allowed}
                    lockedReason={decision.reason}
                    isMine={e.created_by === user?.id}
                    busy={busyId === e.id}
                    onEditBreakdown={() => setEditing(e)}
                    onDelete={() => onDelete(e)}
                  />
                )
              })
            )}
          </div>
        </>
      )}

      {editing && (
        <BreakdownEditor
          expense={editing}
          members={members}
          currency={currency}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
