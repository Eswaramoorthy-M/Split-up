import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useGroup } from '@/contexts/GroupContext'
import { useAuth } from '@/contexts/AuthContext'
import { deleteExpense, listExpenses } from '@/services/expenses'
import { listCategories, listMembers } from '@/services/groups'
import type { Expense, Category, GroupMember } from '@/types'
import { ExpenseCard } from '../components/ExpenseCard'
import { ExpenseSelect, type ExpenseSelectOption } from '../components/ExpenseSelect'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { confirmDialog } from '@/components/ui/ConfirmDialog'
import { canManageExpense } from '@/lib/permissions'
import { formatMoney } from '@/lib/money'
import { guardReveal } from '@/lib/motionFallback'
import { gsap, useGSAP } from '../animation'

const ACTION_WIDTH = 144
const PAGE_SIZE = 20

type SwipeFn = (element: HTMLElement, x: number, open: boolean) => void
type RemoveFn = (element: HTMLElement, done: () => void) => void

function dateGroupLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yest = new Date(); yest.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yest)) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

interface HistoryRowProps {
  expense: Expense
  currency: string
  canManage: boolean
  canDelete: boolean
  isOpen: boolean
  deleting: boolean
  swipeRef: MutableRefObject<SwipeFn | null>
  onOpenChange: (id: string | null) => void
  onDelete: (expense: Expense) => void
}

function HistoryRow({
  expense,
  currency,
  canManage,
  canDelete,
  isOpen,
  deleting,
  swipeRef,
  onOpenChange,
  onDelete
}: HistoryRowProps) {
  const navigate = useNavigate()
  const frontRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const baseX = useRef(0)
  const active = useRef(false)
  const moved = useRef(false)

  useEffect(() => {
    if (!isOpen && frontRef.current) swipeRef.current?.(frontRef.current, 0, false)
  }, [isOpen, swipeRef])

  const moveTo = (x: number, open = false) => {
    if (frontRef.current) swipeRef.current?.(frontRef.current, x, open)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!canManage || e.pointerType === 'mouse' || e.button !== 0) return
    startX.current = e.clientX
    baseX.current = isOpen ? -ACTION_WIDTH : 0
    active.current = true
    moved.current = false
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!active.current) return
    const dx = e.clientX - startX.current
    if (!moved.current && Math.abs(dx) > 8) {
      moved.current = true
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* pointer already released */ }
    }
    if (moved.current) {
      const next = Math.min(0, Math.max(-ACTION_WIDTH, baseX.current + dx))
      moveTo(next)
    }
  }

  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!active.current) return
    active.current = false
    const dx = e.clientX - startX.current
    if (!moved.current) {
      if (isOpen) onOpenChange(null)
      return
    }
    const shouldOpen = dx < -ACTION_WIDTH / 2 || (baseX.current < -ACTION_WIDTH / 2 && dx > ACTION_WIDTH / 3)
    moveTo(shouldOpen ? -ACTION_WIDTH : 0, shouldOpen)
    onOpenChange(shouldOpen ? expense.id : null)
    window.setTimeout(() => { moved.current = false }, 0)
  }

  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.closest('.expense-row-actions, .expense-quick-actions')) return
    if (moved.current || isOpen) {
      e.preventDefault()
      e.stopPropagation()
      if (isOpen) onOpenChange(null)
      moved.current = false
    }
  }

  const quickActions = canManage && (
    <span className="expense-quick-actions" aria-label="Quick actions">
      <button
        type="button"
        className="expense-icon-btn"
        title={`Edit ${expense.description}`}
        aria-label={`Edit ${expense.description}`}
        onClick={() => navigate(`/expenses/${expense.id}/edit`)}
      >
        <Icon name="edit" size={17} />
      </button>
      {canDelete && (
        <button
          type="button"
          className="expense-icon-btn expense-icon-btn--danger"
          title={`Delete ${expense.description}`}
          aria-label={`Delete ${expense.description}`}
          onClick={() => onDelete(expense)}
          disabled={deleting}
        >
          <Icon name="trash" size={17} />
        </button>
      )}
    </span>
  )

  return (
    <div
      className="expense-row-shell"
      data-history-row
      data-row-id={expense.id}
      onClickCapture={onClickCapture}
    >
      {canManage && (
        <div className="expense-row-actions" aria-label={`Actions for ${expense.description}`}>
          <button
            type="button"
            className="expense-row-action"
            onClick={() => navigate(`/expenses/${expense.id}/edit`)}
          >
            <Icon name="edit" size={17} />Edit
          </button>
          {canDelete && (
            <button
              type="button"
              className="expense-row-action expense-row-action--delete"
              onClick={() => onDelete(expense)}
              disabled={deleting}
            >
              <Icon name="trash" size={17} />Delete
            </button>
          )}
        </div>
      )}

      <div
        className="expense-row-front"
        ref={frontRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <ExpenseCard expense={expense} currency={currency} premium />
        <span className="expense-sr-only" aria-live="polite">
          {isOpen ? `Actions open for ${expense.description}.` : ''}
        </span>
        {quickActions}
      </div>
    </div>
  )
}

function HistorySkeleton() {
  return (
    <div className="history-skeleton" aria-busy="true" aria-label="Loading expenses">
      <div className="expense-skeleton-card">
        <span className="expense-skeleton-line expense-skeleton-line--lg"><i className="expense-skeleton-shimmer" data-shimmer /></span>
        <span className="expense-skeleton-line expense-skeleton-line--sm mt-sm"><i className="expense-skeleton-shimmer" data-shimmer /></span>
      </div>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="expense-skeleton-card">
          <div className="expense-skeleton-row">
            <span className="expense-skeleton-avatar"><i className="expense-skeleton-shimmer" data-shimmer /></span>
            <span className="expense-skeleton-line expense-skeleton-line--lg"><i className="expense-skeleton-shimmer" data-shimmer /></span>
            <span className="expense-skeleton-pill"><i className="expense-skeleton-shimmer" data-shimmer /></span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ExpenseHistory() {
  const { activeGroup, activeMembership } = useGroup()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [members, setMembers] = useState<GroupMember[]>([])
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [page, setPage] = useState(0)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // UI-only state: none of it changes what is fetched from Supabase.
  const [dataVersion, setDataVersion] = useState(0)
  const [openRowId, setOpenRowId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const swipeRef = useRef<SwipeFn | null>(null)
  const removeRef = useRef<RemoveFn | null>(null)
  const bannerOutRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!activeGroup) return
    listCategories(activeGroup.id).then(setCategories)
    listMembers(activeGroup.id).then(setMembers)
  }, [activeGroup])

  useEffect(() => {
    if (!activeGroup) return
    setLoading(true)
    listExpenses(activeGroup.id, {
      page,
      categoryId: categoryId || undefined,
      memberId: memberId || undefined,
      search: search || undefined
    }).then(({ data, count }) => {
      setExpenses(data)
      setCount(count)
      setLoading(false)
      setDataVersion(v => v + 1)
    })
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

  // One scoped animation API per page instance. Pointer handlers and async
  // delete callbacks call these; no tween is created outside useGSAP.
  useGSAP(() => {
    const root = rootRef.current
    if (!root) return
    const mm = gsap.matchMedia()

    swipeRef.current = (el, x) => gsap.set(el, { x })
    removeRef.current = (_el, done) => done()

    mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, context => {
      if (!context.conditions?.motion) return
      swipeRef.current = (el, x, open) => gsap.to(el, {
        x,
        duration: open ? 0.32 : 0.24,
        ease: open ? 'power3.out' : 'back.out(1.4)',
        overwrite: 'auto'
      })
      removeRef.current = (el, done) => gsap.to(el, {
        height: 0,
        opacity: 0,
        x: -12,
        duration: 0.34,
        ease: 'power2.in',
        overwrite: 'auto',
        onComplete: done
      })
      return () => {
        swipeRef.current = (el, x) => gsap.set(el, { x })
        removeRef.current = (_el, done) => done()
      }
    })

    return () => mm.revert()
  }, { scope: rootRef, dependencies: [] })

  // Skeleton shimmer.
  useGSAP(() => {
    const root = rootRef.current
    if (!root || !loading) return
    const mm = gsap.matchMedia()
    mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, context => {
      const shimmers = gsap.utils.toArray<HTMLElement>('[data-shimmer]', root)
      if (!context.conditions?.motion) {
        gsap.set(shimmers, { opacity: 0.45, xPercent: 0 })
        return
      }
      shimmers.forEach((shimmer, index) => {
        gsap.fromTo(shimmer,
          { xPercent: -35, opacity: 0.35 },
          {
            xPercent: 35,
            opacity: 0.8,
            duration: 1.15,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            delay: index * 0.03
          }
        )
      })
    })
    return () => mm.revert()
  }, { scope: rootRef, dependencies: [loading], revertOnUpdate: true })

  // Entrance: only on first data load, filter change or page change.
  useGSAP(() => {
    const root = rootRef.current
    if (!root || loading || expenses.length === 0) return
    const mm = gsap.matchMedia()
    mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, context => {
      const targets = [
        ...Array.from(root.querySelectorAll<HTMLElement>('.expense-date-head')),
        ...Array.from(root.querySelectorAll<HTMLElement>('[data-history-row]')).slice(0, 12)
      ]
      if (!targets.length) return
      if (!context.conditions?.motion) {
        gsap.set(targets, { opacity: 1, y: 0 })
        return
      }
      gsap.fromTo(targets,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.04, ease: 'power3.out', overwrite: 'auto' }
      )
    })
    return () => mm.revert()
  }, { scope: rootRef, dependencies: [loading, dataVersion], revertOnUpdate: true })

  // The list must never stay hidden if GSAP's first frame is missed.
  useEffect(() => {
    const root = rootRef.current
    if (!root || loading || !expenses.length) return
    const revealTargets = () => [
      ...Array.from(root.querySelectorAll<HTMLElement>('.expense-date-head')),
      ...Array.from(root.querySelectorAll<HTMLElement>('[data-history-row]')).slice(0, 12)
    ]

    return guardReveal(revealTargets, () => {
      const targets = revealTargets()
      gsap.killTweensOf(targets)
      gsap.set(targets, { opacity: 1, y: 0 })
    }, 3000)
  }, [loading, dataVersion, expenses.length])

  // Desktop hover lift; listeners are removed by the scoped context.
  useGSAP(() => {
    const root = rootRef.current
    if (!root) return
    const mm = gsap.matchMedia()
    mm.add({
      motion: '(prefers-reduced-motion: no-preference)',
      hover: '(hover: hover) and (min-width: 1024px)'
    }, context => {
      const { motion, hover } = context.conditions ?? {}
      if (!motion || !hover) return
      const cleanups: Array<() => void> = []
      gsap.utils.toArray<HTMLElement>('[data-history-row]', root).forEach(row => {
        const card = row.querySelector<HTMLElement>('.expense-card-premium')
        if (!card) return
        const enter = () => gsap.to(card, { y: -3, duration: 0.22, ease: 'power2.out', overwrite: 'auto' })
        const leave = () => gsap.to(card, { y: 0, duration: 0.26, ease: 'power2.out', overwrite: 'auto' })
        row.addEventListener('mouseenter', enter)
        row.addEventListener('mouseleave', leave)
        cleanups.push(() => {
          row.removeEventListener('mouseenter', enter)
          row.removeEventListener('mouseleave', leave)
        })
      })
      return () => cleanups.forEach(off => off())
    })
    return () => mm.revert()
  }, { scope: rootRef, dependencies: [dataVersion, loading] })

  // Error banner height + opacity animation, including a smooth dismiss.
  useGSAP(() => {
    const root = rootRef.current
    const banner = root?.querySelector<HTMLElement>('[data-history-banner]')
    if (!root || !banner) return
    const mm = gsap.matchMedia()
    mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, context => {
      const motion = context.conditions?.motion
      bannerOutRef.current = () => {
        if (!motion) { setError(null); return }
        gsap.to(banner, { height: 0, opacity: 0, duration: 0.24, ease: 'power2.in', onComplete: () => setError(null) })
      }
      if (motion) {
        gsap.fromTo(banner, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.3, ease: 'power2.out' })
      }
      return () => { bannerOutRef.current = null }
    })
    return () => mm.revert()
  }, { scope: rootRef, dependencies: [error], revertOnUpdate: true })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      if (e.key === '/' && !typing && !document.querySelector('.modal-overlay')) {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setOpenRowId(null)
        if (document.activeElement === searchRef.current) searchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onDelete = async (expense: Expense) => {
    const confirmed = await confirmDialog({
      title: 'Delete this expense?',
      message: 'Everyone’s balances will be recalculated. This cannot be undone.',
      confirmLabel: 'Delete expense',
      tone: 'danger'
    })
    if (!confirmed) return

    setError(null)
    setDeletingId(expense.id)
    try {
      await deleteExpense(expense.id)
      const row = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-row-id]') ?? [])
        .find(el => el.dataset.rowId === expense.id)
      await new Promise<void>(resolve => {
        if (row && removeRef.current) removeRef.current(row, resolve)
        else resolve()
      })
      setExpenses(prev => prev.filter(e => e.id !== expense.id))
      setCount(c => Math.max(0, c - 1))
      setOpenRowId(null)
    } catch (err: any) {
      setError(err.message ?? 'Unable to delete this expense. Try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const currency = activeGroup?.currency ?? 'INR'
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  const categoryOptions: ExpenseSelectOption[] = useMemo(() => [
    { value: '', label: 'All categories' },
    ...categories.map(c => ({ value: c.id, label: c.name, icon: c.icon }))
  ], [categories])
  const memberOptions: ExpenseSelectOption[] = useMemo(() => [
    { value: '', label: 'Everyone' },
    ...members.map(m => ({ value: m.user_id, label: m.profile?.name ?? 'Member' }))
  ], [members])

  return (
    <div className="expenses-page expense-history-page" ref={rootRef}>
      <div className="history-toolbar">
        <div className="history-head">
          <div>
            <h1 className="history-title">Expenses</h1>
            <p className="history-subtitle">{count} {count === 1 ? 'expense' : 'expenses'} in this group</p>
          </div>
          <Link to="/manage" className="history-manage">
            <Icon name="sliders" size={16} />Manage
          </Link>
        </div>

        <div className="history-search">
          <Icon name="search" size={18} />
          <input
            ref={searchRef}
            className="input search-input"
            placeholder="Search expenses…"
            aria-label="Search expenses"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
          />
          <span className="history-shortcut" aria-hidden="true">/</span>
        </div>

        <div className="history-filters" role="group" aria-label="Expense filters">
          <ExpenseSelect
            className={clsx('history-filter', categoryId && 'active')}
            icon="tag"
            label="Filter by category"
            options={categoryOptions}
            value={categoryId}
            onChange={value => { setCategoryId(value); setPage(0) }}
          />
          <ExpenseSelect
            className={clsx('history-filter', memberId && 'active')}
            icon="user"
            label="Filter by member"
            options={memberOptions}
            value={memberId}
            onChange={value => { setMemberId(value); setPage(0) }}
          />
        </div>
      </div>

      <div className="history-body">
        {error && (
          <div className="expense-banner-wrap" data-history-banner>
            <p className="banner banner-error" role="alert">
              <Icon name="alert" size={18} />
              <span className="flex-1">{error}</span>
              <button
                type="button"
                aria-label="Dismiss error"
                title="Dismiss"
                onClick={() => { if (bannerOutRef.current) bannerOutRef.current(); else setError(null) }}
              >
                <Icon name="x" size={16} />
              </button>
            </p>
          </div>
        )}

        {loading ? (
          <HistorySkeleton />
        ) : expenses.length === 0 ? (
          <div className="expense-empty-wrap">
            <span className="expense-empty-illustration" aria-hidden="true"><Icon name="receipt" size={34} /></span>
            <EmptyState
              title="Nothing here yet"
              body={search || categoryId || memberId
                ? 'No expenses match these filters. Try clearing one.'
                : 'Add your first expense and it will show up right here.'}
              action={<Link to="/expenses/new" className="btn btn-primary"><Icon name="plus" size={17} />Add expense</Link>}
            />
          </div>
        ) : (
          <>
            <div className="expense-table-head" aria-hidden="true">
              <span />
              <span>Description</span>
              <span>Paid by</span>
              <span>Date</span>
              <span>Amount</span>
              <span />
            </div>
            {grouped.map(([label, items]) => (
              <div key={label} className="history-group">
                <p className="expense-date-head">
                  <span>{label}</span>
                  <span className="expense-date-total">{formatMoney(items.reduce((sum, item) => sum + item.amount, 0), currency)}</span>
                </p>
                {items.map(expense => {
                  const decision = canManageExpense({
                    expense,
                    userId: user?.id,
                    role: activeMembership?.role,
                    cycleClosed: expense.cycle?.status === 'closed'
                  })
                  return (
                    <HistoryRow
                      key={expense.id}
                      expense={expense}
                      currency={currency}
                      canManage={decision.allowed}
                      canDelete={decision.allowed}
                      isOpen={openRowId === expense.id}
                      deleting={deletingId === expense.id}
                      swipeRef={swipeRef}
                      onOpenChange={setOpenRowId}
                      onDelete={onDelete}
                    />
                  )
                })}
              </div>
            ))}
          </>
        )}
      </div>

      {!loading && count > PAGE_SIZE && (
        <nav className="expense-pager" aria-label="Expense pages">
          <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <Icon name="chevronLeft" size={16} />Previous
          </button>
          <span>Page {page + 1} of {totalPages}</span>
          <button type="button" disabled={(page + 1) * PAGE_SIZE >= count} onClick={() => setPage(p => p + 1)}>
            Next<Icon name="chevronRight" size={16} />
          </button>
        </nav>
      )}
    </div>
  )
}
