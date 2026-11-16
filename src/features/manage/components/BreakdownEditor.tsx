import { FormEvent, useState } from 'react'
import clsx from 'clsx'
import type { Expense, GroupMember, SplitType } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { MemberSelector } from '@/features/expenses/components/MemberSelector'
import { SplitEditor } from '@/features/expenses/components/SplitEditor'
import { ParticipantInput, updateExpense } from '@/services/expenses'
import { withHistoricalParticipants } from '@/lib/members'
import { formatMoney, sameMoney, sumMoney } from '@/lib/money'

interface Props {
  expense: Expense
  members: GroupMember[]
  currency: string
  onClose: () => void
  onSaved: () => void
}

/** Edit WHO paid and HOW the expense is split between members. */
export function BreakdownEditor({ expense, members, currency, onClose, onSaved }: Props) {
  const allMembers = withHistoricalParticipants(members, expense)

  const [paidBy, setPaidBy] = useState(expense.paid_by_user_id)
  const [participantIds, setParticipantIds] = useState<string[]>(expense.participants?.map(p => p.user_id) ?? [])
  const [splitType, setSplitType] = useState<SplitType>((expense.participants?.[0]?.split_type as SplitType) ?? 'equal')
  const [values, setValues] = useState<ParticipantInput[]>(
    expense.participants?.map(p => ({ user_id: p.user_id, amount: p.amount, percentage: p.percentage })) ?? []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = allMembers.filter(m => participantIds.includes(m.user_id))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (selected.length === 0) { setError('Select at least one person.'); return }
    if (splitType !== 'percentage' && !sameMoney(sumMoney(values.map(v => v.amount)), expense.amount)) {
      setError('The shares must add up to the expense total.'); return
    }
    if (splitType === 'percentage') {
      const pct = values.reduce((s, v) => s + (v.percentage || 0), 0)
      if (Math.abs(pct - 100) > 0.01) { setError('Percentages must add up to 100%.'); return }
    }

    setSaving(true)
    try {
      await updateExpense(expense.id, {
        description: expense.description,
        amount: expense.amount,
        category_id: expense.category_id,
        paid_by_user_id: paidBy,
        expense_date: expense.expense_date,
        notes: expense.notes,
        split_type: splitType,
        participants: values
      })
      onSaved()
    } catch (err: any) {
      setError(err.message ?? 'Unable to save. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="Edit payment breakdown" onClose={onClose}>
      <p className="fw-medium">{expense.description}</p>
      <p className="muted text-sm">
        Total <span className="tabular fw-medium">{formatMoney(expense.amount, currency)}</span>. To change the
        amount, use <em>Edit</em> on the expense.
      </p>

      <form onSubmit={onSubmit} className="stack-md mt-md">
        <div className="field">
          <label className="field-label" htmlFor="bk-paidby">Paid by</label>
          <select id="bk-paidby" className="select" value={paidBy} onChange={e => setPaidBy(e.target.value)}>
            {allMembers.map(m => <option key={m.user_id} value={m.user_id}>{m.profile?.name}</option>)}
          </select>
        </div>

        <div className="field">
          <span className="field-label">Who shares this expense</span>
          <MemberSelector members={allMembers} selected={participantIds} onChange={setParticipantIds} />
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
            members={selected} amount={expense.amount} currency={currency}
            splitType={splitType} values={values} onChange={setValues}
          />
        </div>

        {error && <p className="error-text" role="alert">{error}</p>}

        <div className="row">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Saving…' : 'Save breakdown'}</Button>
        </div>
      </form>
    </Modal>
  )
}
