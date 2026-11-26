import { FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useGroup } from '@/contexts/GroupContext'
import { useAuth } from '@/contexts/AuthContext'
import { listMembers, listCategories } from '@/services/groups'
import { createExpense, ParticipantInput } from '@/services/expenses'
import type { GroupMember, Category, SplitType } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { MemberSelector } from '../components/MemberSelector'
import { SplitEditor } from '../components/SplitEditor'
import { ExpenseSelect } from '../components/ExpenseSelect'
import { currencySymbol, formatMoney, sameMoney, sumMoney } from '@/lib/money'
import { guardReveal } from '@/lib/motionFallback'
import { gsap, useGSAP } from '../animation'
import { formatSplitProxy } from '../splitMotion'
import { useFormKeyboardFocus } from '../useFormKeyboardFocus'

export default function AddExpense() {
  const navigate = useNavigate()
  const { activeGroup } = useGroup()
  const { user, profile } = useAuth()

  const [members, setMembers] = useState<GroupMember[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [paidBy, setPaidBy] = useState<string>(user?.id ?? '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [splitType, setSplitType] = useState<SplitType>('equal')
  const [splitValues, setSplitValues] = useState<ParticipantInput[]>([])
  const [notes, setNotes] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [errorSeq, setErrorSeq] = useState(0)

  const rootRef = useRef<HTMLDivElement>(null)
  const splitProxyRef = useRef({ value: 0 })
  const previousBarPercentRef = useRef(0)

  useFormKeyboardFocus()

  useEffect(() => {
    if (!activeGroup) return
    listMembers(activeGroup.id).then(m => {
      setMembers(m)
      setParticipantIds(m.map(x => x.user_id)) // everyone selected by default
    })
    listCategories(activeGroup.id).then(c => {
      setCategories(c)
      if (c.length) setCategoryId(c[0].id)
    })
    if (user) setPaidBy(user.id)
  }, [activeGroup, user])

  const selectedMembers = members.filter(m => participantIds.includes(m.user_id))
  const numAmount = parseFloat(amount) || 0
  const currency = activeGroup?.currency ?? 'INR'

  const splitSumAmount = sumMoney(splitValues.map(v => v.amount || 0))
  const splitSumPct = splitValues.reduce((s, v) => s + (v.percentage || 0), 0)
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

  const fail = (message: string) => {
    setError(message)
    setErrorSeq(n => n + 1)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!activeGroup) return
    if (numAmount <= 0) { fail('Enter an amount greater than 0.'); return }
    if (!description.trim()) { fail('Add a short description.'); return }
    if (selectedMembers.length === 0) { fail('Select at least one participant.'); return }

    if (splitType === 'unequal') {
      if (!sameMoney(splitSumAmount, numAmount)) { fail('Split amounts must add up to the total.'); return }
    }
    if (splitType === 'percentage') {
      if (Math.abs(splitSumPct - 100) > 0.01) { fail('Percentages must add up to 100%.'); return }
    }

    setSaving(true)
    try {
      await createExpense({
        group_id: activeGroup.id,
        description: description.trim(),
        amount: numAmount,
        category_id: categoryId || null,
        paid_by_user_id: paidBy,
        expense_date: date,
        notes: notes.trim() || null,
        split_type: splitType,
        participants: splitValues
      })
      navigate('/expenses')
    } catch (err: any) {
      fail(err.message ?? 'Unable to save expense. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  // A delayed first frame must never leave the form invisible on cold start.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const targets = () => gsap.utils.toArray<HTMLElement>('[data-add-section]', root)
    return guardReveal(targets, () => {
      const elements = targets()
      gsap.killTweensOf(elements)
      gsap.set(elements, { opacity: 1, y: 0 })
    }, 3000)
  }, [])

  // Sections stagger in on mount.
  useGSAP(() => {
    const root = rootRef.current
    if (!root) return
    const mm = gsap.matchMedia()
    mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, context => {
      const sections = gsap.utils.toArray<HTMLElement>('[data-add-section]', root)
      if (!context.conditions?.motion) {
        gsap.set(sections, { opacity: 1, y: 0 })
        return
      }
      gsap.fromTo(sections,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.07, ease: 'power3.out', overwrite: 'auto' }
      )
    })
    return () => mm.revert()
  }, { scope: rootRef, revertOnUpdate: true })

  // Chip and segment press feedback — transform only.
  useGSAP(() => {
    const root = rootRef.current
    if (!root) return
    const mm = gsap.matchMedia()
    mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, context => {
      if (!context.conditions?.motion) return
      const onClick = (event: Event) => {
        const target = (event.target as HTMLElement).closest<HTMLElement>('[data-pop]')
        if (!target) return
        gsap.fromTo(target, { scale: 0.94 }, { scale: 1, duration: 0.22, ease: 'back.out(2.4)', overwrite: 'auto' })
      }
      root.addEventListener('click', onClick)
      return () => root.removeEventListener('click', onClick)
    })
    return () => mm.revert()
  }, { scope: rootRef })

  // The active split segment slides its indicator.
  useGSAP(() => {
    const root = rootRef.current
    const wrap = root?.querySelector<HTMLElement>('.segmented')
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
  }, { scope: rootRef, dependencies: [splitType], revertOnUpdate: true })

  // Split "remaining / over by" number and bar track the latest values.
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
  }, { scope: rootRef, dependencies: [splitSignature], revertOnUpdate: true })

  // Validation brings the relevant summary into view and nudges the card.
  useGSAP(() => {
    const root = rootRef.current
    const banner = root?.querySelector<HTMLElement>('[data-add-error]')
    if (!root || !error || !banner) return
    const splitError = /split|percent/i.test(error)
    const card = splitError ? root.querySelector<HTMLElement>('[data-split-card]') : null
    const summary = splitError ? root.querySelector<HTMLElement>('[data-split-status]') : null
    const target = card ?? banner
    const scrollTarget = summary ?? banner
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      scrollTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })
      gsap.to(target, {
        keyframes: [
          { x: -6, duration: 0.08 },
          { x: 5, duration: 0.08 },
          { x: -3, duration: 0.08 },
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
  }, { scope: rootRef, dependencies: [error, errorSeq], revertOnUpdate: true })

  return (
    <div className="form-page" ref={rootRef}>
      <h1 className="page-title">Add expense</h1>

      <form onSubmit={onSubmit} className="stack mt-lg">
        <div className="field" data-add-section>
          <label className="field-label" htmlFor="amount">Amount</label>
          <div className="amount-box">
            <span className="amount-symbol">{currencySymbol(currency)}</span>
            <input
              id="amount" className="amount-input" type="number" inputMode="decimal" step="0.01"
              placeholder="0.00" required autoFocus value={amount} onChange={e => setAmount(e.target.value)}
            />
          </div>
        </div>

        <div data-add-section>
          <Input label="Description" placeholder="Dinner" required value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <div className="field" data-add-section>
          <span className="field-label" id="add-category-label">Category</span>
          <div className="chip-list" role="group" aria-labelledby="add-category-label">
            {categories.map(c => (
              <button
                type="button"
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={clsx('chip', 'expense-category-chip', categoryId === c.id && 'active')}
                aria-pressed={categoryId === c.id}
                title={c.name}
                data-pop
              >
                <span aria-hidden="true">{c.icon}</span><span className="chip-label">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2" data-add-section>
          <div className="field">
            <span className="field-label" id="add-paid-by-label">Paid by</span>
            <ExpenseSelect
              id="paidBy"
              icon="user"
              label="Paid by"
              hideEyebrow
              ariaLabelledBy="add-paid-by-label"
              options={members.map(m => ({
                value: m.user_id,
                label: m.user_id === user?.id ? `${profile?.name ?? 'You'} (you)` : m.profile?.name ?? 'Member'
              }))}
              value={paidBy}
              onChange={setPaidBy}
            />
          </div>
          <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <div className="field" data-add-section>
          <span className="field-label">Participants</span>
          <MemberSelector members={members} selected={participantIds} onChange={setParticipantIds} />
        </div>

        <div className="field" data-add-section>
          <div className="split-header">
            <span className="field-label split-label">Split</span>
            <div className="segmented" role="group" aria-label="Split method">
              <span className="segmented-indicator" aria-hidden="true" />
              {(['equal', 'unequal', 'percentage'] as SplitType[]).map(t => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setSplitType(t)}
                  className={clsx(splitType === t && 'active')}
                  aria-pressed={splitType === t}
                  data-pop
                >{t}</button>
              ))}
            </div>
          </div>
          <SplitEditor
            members={selectedMembers} amount={numAmount} currency={currency}
            splitType={splitType} values={splitValues} onChange={setSplitValues}
          />
        </div>

        <div data-add-section>
          <Input label="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {error && <p className="error-text" role="alert" data-add-error>{error}</p>}

        <Button type="submit" fullWidth size="lg" disabled={saving} className="sticky-submit">
          {saving ? 'Saving…' : 'Save expense'}
        </Button>
      </form>
    </div>
  )
}
