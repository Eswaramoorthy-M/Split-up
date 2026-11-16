import { useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import type { Expense, GroupBalance } from '@/types'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { balanceLabel, formatMoney } from '@/lib/money'
import { CategoryTile, Icon } from '@/components/ui/Icon'

interface Props {
  balances: GroupBalance[]
  expenses: Expense[]
  currency: string
  currentUserId?: string
}

/** One card per member: what they paid, their share, and exactly which expenses make up each. */
export function MemberBreakdown({ balances, expenses, currency, currentUserId }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (balances.length === 0) {
    return <EmptyState title="No members to show" body="Balances appear once the group has expenses." />
  }

  return (
    <div className="stack-sm">
      {balances.map(b => {
        const { text, state } = balanceLabel(b.net_balance, currency)
        const open = openId === b.user_id
        const paid = expenses.filter(e => e.paid_by_user_id === b.user_id)
        const shares = expenses
          .map(e => ({ e, p: e.participants?.find(p => p.user_id === b.user_id) }))
          .filter(x => x.p)

        return (
          <Card key={b.user_id} className="manage-card">
            <button className="manage-card-head" onClick={() => setOpenId(open ? null : b.user_id)} aria-expanded={open}>
              <span className="avatar avatar-sm">{b.name?.[0]?.toUpperCase()}</span>
              <span className="manage-card-main">
                <span className="expense-title">{b.name}{b.user_id === currentUserId && <span className="faint"> (you)</span>}</span>
                <span className="expense-meta">
                  Paid <span className="tabular">{formatMoney(b.total_paid, currency)}</span> · Share <span className="tabular">{formatMoney(b.total_share, currency)}</span>
                </span>
              </span>
              <span className="manage-card-amount">
                <span className={clsx('expense-amount', state === 'receive' && 'text-receive', state === 'owe' && 'text-owe')}>
                  {state === 'settled' ? 'Settled' : formatMoney(b.net_balance, currency)}
                </span>
                <span className="text-xs muted">{state === 'receive' ? 'gets back' : state === 'owe' ? 'owes' : text}</span>
              </span>
            </button>

            {open && (
              <div className="manage-card-body">
                <p className="breakdown-title">Expenses {b.name} paid ({paid.length})</p>
                {paid.length === 0 && <p className="text-sm muted">Nothing paid in this period.</p>}
                {paid.map(e => (
                  <Link key={e.id} to={`/expenses/${e.id}`} className="line-item">
                    <span className="cat-name"><CategoryTile icon={e.category?.icon} size="sm" />{e.description}</span>
                    <span className="tabular fw-semibold">{formatMoney(e.amount, currency)}</span>
                  </Link>
                ))}

                <p className="breakdown-title mt-md">{b.name}'s share ({shares.length})</p>
                {shares.length === 0 && <p className="text-sm muted">Not part of any expense in this period.</p>}
                {shares.map(({ e, p }) => (
                  <Link key={e.id} to={`/expenses/${e.id}`} className="line-item">
                    <span className="cat-name"><CategoryTile icon={e.category?.icon} size="sm" />{e.description}</span>
                    <span className="tabular fw-semibold">{formatMoney(p!.amount, currency)}</span>
                  </Link>
                ))}

                <div className="manage-actions">
                  <Link to={`/members/${b.user_id}`} className="link-btn">Open profile and settlements<Icon name="arrowRight" size={16} /></Link>
                </div>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
