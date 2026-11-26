import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useGroup } from '@/contexts/GroupContext'
import { getExpense, deleteExpense } from '@/services/expenses'
import type { Expense } from '@/types'
import { canManageExpense } from '@/lib/permissions'
import { formatMoney } from '@/lib/money'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { shareExpense } from '@/services/sharing'
import { EmptyState } from '@/components/ui/EmptyState'
import { CategoryTile, Icon } from '@/components/ui/Icon'
import { confirmDialog } from '@/components/ui/ConfirmDialog'
import { guardReveal } from '@/lib/motionFallback'
import { gsap, useGSAP } from '../animation'

function settleAmount(root: HTMLElement, currency: string) {
  root.querySelectorAll<HTMLElement>('[data-details-amount]').forEach(element => {
    element.textContent = formatMoney(Number(element.dataset.detailsAmountValue ?? 0), currency)
  })
}

function settleBars(root: HTMLElement) {
  gsap.set(gsap.utils.toArray<HTMLElement>('[data-details-share-bar]', root), {
    scaleX: 1,
    transformOrigin: 'left center'
  })
}

function DetailsSkeleton() {
  return (
    <div className="details-skeleton" aria-busy="true" aria-label="Loading expense">
      <div className="expense-skeleton-card">
        <span className="expense-skeleton-line expense-skeleton-line--sm"><i className="expense-skeleton-shimmer" data-shimmer /></span>
        <span className="expense-skeleton-line expense-skeleton-line--lg mt-sm"><i className="expense-skeleton-shimmer" data-shimmer /></span>
        <span className="expense-skeleton-line expense-skeleton-line--amount"><i className="expense-skeleton-shimmer" data-shimmer /></span>
      </div>
      <div className="expense-skeleton-card">
        {[0, 1, 2].map(i => (
          <div key={i} className="expense-skeleton-row">
            <span className="expense-skeleton-avatar"><i className="expense-skeleton-shimmer" data-shimmer /></span>
            <span className="expense-skeleton-line expense-skeleton-line--lg"><i className="expense-skeleton-shimmer" data-shimmer /></span>
            <span className="expense-skeleton-pill"><i className="expense-skeleton-shimmer" data-shimmer /></span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ExpenseDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { activeGroup, activeMembership } = useGroup()

  const [expense, setExpense] = useState<Expense | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  const exitRef = useRef<(() => void) | null>(null)

  const currency = activeGroup?.currency ?? 'INR'
  const decision = expense
    ? canManageExpense({
      expense,
      userId: user?.id,
      role: activeMembership?.role,
      cycleClosed: expense.cycle?.status === 'closed'
    })
    : { allowed: false }
  const canManage = decision.allowed

  useEffect(() => {
    if (!id) return
    getExpense(id)
      .then(e => { setExpense(e); setLoading(false) })
      .catch(err => { setError(err.message ?? 'Unable to load this expense.'); setLoading(false) })
  }, [id])

  const goBack = useCallback(() => {
    if (exitRef.current) exitRef.current()
    else navigate('/expenses')
  }, [navigate])

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
          { xPercent: 35, opacity: 0.8, duration: 1.15, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: index * 0.03 }
        )
      })
    })
    return () => mm.revert()
  }, { scope: rootRef, dependencies: [loading], revertOnUpdate: true })

  // Hero timeline, count-up and split bars. Runs once the expense first loads.
  useGSAP(() => {
    const root = rootRef.current
    if (!root || loading || !expense) return
    const mm = gsap.matchMedia()
    mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, context => {
      const motion = context.conditions?.motion
      const tile = root.querySelector<HTMLElement>('[data-details-tile]')
      const title = root.querySelector<HTMLElement>('[data-details-title]')
      const amount = root.querySelector<HTMLElement>('[data-details-amount]')
      const chips = gsap.utils.toArray<HTMLElement>('[data-details-chip]', root)
      const rows = gsap.utils.toArray<HTMLElement>('[data-details-split-row]', root)
      const bars = gsap.utils.toArray<HTMLElement>('[data-details-share-bar]', root)

      if (!motion) {
        settleAmount(root, currency)
        settleBars(root)
        gsap.set([tile, title, amount, ...chips, ...rows].filter(Boolean), { opacity: 1, y: 0, scale: 1 })
        return
      }

      gsap.set([title, amount, ...chips, ...rows].filter(Boolean), { opacity: 0, y: 14 })
      gsap.set(bars, { scaleX: 0, transformOrigin: 'left center' })

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      if (tile) tl.fromTo(tile, { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }, 0)
      if (title) tl.to(title, { opacity: 1, y: 0, duration: 0.45 }, 0.16)
      if (amount) {
        tl.to(amount, { opacity: 1, y: 0, duration: 0.45 }, 0.24)
        const proxy = { value: 0 }
        amount.textContent = formatMoney(0, currency)
        tl.to(proxy, {
          value: expense.amount,
          duration: 1,
          ease: 'power3.out',
          onUpdate: () => { amount.textContent = formatMoney(proxy.value, currency) },
          onComplete: () => { amount.textContent = formatMoney(expense.amount, currency) }
        }, 0.3)
      }
      if (chips.length) tl.to(chips, { opacity: 1, y: 0, duration: 0.4, stagger: 0.06 }, 0.38)
      if (rows.length) tl.to(rows, { opacity: 1, y: 0, duration: 0.45, stagger: 0.06 }, 0.46)
      if (bars.length) tl.to(bars, { scaleX: 1, duration: 0.6, stagger: 0.06, ease: 'power2.out' }, 0.58)

      return () => {
        settleAmount(root, currency)
        settleBars(root)
      }
    })
    return () => mm.revert()
  }, { scope: rootRef, dependencies: [expense?.id, loading], revertOnUpdate: true })

  // If the hero intro never starts, settle it to the loaded state.
  useEffect(() => {
    const root = rootRef.current
    if (!root || loading || !expense) return
    const revealTargets = () => [
      root.querySelector<HTMLElement>('[data-details-tile]'),
      root.querySelector<HTMLElement>('[data-details-title]'),
      root.querySelector<HTMLElement>('[data-details-amount]'),
      ...gsap.utils.toArray<HTMLElement>('[data-details-chip]', root),
      ...gsap.utils.toArray<HTMLElement>('[data-details-split-row]', root)
    ].filter(Boolean) as HTMLElement[]

    return guardReveal(revealTargets, () => {
      const targets = revealTargets()
      gsap.killTweensOf(targets)
      gsap.set(targets, { opacity: 1, x: 0, y: 0, scale: 1 })
      settleAmount(root, currency)
      settleBars(root)
    }, 3000)
  }, [expense?.id, loading, currency])

  // Banners animate open/closed with height + opacity instead of popping.
  useGSAP(() => {
    const root = rootRef.current
    if (!root) return
    const banners = gsap.utils.toArray<HTMLElement>('[data-details-banner]', root)
    if (!banners.length) return
    const mm = gsap.matchMedia()
    mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, context => {
      if (!context.conditions?.motion) return
      banners.forEach(banner => {
        gsap.fromTo(banner, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.3, ease: 'power2.out' })
      })
    })
    return () => mm.revert()
  }, { scope: rootRef, dependencies: [error, decision.reason, loading], revertOnUpdate: true })

  // Back direction is reversed relative to the forward page transition.
  useGSAP(() => {
    const root = rootRef.current
    if (!root) return
    const mm = gsap.matchMedia()
    exitRef.current = () => navigate('/expenses')
    mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, context => {
      if (!context.conditions?.motion) return
      exitRef.current = () => {
        gsap.to(root, {
          opacity: 0,
          x: 24,
          duration: 0.22,
          ease: 'power2.in',
          overwrite: 'auto',
          onComplete: () => navigate('/expenses')
        })
      }
    })
    return () => {
      exitRef.current = null
      mm.revert()
    }
  }, { scope: rootRef, dependencies: [goBack] })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.modal-overlay')) goBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goBack])

  const onDelete = async () => {
    if (!expense) return
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

  const onShare = () => {
    if (expense) shareExpense(expense, currency)
  }

  const participants = expense?.participants ?? []
  const largestShare = Math.max(...participants.map(p => p.amount), 0.01)

  return (
    <div className="expenses-page expense-details-page" ref={rootRef}>
      {loading ? (
        <DetailsSkeleton />
      ) : !expense ? (
        <div role="alert"><EmptyState title="Expense not found" body={error ?? undefined} /></div>
      ) : (
        <>
          <div className="details-layout">
            <div className="details-left">
              <header className="details-hero">
                <div className="details-hero-top">
                  <button type="button" className="expense-back" onClick={goBack} aria-label="Back to expenses" title="Back to expenses">
                    <Icon name="arrowLeft" size={19} />
                  </button>
                  <div className="details-toolbar" role="toolbar" aria-label="Expense actions">
                    <button type="button" className="expense-icon-btn" onClick={onShare} aria-label="Share expense" title="Share expense">
                      <Icon name="share" size={18} />
                    </button>
                    {canManage && (
                      <Link
                        to={`/expenses/${expense.id}/edit`}
                        className="expense-icon-btn"
                        aria-label="Edit expense"
                        title="Edit expense"
                      >
                        <Icon name="edit" size={18} />
                      </Link>
                    )}
                    {canManage && (
                      <button
                        type="button"
                        className="expense-icon-btn expense-icon-btn--danger"
                        onClick={onDelete}
                        disabled={deleting}
                        aria-label="Delete expense"
                        title="Delete expense"
                      >
                        <Icon name="trash" size={18} />
                      </button>
                    )}
                  </div>
                </div>

                <span className="details-category" data-details-tile>
                  <CategoryTile icon={expense.category?.icon} size="lg" />
                </span>
                <h1 className="details-title" data-details-title>{expense.description}</h1>
                <p className="details-amount">
                  <span data-details-amount data-details-amount-value={expense.amount}>
                    {formatMoney(expense.amount, currency)}
                  </span>
                </p>
                <div className="details-chips">
                  <span className="details-chip" data-details-chip>
                    <Icon name="calendar" size={15} />
                    {new Date(expense.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="details-chip" data-details-chip>
                    <Icon name="user" size={15} />Paid by {expense.paid_by?.name ?? 'a member'}
                  </span>
                  <span className="details-chip" data-details-chip>
                    <Icon name="users" size={15} />{participants.length} {participants.length === 1 ? 'member' : 'members'}
                  </span>
                </div>
              </header>

              {!canManage && decision.reason && (
                <div className="expense-banner-wrap" data-details-banner>
                  <p className="banner banner-warn" role="status">
                    <Icon name="lock" size={18} />{decision.reason}
                  </p>
                </div>
              )}
              {error && (
                <div className="expense-banner-wrap" data-details-banner>
                  <p className="banner banner-error" role="alert">
                    <Icon name="alert" size={18} />{error}
                  </p>
                </div>
              )}
            </div>

            <div className="details-right">
              <Card className="details-split-card">
                <div className="details-split-head">
                  <h2 className="section-title">Split breakdown</h2>
                  <span className="split-method-badge">{expense.participants?.[0]?.split_type ?? 'equal'}</span>
                </div>
                <div className="detail-list">
                  {participants.map(p => {
                    const percent = p.percentage ?? (expense.amount > 0 ? (p.amount / expense.amount) * 100 : 0)
                    return (
                      <div key={p.id} className="detail-line" data-details-split-row>
                        <span className="avatar avatar-xs details-avatar" aria-hidden="true">
                          {p.profile?.name?.[0]?.toUpperCase()}
                        </span>
                        <span className="details-split-name">{p.profile?.name}</span>
                        <span className="details-split-amount tabular">
                          {formatMoney(p.amount, currency)}{percent ? ` · ${Number(percent.toFixed(2))}%` : ''}
                        </span>
                        <span className="details-split-bar" aria-hidden="true">
                          <span
                            className="details-split-fill"
                            data-details-share-bar
                            style={{ width: `${(p.amount / largestShare) * 100}%` }}
                          />
                        </span>
                      </div>
                    )
                  })}
                </div>
              </Card>

              {expense.notes && (
                <Card className="details-note-card">
                  <p className="card-label mb-sm"><Icon name="message" size={15} /> Notes</p>
                  <p>{expense.notes}</p>
                </Card>
              )}

              {expense.receipt_path && (
                <Card>
                  <p className="card-label mb-sm">Receipt</p>
                  <div className="row">
                    <span className="details-receipt-icon"><Icon name="image" size={19} /></span>
                    <span className="details-receipt-path">Stored at {expense.receipt_path}</span>
                  </div>
                </Card>
              )}

              <p className="details-audit">
                Added by {expense.creator?.name ?? 'a member'} on {new Date(expense.created_at).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <div className="expense-sticky-actions expense-sticky-actions--three">
            <button type="button" className="expense-icon-btn" onClick={onShare} aria-label="Share expense" title="Share expense">
              <Icon name="share" size={18} />
            </button>
            {canManage ? (
              <>
                <Link to={`/expenses/${expense.id}/edit`} className="btn btn-secondary">
                  <Icon name="edit" size={17} />Edit
                </Link>
                <Button variant="danger" onClick={onDelete} disabled={deleting}>
                  <Icon name="trash" size={17} />{deleting ? 'Deleting…' : 'Delete'}
                </Button>
              </>
            ) : (
              <span className="details-audit flex-1 text-center">
                {decision.reason ?? 'This expense is read-only.'}
              </span>
            )}
          </div>
        </>
      )}
      <span className="expense-sr-only" aria-live="polite">{deleting ? 'Deleting expense' : ''}</span>
    </div>
  )
}
