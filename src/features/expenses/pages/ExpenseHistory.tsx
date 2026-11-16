import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGroup } from '@/contexts/GroupContext'
import { listExpenses } from '@/services/expenses'
import { listCategories, listMembers } from '@/services/groups'
import type { Expense, Category, GroupMember } from '@/types'
import { ExpenseCard } from '../components/ExpenseCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { Icon } from '@/components/ui/Icon'

function dateGroupLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yest = new Date(); yest.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yest)) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function ExpenseHistory() {
  const { activeGroup } = useGroup()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [members, setMembers] = useState<GroupMember[]>([])
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [page, setPage] = useState(0)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activeGroup) return
    listCategories(activeGroup.id).then(setCategories)
    listMembers(activeGroup.id).then(setMembers)
  }, [activeGroup])

  useEffect(() => {
    if (!activeGroup) return
    setLoading(true)
    listExpenses(activeGroup.id, { page, categoryId: categoryId || undefined, memberId: memberId || undefined, search: search || undefined })
      .then(({ data, count }) => { setExpenses(data); setCount(count); setLoading(false) })
  }, [activeGroup, page, categoryId, memberId, search])

  const grouped = useMemo(() => {
    const map = new Map<string, Expense[]>()
    for (const e of expenses) {
      const label = dateGroupLabel(e.expense_date)
      if (!map.has(label)) map.set(label, [])
      map.get(label)!.push(e)
    }
    return Array.from(map.entries())
  }, [expenses])

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Expenses</h1>
        <Link to="/manage" className="link-btn"><Icon name="sliders" size={16} />Manage all</Link>
      </div>

      <div className="search-field mt-md">
        <Icon name="search" size={18} />
        <input
          className="input search-input" placeholder="Search expenses…" aria-label="Search expenses"
          value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
        />
      </div>

      <div className="filter-bar">
        <select className="pill-select" aria-label="Filter by category" value={categoryId} onChange={e => { setCategoryId(e.target.value); setPage(0) }}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <select className="pill-select" aria-label="Filter by member" value={memberId} onChange={e => { setMemberId(e.target.value); setPage(0) }}>
          <option value="">Everyone</option>
          {members.map(m => <option key={m.user_id} value={m.user_id}>{m.profile?.name}</option>)}
        </select>
      </div>

      <div className="stack mt-lg">
        {loading ? (
          <div className="center-spinner"><Spinner /></div>
        ) : expenses.length === 0 ? (
          <EmptyState title="No expenses yet" body="Add your first expense with the + button." />
        ) : (
          grouped.map(([label, items]) => (
            <div key={label}>
              <p className="date-group-label">{label}</p>
              <div className="stack-sm">
                {items.map(e => <ExpenseCard key={e.id} expense={e} currency={activeGroup?.currency ?? 'INR'} />)}
              </div>
            </div>
          ))
        )}
      </div>

      {count > 20 && (
        <div className="pager">
          <button className="link-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}><Icon name="chevronLeft" size={16} />Previous</button>
          <span className="muted">Page {page + 1} of {Math.ceil(count / 20)}</span>
          <button className="link-btn" disabled={(page + 1) * 20 >= count} onClick={() => setPage(p => p + 1)}>Next<Icon name="chevronRight" size={16} /></button>
        </div>
      )}
    </div>
  )
}
