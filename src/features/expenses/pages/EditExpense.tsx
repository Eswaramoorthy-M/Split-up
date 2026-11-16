import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { useGroup } from '@/contexts/GroupContext'
import { useAuth } from '@/contexts/AuthContext'
import { listMembers, listCategories } from '@/services/groups'
import { getExpense, updateExpense, ParticipantInput } from '@/services/expenses'
import type { GroupMember, Category, SplitType, Expense } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { MemberSelector } from '../components/MemberSelector'
import { SplitEditor } from '../components/SplitEditor'
import { Spinner } from '@/components/ui/Spinner'
import { withHistoricalParticipants } from '@/lib/members'
import { currencySymbol, sameMoney, sumMoney } from '@/lib/money'

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

  useEffect(() => {
    if (!activeGroup || !id) return
    Promise.all([getExpense(id), listMembers(activeGroup.id), listCategories(activeGroup.id)]).then(([e, m, c]) => {
      setExpense(e); setMembers(withHistoricalParticipants(m, e)); setCategories(c)
      setAmount(String(e.amount)); setDescription(e.description); setCategoryId(e.category_id ?? '')
      setPaidBy(e.paid_by_user_id)
      setDate(e.expense_date); setNotes(e.notes ?? '')
      setParticipantIds(e.participants?.map(p => p.user_id) ?? [])
      setSplitType((e.participants?.[0]?.split_type as SplitType) ?? 'equal')
      setSplitValues(e.participants?.map(p => ({ user_id: p.user_id, amount: p.amount, percentage: p.percentage })) ?? [])
    }).catch(err => setError(err.message ?? 'Could not load this expense.'))
  }, [activeGroup, id])

  const selectedMembers = members.filter(m => participantIds.includes(m.user_id))
  const numAmount = parseFloat(amount) || 0

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!expense) return
    setError(null)
    if (numAmount <= 0) { setError('Enter an amount greater than 0.'); return }
    if (!description.trim()) { setError('Add a short description.'); return }
    if (selectedMembers.length === 0) { setError('Select at least one participant.'); return }
    if (splitType !== 'percentage' && !sameMoney(sumMoney(splitValues.map(v => v.amount)), numAmount)) {
      setError('Split amounts must add up to the total.'); return
    }
    if (splitType === 'percentage' && Math.abs(splitValues.reduce((s, v) => s + (v.percentage || 0), 0) - 100) > 0.01) {
      setError('Percentages must add up to 100%.'); return
    }
    setSaving(true)
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
      navigate(`/expenses/${expense.id}`)
    } catch (err: any) {
      setError(err.message ?? 'Unable to save changes. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!expense) {
    return error
      ? <p className="error-text" role="alert">{error}</p>
      : <div className="center-spinner"><Spinner /></div>
  }

  const mayEdit = activeMembership?.role === 'admin' || expense.created_by === user?.id
  if (!mayEdit) {
    return (
      <div>
        <h1 className="page-title">Edit expense</h1>
        <p className="banner banner-warn mt-md">Only the person who added this expense, or a group admin, can change it.</p>
        <p className="mt-md"><Link to={`/expenses/${expense.id}`} className="link-btn">Back to the expense</Link></p>
      </div>
    )
  }

  return (
    <div className="form-page">
      <h1 className="page-title">Edit expense</h1>
      <form onSubmit={onSubmit} className="stack mt-lg">
        <div className="field">
          <label className="field-label" htmlFor="amount">Amount</label>
          <div className="amount-box">
            <span className="amount-symbol">{currencySymbol(activeGroup?.currency ?? 'INR')}</span>
            <input
              id="amount" className="amount-input" type="number" step="0.01" inputMode="decimal"
              required value={amount} onChange={e => setAmount(e.target.value)}
            />
          </div>
        </div>
        <Input label="Description" required value={description} onChange={e => setDescription(e.target.value)} />

        <div className="field">
          <label className="field-label" htmlFor="category">Category</label>
          <select id="category" className="select" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>

        <div className="grid-2">
          <div className="field">
            <label className="field-label" htmlFor="paidBy">Paid by</label>
            <select id="paidBy" className="select" value={paidBy} onChange={e => setPaidBy(e.target.value)}>
              {members.map(m => <option key={m.user_id} value={m.user_id}>{m.profile?.name}</option>)}
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
          <SplitEditor members={selectedMembers} amount={numAmount} currency={activeGroup?.currency ?? 'INR'} splitType={splitType} values={splitValues} onChange={setSplitValues} />
        </div>

        <Input label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
        {error && <p className="error-text" role="alert">{error}</p>}
        <Button type="submit" fullWidth size="lg" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
      </form>
    </div>
  )
}
