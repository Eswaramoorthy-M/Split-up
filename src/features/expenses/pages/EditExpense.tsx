import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { useGroup } from '@/contexts/GroupContext'
import { useAuth } from '@/contexts/AuthContext'
import { listMembers, listCategories } from '@/services/groups'
import { getExpense, updateExpense, ParticipantInput } from '@/services/expenses'
import type { GroupMember, Category, SplitType, Expense } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { MemberSelector } from '../components/MemberSelector'
import { SplitEditor } from '../components/SplitEditor'
import { ExpenseSelect, type ExpenseSelectOption } from '../components/ExpenseSelect'
import { CategoryTile, Icon } from '@/components/ui/Icon'
import { confirmDialog } from '@/components/ui/ConfirmDialog'
import { withHistoricalParticipants } from '@/lib/members'
import { currencySymbol, formatMoney, sameMoney, sumMoney } from '@/lib/money'
import { guardReveal } from '@/lib/motionFallback'
import { gsap, useGSAP } from '../animation'
import { formatSplitProxy } from '../splitMotion'
import { useFormKeyboardFocus } from '../useFormKeyboardFocus'

type SavePhase = 'idle' | 'saving' | 'success' | 'error'

interface FormSnapshot {
  amount: string
  description: string
  categoryId: string
  paidBy: string
  date: string
  participantIds: string[]
  splitType: SplitType
  splitValues: ParticipantInput[]
  notes: string
}

function snapshotOf(fields: FormSnapshot): string {
  return JSON.stringify(fields)
}

function EditSkeleton() {
  return (
    <div className="edit-skeleton" aria-busy="true" aria-label="Loading expense editor">
      <div className="expense-skeleton-card">
        <span className="expense-skeleton-line expense-skeleton-line--lg"><i className="expense-skeleton-shimmer" data-shimmer /></span>
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

export default function EditExpense() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { activeGroup, activeMembership } = useGroup()
  const { user } = useAuth()

  const [expense, setExpense] = useState<Expense | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [date, setDate] = useState('')
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [splitType, setSplitType] = useState<SplitType>('equal')
  const [splitValues, setSplitValues] = useState<ParticipantInput[]>([])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // UI-only: inline errors, animated save states and the dirty guard.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [errorField, setErrorField] = useState<string | null>(null)
  const [errorSeq, setErrorSeq] = useState(0)
  const [savePhase, setSavePhase] = useState<SavePhase>('idle')

  const rootRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLInputElement>(null)
  const initialRef = useRef<string | null>(null)
  const exitRef = useRef<((target: string) => void) | null>(null)
  const splitProxyRef = useRef({ value: 0 })
  const previousBarPercentRef = useRef(0)
  const bannerOutRef = useRef<(() => void) | null>(null)
  const navigateTimerRef = useRef<number | null>(null)
  const errorTimerRef = useRef<number | null>(null)

  useFormKeyboardFocus()

  const currency = activeGroup?.currency ?? 'INR'
  const detailsPath = expense?.id ? `/expenses/${expense.id}` : '/expenses'
  const mayEdit = Boolean(expense && (activeMembership?.role === 'admin' || expense.created_by === user?.id))

  const selectedMembers = useMemo(
    () => members.filter(m => participantIds.includes(m.user_id)),
    [members, participantIds]
  )
  const numAmount = parseFloat(amount) || 0

  const categoryOptions: ExpenseSelectOption[] = useMemo(() => [
    { value: '', label: 'Uncategorised' },
    ...categories.map(c => ({ value: c.id, label: c.name, icon: c.icon }))
  ], [categories])
  const paidByOptions: ExpenseSelectOption[] = useMemo(
    () => members.map(m => ({ value: m.user_id, label: m.profile?.name ?? 'Member' })),
    [members]
  )

  const currentSnapshot = snapshotOf({
    amount, description, categoryId, paidBy, date, participantIds, splitType, splitValues, notes
  })
  const dirty = initialRef.current !== null && currentSnapshot !== initialRef.current

  const splitSumAmount = sumMoney(splitValues.map(v => v.amount || 0))
  const splitSumPct = splitValues.reduce((s, v) => s + (v.percentage || 0), 0)
  const splitOk = splitType === 'percentage'
    ? Math.abs(splitSumPct - 100) <= 0.01
    : sameMoney(splitSumAmount, numAmount)
  const splitDifference = splitType === 'percentage'
    ? +(100 - splitSumPct).toFixed(2)
    : splitType === 'unequal'
      ? Math.round(numAmount * 100) - Math.round(splitSumAmount * 100)
      : 0
  const splitSignature = [
    splitType,
    numAmount,
    splitDifference,
    splitValues.map(v => `${v.user_id}:${v.amount}:${v.percentage ?? ''}`).join(',')
  ].join('|')

  const leave = useCallback(async (target: string) => {
    if (dirty) {
      const confirmed = await confirmDialog({
        title: 'Discard changes?',
        message: 'Your edits to this expense have not been saved.',
        confirmLabel: 'Discard changes',
        tone: 'danger'
      })
      if (!confirmed) return
    }
    if (exitRef.current) exitRef.current(target)
    else navigate(target)
  }, [dirty, navigate])

  useEffect(() => {
    if (!activeGroup || !id) return
    Promise.all([getExpense(id), listMembers(activeGroup.id), listCategories(activeGroup.id)]).then(([e, m, c]) => {
      setExpense(e)
      setMembers(withHistoricalParticipants(m, e))
      setCategories(c)
      setAmount(String(e.amount))
      setDescription(e.description)
      setCategoryId(e.category_id ?? '')
      setPaidBy(e.paid_by_user_id)
      setDate(e.expense_date)
      setNotes(e.notes ?? '')
      setParticipantIds(e.participants?.map(p => p.user_id) ?? [])
      const restoredSplit = (e.participants?.[0]?.split_type as SplitType) ?? 'equal'
      const restoredValues = e.participants?.map(p => ({ user_id: p.user_id, amount: p.amount, percentage: p.percentage })) ?? []
      setSplitType(restoredSplit)
      setSplitValues(restoredValues)
      initialRef.current = snapshotOf({
        amount: String(e.amount),
        description: e.description,
        categoryId: e.category_id ?? '',
        paidBy: e.paid_by_user_id,
        date: e.expense_date,
        participantIds: e.participants?.map(p => p.user_id) ?? [],
        splitType: restoredSplit,
        splitValues: restoredValues,
        notes: e.notes ?? ''
      })
    }).catch(err => setError(err.message ?? 'Could not load this expense.'))
  }, [activeGroup, id])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if ((e.metaKey || e.ctrlKey) && key === 's') {
        e.preventDefault()
        formRef.current?.requestSubmit()
      }
      if (e.key === 'Escape' && !document.querySelector('.modal-overlay')) void leave(detailsPath)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [leave, detailsPath])

  useEffect(() => () => {
    if (navigateTimerRef.current !== null) window.clearTimeout(navigateTimerRef.current)
    if (errorTimerRef.current !== null) window.clearTimeout(errorTimerRef.current)
  }, [])

  // Skeleton shimmer.
  useGSAP(() => {
    const root = rootRef.current
    if (!root || expense) return
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
  }, { scope: rootRef, dependencies: [expense?.id], revertOnUpdate: true })

  // Sections stagger in once the form is ready.
  useGSAP(() => {
    const root = rootRef.current
    if (!root || !expense || !mayEdit) return
    const mm = gsap.matchMedia()
    mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, context => {
      const sections = gsap.utils.toArray<HTMLElement>('[data-edit-section]', root)
      if (!context.conditions?.motion) {
        gsap.set(sections, { opacity: 1, y: 0 })
        return
      }
      gsap.fromTo(sections,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.55, stagger: 0.08, ease: 'power3.out', overwrite: 'auto' }
      )
    })
    return () => mm.revert()
  }, { scope: rootRef, dependencies: [expense?.id, mayEdit], revertOnUpdate: true })

  // A missed first frame must not hide the edit form.
  useEffect(() => {
    const root = rootRef.current
    if (!root || !expense || !mayEdit) return
    const revealTargets = () => gsap.utils.toArray<HTMLElement>('[data-edit-section]', root)

    return guardReveal(revealTargets, () => {
      const targets = revealTargets()
      gsap.killTweensOf(targets)
      gsap.set(targets, { opacity: 1, y: 0 })
    }, 3000)
  }, [expense?.id, mayEdit])

  // Focus nudge on labels; colour is handled by CSS so only transform is tweened.
  useGSAP(() => {
    const root = rootRef.current
    if (!root || !mayEdit) return
    const mm = gsap.matchMedia()
    mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, context => {
      if (!context.conditions?.motion) return
      const cleanups: Array<() => void> = []
      root.querySelectorAll<HTMLElement>(
        '.expense-form-section .input, .expense-form-section .select, .expense-form-section .split-input, .expense-form-section .expense-amount-input, .expense-category-option'
      ).forEach(element => {
        const label = element.closest('.field')?.querySelector<HTMLElement>('.field-label')
        if (!label) return
        const onFocus = () => gsap.to(label, { x: 3, duration: 0.18, ease: 'power2.out' })
        const onBlur = () => gsap.to(label, { x: 0, duration: 0.2, ease: 'power2.out' })
        element.addEventListener('focus', onFocus)
        element.addEventListener('blur', onBlur)
        cleanups.push(() => {
          element.removeEventListener('focus', onFocus)
          element.removeEventListener('blur', onBlur)
        })
      })
      return () => cleanups.forEach(off => off())
    })
    return () => mm.revert()
  }, { scope: rootRef, dependencies: [expense?.id, mayEdit] })

  // Segmented control indicator slides to the active option.
  useGSAP(() => {
    const root = rootRef.current
    const wrap = root?.querySelector<HTMLElement>('.expense-segmented')
    const indicator = wrap?.querySelector<HTMLElement>('.segmented-indicator')
    const active = wrap?.querySelector<HTMLElement>('button.active')
    if (!wrap || !indicator || !active) return
    const x = Math.max(0, active.offsetLeft - 3)
    const width = active.offsetWidth
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.to(indicator, { x, width, duration: 0.28, ease: 'power3.out', overwrite: 'auto' })
    })
    // Keep the active segment visible without animating when motion is off.
    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(indicator, { x, width })
    })
    return () => mm.revert()
  }, { scope: rootRef, dependencies: [splitType, expense?.id, mayEdit] })

  // Mobile category chips press feedback (transform only).
  useGSAP(() => {
    const root = rootRef.current
    if (!root) return
    const mm = gsap.matchMedia()
    mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, context => {
      if (!context.conditions?.motion) return
      const onClick = (event: Event) => {
        const target = (event.target as HTMLElement).closest<HTMLElement>('[data-pop]')
        if (!target) return
        gsap.fromTo(target, { scale: 0.95 }, { scale: 1, duration: 0.2, ease: 'back.out(2.2)', overwrite: 'auto' })
      }
      root.addEventListener('click', onClick)
      return () => root.removeEventListener('click', onClick)
    })
    return () => mm.revert()
  }, { scope: rootRef })

  // Split "remaining / over by" number and its bar follow the latest values.
  useGSAP(() => {
    const root = rootRef.current
    const status = root?.querySelector<HTMLElement>('[data-split-status]')
    const text = root?.querySelector<HTMLElement>('[data-split-status-text]')
    const bar = root?.querySelector<HTMLElement>('[data-split-progress]')
    if (!root || !status || !text || !bar) return

    const target = Number(status.dataset.splitDifference ?? 0)
    const mode = status.dataset.splitMode ?? splitType
    const finalText = text.dataset.splitFinalText ?? status.dataset.splitFinalText ?? ''
    const targetWidth = Math.min(Math.max(parseFloat(bar.style.width) || 0, 0), 100)
    const previousWidth = previousBarPercentRef.current
    previousBarPercentRef.current = targetWidth

    const mm = gsap.matchMedia()
    mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, context => {
      const motion = context.conditions?.motion
      if (!motion) {
        splitProxyRef.current.value = target
        text.textContent = finalText
        gsap.set(bar, { scaleX: 1, transformOrigin: 'left center' })
        return
      }
      const proxy = splitProxyRef.current
      gsap.to(proxy, {
        value: target,
        duration: 0.35,
        ease: 'power2.out',
        overwrite: 'auto',
        onUpdate: () => { text.textContent = formatSplitProxy(proxy.value, mode, currency) },
        onComplete: () => { text.textContent = finalText }
      })
      // Interpolate from what was on screen, so typing does not restart at 0.
      const currentScale = Number(gsap.getProperty(bar, 'scaleX')) || 0
      const displayedWidth = (previousWidth ?? targetWidth) * currentScale
      const startScale = targetWidth > 0 ? Math.min(1, displayedWidth / targetWidth) : 0
      gsap.fromTo(bar,
        { scaleX: startScale, transformOrigin: 'left center' },
        { scaleX: 1, duration: 0.45, ease: 'power2.out', overwrite: 'auto' }
      )
      return () => { text.textContent = finalText }
    })
    return () => mm.revert()
  }, { scope: rootRef, dependencies: [splitSignature, currency], revertOnUpdate: true })

  // Validation shakes the split card (or the specific field) and brings its
  // summary into view without changing any validation logic.
  useGSAP(() => {
    const root = rootRef.current
    if (!root || !errorField) return
    const splitError = errorField === 'split' || /split|percent/i.test(error ?? '')
    const card = splitError ? root.querySelector<HTMLElement>('[data-split-card]') : null
    const summary = splitError ? root.querySelector<HTMLElement>('[data-split-status]') : null
    const element = root.querySelector<HTMLElement>(`[data-error-field="${errorField}"]`)
    const target = card ?? element
    const scrollTarget = summary ?? element
    if (!target || !scrollTarget) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      scrollTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })
      gsap.to(target, {
        keyframes: [
          { x: -7, duration: 0.08 },
          { x: 6, duration: 0.08 },
          { x: -4, duration: 0.08 },
          { x: 0, duration: 0.12 }
        ],
        ease: 'power2.out',
        overwrite: 'auto'
      })
    })
    mm.add('(prefers-reduced-motion: reduce)', () => {
      scrollTarget.scrollIntoView({ block: 'center', behavior: 'auto' })
    })
    return () => mm.revert()
  }, { scope: rootRef, dependencies: [errorField, errorSeq], revertOnUpdate: true })

  // Save button states: spinner, drawn checkmark, error nudge.
  useGSAP(() => {
    const root = rootRef.current
    const buttons = gsap.utils.toArray<HTMLElement>('[data-save-btn]', root ?? undefined)
    if (!buttons.length || savePhase === 'idle') return
    const mm = gsap.matchMedia()
    mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, context => {
      const motion = context.conditions?.motion
      if (savePhase === 'saving') {
        buttons.forEach(button => {
          const spinner = button.querySelector<HTMLElement>('.expense-btn-spinner')
          if (motion && spinner) gsap.to(spinner, { rotation: 360, duration: 0.7, repeat: -1, ease: 'none' })
        })
      }
      if (savePhase === 'success') {
        buttons.forEach(button => {
          const check = button.querySelector<SVGPathElement>('[data-save-check]')
          if (check) {
            const length = check.getTotalLength()
            gsap.set(check, { strokeDasharray: length, strokeDashoffset: motion ? length : 0 })
            if (motion) gsap.to(check, { strokeDashoffset: 0, duration: 0.35, ease: 'power2.out' })
          }
        })
        if (motion) gsap.fromTo(buttons, { scale: 1 }, { scale: 1.03, duration: 0.16, repeat: 1, yoyo: true, ease: 'power2.out' })
      }
      if (savePhase === 'error' && motion) {
        gsap.to(buttons, { keyframes: [{ x: -6 }, { x: 5 }, { x: 0 }], duration: 0.36, ease: 'power2.out' })
      }
    })
    return () => mm.revert()
  }, { scope: rootRef, dependencies: [savePhase], revertOnUpdate: true })

  // Error banner height + opacity.
  useGSAP(() => {
    const root = rootRef.current
    const banner = root?.querySelector<HTMLElement>('[data-edit-banner]')
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

  // Exit transition for in-app cancellation / Escape.
  useGSAP(() => {
    const root = rootRef.current
    if (!root) return
    const mm = gsap.matchMedia()
    exitRef.current = target => navigate(target)
    mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, context => {
      if (!context.conditions?.motion) return
      exitRef.current = target => {
        gsap.to(root, {
          opacity: 0,
          x: 24,
          duration: 0.22,
          ease: 'power2.in',
          overwrite: 'auto',
          onComplete: () => navigate(target)
        })
      }
    })
    return () => {
      exitRef.current = null
      mm.revert()
    }
  }, { scope: rootRef, dependencies: [leave] })

  const fail = (field: string, message: string) => {
    setFieldErrors(prev => ({ ...prev, [field]: message }))
    setError(message)
    setErrorField(field)
    setErrorSeq(n => n + 1)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!expense) return
    setError(null)
    setFieldErrors({})
    setErrorField(null)

    if (numAmount <= 0) { fail('amount', 'Enter an amount greater than 0.'); return }
    if (!description.trim()) { fail('description', 'Add a short description.'); return }
    if (selectedMembers.length === 0) { fail('participants', 'Select at least one participant.'); return }
    if (splitType !== 'percentage' && !sameMoney(sumMoney(splitValues.map(v => v.amount)), numAmount)) {
      fail('split', 'Split amounts must add up to the total.')
      return
    }
    if (splitType === 'percentage' && Math.abs(splitValues.reduce((s, v) => s + (v.percentage || 0), 0) - 100) > 0.01) {
      fail('split', 'Percentages must add up to 100%.')
      return
    }

    setSaving(true)
    setSavePhase('saving')
    try {
      await updateExpense(expense.id, {
        description: description.trim(),
        amount: numAmount,
        category_id: categoryId || null,
        paid_by_user_id: paidBy,
        expense_date: date,
        notes: notes.trim() || null,
        split_type: splitType,
        participants: splitValues
      })
      setSavePhase('success')
      navigateTimerRef.current = window.setTimeout(() => navigate(`/expenses/${expense.id}`), 400)
    } catch (err: any) {
      setError(err.message ?? 'Unable to save changes. Check your connection and try again.')
      setSavePhase('error')
      errorTimerRef.current = window.setTimeout(() => setSavePhase('idle'), 900)
    } finally {
      setSaving(false)
    }
  }

  const saveButton = (
    <Button
      type="submit"
      fullWidth
      size="lg"
      className="expense-save-btn"
      data-save-btn
      disabled={saving || savePhase === 'success'}
      aria-busy={saving}
    >
      {savePhase === 'saving' ? (
        <><span className="expense-btn-spinner" aria-hidden="true" />Saving…</>
      ) : savePhase === 'success' ? (
        <>
          <svg className="expense-save-check" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path data-save-check d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
          Saved
        </>
      ) : (
        <><Icon name="check" size={18} />Save changes</>
      )}
    </Button>
  )

  return (
    <div className="expenses-page expense-edit-page" ref={rootRef}>
      {!expense ? (
        error ? (
          <div className="expense-banner-wrap" data-edit-banner>
            <p className="banner banner-error" role="alert"><Icon name="alert" size={18} />{error}</p>
          </div>
        ) : <EditSkeleton />
      ) : !mayEdit ? (
        <>
          <h1 className="page-title">Edit expense</h1>
          <div className="expense-banner-wrap mt-md" data-edit-banner>
            <p className="banner banner-warn" role="status">
              <Icon name="lock" size={18} />Only the person who added this expense, or a group admin, can change it.
            </p>
          </div>
          <p className="mt-md"><Link to={detailsPath} className="link-btn">Back to the expense</Link></p>
        </>
      ) : (
        <form ref={formRef} onSubmit={onSubmit} className="expense-edit-form" noValidate>
          <div className="page-head">
            <div>
              <h1 className="page-title">Edit expense</h1>
              <p className="page-sub">Update the amount, split and details for this expense.</p>
            </div>
            <button type="button" className="expense-back" onClick={() => void leave(detailsPath)} aria-label="Back to expense" title="Back to expense">
              <Icon name="arrowLeft" size={19} />
            </button>
          </div>

          <div className="expense-edit-grid">
            <div className="expense-form-main">
              <section className="expense-form-section" data-edit-section>
                <div className="expense-section-head">
                  <span className="expense-section-index">01</span>
                  <h2>Amount</h2>
                </div>
                <div
                  className={clsx('field', 'expense-amount-field', fieldErrors.amount && 'has-error')}
                  data-error-field="amount"
                >
                  <label className="field-label" htmlFor="amount">Amount</label>
                  <div className="expense-amount-box">
                    <span className="amount-symbol expense-amount-symbol">{currencySymbol(currency)}</span>
                    <input
                      ref={amountRef}
                      id="amount"
                      className="expense-amount-input"
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      required
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                    />
                  </div>
                  {fieldErrors.amount && <p className="field-error" role="alert">{fieldErrors.amount}</p>}
                </div>
              </section>

              <section className="expense-form-section" data-edit-section>
                <div className="expense-section-head">
                  <span className="expense-section-index">02</span>
                  <h2>Details</h2>
                  <span className="expense-section-meta">What, where and when</span>
                </div>
                <div className="expense-form-fields form-grid">
                  <div className="expense-span-2" data-error-field="description">
                    <Input
                      ref={descriptionRef}
                      label="Description"
                      startIcon="receipt"
                      required
                      value={description}
                      error={fieldErrors.description}
                      onChange={e => setDescription(e.target.value)}
                    />
                  </div>

                  <div className="field expense-span-2">
                    <span className="field-label" id="expense-category-label">Category</span>
                    <div className="expense-mobile-category-chips" role="group" aria-labelledby="expense-category-label">
                      <button
                        type="button"
                        className={clsx('chip', 'expense-category-chip', categoryId === '' && 'active')}
                        aria-pressed={categoryId === ''}
                        onClick={() => setCategoryId('')}
                        data-pop
                      >
                        <span aria-hidden="true">✨</span><span className="chip-label">Other</span>
                      </button>
                      {categories.map(c => (
                        <button
                          type="button"
                          key={c.id}
                          className={clsx('chip', 'expense-category-chip', categoryId === c.id && 'active')}
                          aria-pressed={categoryId === c.id}
                          title={c.name}
                          onClick={() => setCategoryId(c.id)}
                          data-pop
                        >
                          <span aria-hidden="true">{c.icon}</span><span className="chip-label">{c.name}</span>
                        </button>
                      ))}
                    </div>
                    <div className="expense-mobile-category">
                      <ExpenseSelect
                        id="category"
                        icon="tag"
                        label="Category"
                        hideEyebrow
                        ariaLabelledBy="expense-category-label"
                        options={categoryOptions}
                        value={categoryId}
                        onChange={setCategoryId}
                      />
                    </div>
                    <div className="expense-category-picker" role="radiogroup" aria-labelledby="expense-category-label">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={categoryId === ''}
                        className={clsx('expense-category-option', categoryId === '' && 'selected')}
                        onClick={() => setCategoryId('')}
                      >
                        <CategoryTile icon={null} size="sm" /><span>Other</span>
                      </button>
                      {categories.map(c => (
                        <button
                          type="button"
                          key={c.id}
                          role="radio"
                          aria-checked={categoryId === c.id}
                          className={clsx('expense-category-option', categoryId === c.id && 'selected')}
                          onClick={() => setCategoryId(c.id)}
                        >
                          <CategoryTile icon={c.icon} size="sm" /><span>{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="field" data-error-field="paidBy">
                    <span className="field-label" id="paid-by-label">Paid by</span>
                    <ExpenseSelect
                      id="paidBy"
                      icon="user"
                      label="Paid by"
                      hideEyebrow
                      ariaLabelledBy="paid-by-label"
                      options={paidByOptions}
                      value={paidBy}
                      onChange={setPaidBy}
                    />
                  </div>
                  <Input label="Date" type="date" startIcon="calendar" value={date} onChange={e => setDate(e.target.value)} />
                </div>
              </section>

              <section className="expense-form-section" data-edit-section>
                <div className="expense-section-head">
                  <span className="expense-section-index">03</span>
                  <h2>Participants</h2>
                  <span className="expense-section-meta">{selectedMembers.length} selected</span>
                </div>
                <div className="field" data-error-field="participants">
                  <span className="field-label">Who was this for?</span>
                  <MemberSelector members={members} selected={participantIds} onChange={setParticipantIds} />
                  {fieldErrors.participants && <p className="field-error" role="alert">{fieldErrors.participants}</p>}
                </div>
              </section>

              <section className="expense-form-section" data-edit-section>
                <div className="expense-section-head">
                  <span className="expense-section-index">04</span>
                  <h2>Split</h2>
                  <span className="expense-section-meta">{splitOk ? 'Balanced' : 'Check amounts'}</span>
                </div>
                <div className="field" data-error-field="split">
                  <div className="split-header">
                    <span className="field-label split-label">Method</span>
                    <div className="segmented expense-segmented" role="group" aria-label="Split method">
                      <span className="segmented-indicator" aria-hidden="true" />
                      {(['equal', 'unequal', 'percentage'] as SplitType[]).map(t => (
                        <button
                          type="button"
                          key={t}
                          onClick={() => setSplitType(t)}
                          className={clsx(splitType === t && 'active')}
                          aria-pressed={splitType === t}
                          data-pop
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <SplitEditor
                    members={selectedMembers}
                    amount={numAmount}
                    currency={currency}
                    splitType={splitType}
                    values={splitValues}
                    onChange={setSplitValues}
                  />
                  {fieldErrors.split && <p className="field-error" role="alert">{fieldErrors.split}</p>}
                </div>
              </section>

              <section className="expense-form-section" data-edit-section>
                <div className="expense-section-head">
                  <span className="expense-section-index">05</span>
                  <h2>Notes</h2>
                  <span className="expense-section-meta">Optional</span>
                </div>
                <Input label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
              </section>
            </div>

            <Card className="expense-summary-card">
              <div>
                <p className="card-label">Total</p>
                <p className="expense-summary-total">{formatMoney(numAmount, currency)}</p>
              </div>

              {dirty && (
                <span className="expense-dirty"><Icon name="alert" size={14} />Unsaved changes</span>
              )}

              <div className="expense-summary-row"><span>Participants</span><strong>{selectedMembers.length}</strong></div>
              <div className="expense-summary-row"><span>Method</span><strong className="capitalize">{splitType}</strong></div>
              <div className="expense-summary-row">
                <span>Split</span>
                <strong className={splitOk ? 'text-receive' : 'text-owe'}>{splitOk ? 'Balanced' : 'Needs attention'}</strong>
              </div>

              {error && (
                <div className="expense-banner-wrap" data-edit-banner>
                  <p className="banner banner-error" role="alert">
                    <Icon name="alert" size={17} />
                    <span className="flex-1">{error}</span>
                    <button
                      type="button"
                      aria-label="Dismiss error"
                      title="Dismiss"
                      onClick={() => { if (bannerOutRef.current) bannerOutRef.current(); else setError(null) }}
                    >
                      <Icon name="x" size={15} />
                    </button>
                  </p>
                </div>
              )}

              {saveButton}
              <button type="button" className="expense-cancel-link" onClick={() => void leave(detailsPath)}>
                Cancel
              </button>
              <span className="expense-sr-only" aria-live="polite">
                {savePhase === 'saving' ? 'Saving changes' : savePhase === 'success' ? 'Changes saved' : savePhase === 'error' ? 'Could not save changes' : ''}
              </span>
            </Card>
          </div>

          <div className="expense-mobile-save">
            <div className="expense-mobile-save-meta">
              <span className="card-label">Total</span>
              <strong className="expense-mobile-save-total">{formatMoney(numAmount, currency)}</strong>
            </div>
            {saveButton}
          </div>
        </form>
      )}
    </div>
  )
}
