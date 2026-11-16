import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGroup } from '@/contexts/GroupContext'
import { useAuth } from '@/contexts/AuthContext'
import { getGroupBalances, getSettlementSuggestions } from '@/services/balances'
import { listExpenses } from '@/services/expenses'
import { listMembers } from '@/services/groups'
import type { GroupBalance, SettlementSuggestion } from '@/types'
import { BalanceCard } from '@/components/ui/BalanceCard'
import { Card } from '@/components/ui/Card'
import { formatMoney } from '@/lib/money'
import { Spinner } from '@/components/ui/Spinner'
import { Icon } from '@/components/ui/Icon'

export default function Dashboard() {
  const { activeGroup } = useGroup()
  const { user } = useAuth()
  const [balances, setBalances] = useState<GroupBalance[]>([])
  const [suggestions, setSuggestions] = useState<SettlementSuggestion[]>([])
  const [expenseCount, setExpenseCount] = useState(0)
  const [memberCount, setMemberCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activeGroup) return
    Promise.all([
      getGroupBalances(activeGroup.id),
      getSettlementSuggestions(activeGroup.id),
      listExpenses(activeGroup.id, { pageSize: 1 }),
      listMembers(activeGroup.id)
    ]).then(([b, s, ex, m]) => {
      setBalances(b); setSuggestions(s); setExpenseCount(ex.count); setMemberCount(m.length)
      setLoading(false)
    })
  }, [activeGroup])

  if (loading) return <div className="center-spinner"><Spinner /></div>

  const me = balances.find(b => b.user_id === user?.id)
  const currency = activeGroup?.currency ?? 'INR'
  const totalExpenses = balances.reduce((s, b) => s + b.total_paid, 0)
  const pendingAmount = suggestions.reduce((s, x) => s + x.amount, 0)

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="page-kicker">{activeGroup?.group_name}</p>
          <h1 className="page-title">This month</h1>
        </div>
        <Link to="/groups" className="link-btn"><Icon name="repeat" size={16} />Switch</Link>
      </div>

      <Card className="hero-card mt-lg">
        <p className="card-label">Total expenses</p>
        <p className="big-number">{formatMoney(totalExpenses, currency)}</p>
        <div className="summary-grid">
          <div><p className="muted">Members</p><p className="fw-medium">{memberCount}</p></div>
          <div><p className="muted">Expenses</p><p className="fw-medium">{expenseCount}</p></div>
          <div><p className="muted">Pending settlement</p><p className="tabular fw-medium text-owe">{formatMoney(pendingAmount, currency)}</p></div>
          <div><p className="muted">Settled</p><p className="tabular fw-medium text-receive">{formatMoney(Math.max(totalExpenses - pendingAmount, 0), currency)}</p></div>
        </div>
      </Card>

      {me && (
        <div className="mt-md">
          <BalanceCard netBalance={me.net_balance} currency={currency} totalPaid={me.total_paid} totalShare={me.total_share} />
        </div>
      )}

      <div className="section-head">
        <h2 className="section-title">Who owes what</h2>
        <Link to="/settle" className="link-btn">Settle up<Icon name="arrowRight" size={16} /></Link>
      </div>
      <Card className="list-card">
        {balances.filter(b => Math.abs(b.net_balance) > 0.01).map(b => (
          <div key={b.user_id} className="list-row">
            <span className="list-row-name">
              <span className="avatar avatar-xs" aria-hidden="true">{b.name?.[0]?.toUpperCase()}</span>
              <span>{b.name}</span>
            </span>
            <span className={`amount-pill ${b.net_balance > 0 ? 'receive' : 'owe'}`}>
              {b.net_balance > 0 ? `gets back ${formatMoney(b.net_balance, currency)}` : `owes ${formatMoney(Math.abs(b.net_balance), currency)}`}
            </span>
          </div>
        ))}
        {balances.every(b => Math.abs(b.net_balance) < 0.01) && (
          <p className="settled-note"><Icon name="checkCircle" size={20} />Everyone is settled up.</p>
        )}
      </Card>
    </div>
  )
}
