import { FormEvent, useEffect, useState } from 'react'
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
import { currencySymbol, sameMoney, sumMoney } from '@/lib/money'

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

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!activeGroup) return
    if (numAmount <= 0) { setError('Enter an amount greater than 0.'); return }
    if (!description.trim()) { setError('Add a short description.'); return }
    if (selectedMembers.length === 0) { setError('Select at least one participant.'); return }

    if (splitType === 'unequal') {
      if (!sameMoney(sumMoney(splitValues.map(v => v.amount)), numAmount)) { setError('Split amounts must add up to the total.'); return }
    }
    if (splitType === 'percentage') {
      const sum = splitValues.reduce((s, v) => s + (v.percentage || 0), 0)
      if (Math.abs(sum - 100) > 0.01) { setError('Percentages must add up to 100%.'); return }
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
      setError(err.message ?? 'Unable to save expense. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="form-page">
      <h1 className="page-title">Add expense</h1>

      <form onSubmit={onSubmit} className="stack mt-lg">
        <div className="field">
          <label className="field-label" htmlFor="amount">Amount</label>
          <div className="amount-box">
            <span className="amount-symbol">{currencySymbol(activeGroup?.currency ?? 'INR')}</span>
            <input
              id="amount" className="amount-input" type="number" inputMode="decimal" step="0.01"
              placeholder="0.00" required autoFocus value={amount} onChange={e => setAmount(e.target.value)}
            />
          </div>
        </div>

        <Input label="Description" placeholder="Dinner" required value={description} onChange={e => setDescription(e.target.value)} />

        <div className="field">
          <span className="field-label">Category</span>
          <div className="chip-list">
            {categories.map(c => (
              <button type="button" key={c.id} onClick={() => setCategoryId(c.id)} className={clsx('chip', categoryId === c.id && 'active')}>
                <span aria-hidden="true">{c.icon}</span>{c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label className="field-label" htmlFor="paidBy">Paid by</label>
            <select id="paidBy" className="select" value={paidBy} onChange={e => setPaidBy(e.target.value)}>
              {members.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.user_id === user?.id ? `${profile?.name ?? 'You'} (you)` : m.profile?.name}</option>
              ))}
            </select>
          </div>
          <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <div className="field">
          <span className="field-label">Participants</span>
          <MemberSelector members={members} selected={participantIds} onChange={setParticipantIds} />
        </div>

        <div className="field">
          <div className="split-header">
            <span className="field-label split-label">Split</span>
            <div className="segmented" role="group" aria-label="Split method">
              {(['equal', 'unequal', 'percentage'] as SplitType[]).map(t => (
                <button type="button" key={t} onClick={() => setSplitType(t)} className={clsx(splitType === t && 'active')}>{t}</button>
              ))}
            </div>
          </div>
          <SplitEditor
            members={selectedMembers} amount={numAmount} currency={activeGroup?.currency ?? 'INR'}
            splitType={splitType} values={splitValues} onChange={setSplitValues}
          />
        </div>

        <Input label="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />

        {error && <p className="error-text" role="alert">{error}</p>}

        <Button type="submit" fullWidth size="lg" disabled={saving} className="sticky-submit">
          {saving ? 'Saving…' : 'Save expense'}
        </Button>
      </form>
    </div>
  )
}
