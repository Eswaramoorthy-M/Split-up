import { useEffect, useMemo, useRef } from 'react'
import clsx from 'clsx'
import type { GroupMember, SplitType } from '@/types'
import { allocateByPercent, computeEqualShares, ParticipantInput } from '@/services/expenses'
import { currencySymbol, formatMoney, sameMoney, sumMoney } from '@/lib/money'
import { Icon } from '@/components/ui/Icon'

interface Props {
  members: GroupMember[] // selected participants, in order
  amount: number
  currency: string
  splitType: SplitType
  values: ParticipantInput[]
  onChange: (values: ParticipantInput[]) => void
}

export function SplitEditor({ members, amount, currency, splitType, values, onChange }: Props) {
  const idsKey = members.map(m => m.user_id).join(',')
  const prevIds = useRef<string | null>(null)
  const prevType = useRef<SplitType | null>(null)

  // Keep the split in sync with who is included, the split method and the total.
  // When an existing expense is opened for editing, its saved split is kept as-is.
  useEffect(() => {
    const first = prevIds.current === null
    const membersChanged = prevIds.current !== idsKey
    const typeChanged = prevType.current !== splitType
    prevIds.current = idsKey
    prevType.current = splitType

    const ids = members.map(m => m.user_id)
    if (ids.length === 0) { onChange([]); return }

    const valuesMatchMembers =
      values.length === ids.length && ids.every(id => values.some(v => v.user_id === id))

    if (first && valuesMatchMembers) return // editing: keep the saved breakdown

    if (splitType === 'equal') {
      onChange(computeEqualShares(amount || 0, ids))
      return
    }

    if (splitType === 'percentage') {
      if (!membersChanged && !typeChanged && valuesMatchMembers) {
        onChange(allocateByPercent(amount || 0, values)) // only the total changed
        return
      }
      const pct = +(100 / ids.length).toFixed(2)
      const rows = ids.map((id, i) => ({
        user_id: id,
        percentage: i === ids.length - 1 ? +(100 - pct * (ids.length - 1)).toFixed(2) : pct,
        amount: 0
      }))
      onChange(allocateByPercent(amount || 0, rows))
      return
    }

    // unequal: keep what the person typed when only the total changes
    if (!membersChanged && !typeChanged) return
    onChange(computeEqualShares(amount || 0, ids))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, splitType, amount])

  const sumAmount = useMemo(() => sumMoney(values.map(v => v.amount || 0)), [values])
  const sumPct = useMemo(() => values.reduce((s, v) => s + (v.percentage || 0), 0), [values])

  const updateAmount = (userId: string, val: number) => {
    onChange(values.map(v => (v.user_id === userId ? { ...v, amount: val } : v)))
  }
  const updatePct = (userId: string, pct: number) => {
    onChange(allocateByPercent(amount || 0, values.map(v => (v.user_id === userId ? { ...v, percentage: pct } : v))))
  }

  if (splitType === 'equal') {
    return (
      <div className="stack-xs">
        {members.map(m => {
          const v = values.find(x => x.user_id === m.user_id)
          return (
            <div key={m.user_id} className="split-row">
              <span>{m.profile?.name}</span>
              <span className="tabular fw-medium">{formatMoney(v?.amount ?? 0, currency)}</span>
            </div>
          )
        })}
      </div>
    )
  }

  if (splitType === 'percentage') {
    const diff = +(100 - sumPct).toFixed(2)
    const ok = Math.abs(diff) < 0.01
    return (
      <div className="stack-xs">
        {members.map(m => {
          const v = values.find(x => x.user_id === m.user_id)
          return (
            <div key={m.user_id} className="split-row">
              <span className="split-name">{m.profile?.name}</span>
              <span className="split-unit tabular">{formatMoney(v?.amount ?? 0, currency)}</span>
              <input
                type="number" step="0.01" inputMode="decimal" className="split-input"
                aria-label={`${m.profile?.name} percentage`}
                value={v?.percentage ?? 0}
                onChange={e => updatePct(m.user_id, parseFloat(e.target.value) || 0)}
              />
              <span className="split-unit">%</span>
            </div>
          )
        })}
        <p className={clsx('split-status', ok && 'ok')}>
          <Icon name={ok ? 'check' : 'alert'} size={14} strokeWidth={2.2} />
          {ok ? 'Adds up to 100%' : `${diff > 0 ? 'Remaining' : 'Over by'} ${Math.abs(diff)}%`}
        </p>
      </div>
    )
  }

  // unequal
  const diffCents = Math.round((amount || 0) * 100) - Math.round(sumAmount * 100)
  const ok = diffCents === 0 && sameMoney(sumAmount, amount || 0)
  return (
    <div className="stack-xs">
      {members.map(m => {
        const v = values.find(x => x.user_id === m.user_id)
        return (
          <div key={m.user_id} className="split-row">
            <span className="split-name">{m.profile?.name}</span>
            <span className="split-unit">{currencySymbol(currency)}</span>
            <input
              type="number" step="0.01" inputMode="decimal" className="split-input wide"
              aria-label={`${m.profile?.name} amount`}
              value={v?.amount ?? 0}
              onChange={e => updateAmount(m.user_id, parseFloat(e.target.value) || 0)}
            />
          </div>
        )
      })}
      <p className={clsx('split-status', ok && 'ok')}>
        <Icon name={ok ? 'check' : 'alert'} size={14} strokeWidth={2.2} />
        {ok ? 'Adds up to the total' : `${diffCents > 0 ? 'Remaining' : 'Over by'} ${formatMoney(Math.abs(diffCents) / 100, currency)}`}
      </p>
    </div>
  )
}
