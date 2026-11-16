import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useGroup } from '@/contexts/GroupContext'
import { getGroupBalances } from '@/services/balances'
import { listSettlements } from '@/services/settlements'
import type { GroupBalance, Settlement } from '@/types'
import { Card } from '@/components/ui/Card'
import { formatMoney, balanceLabel } from '@/lib/money'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import clsx from 'clsx'

export default function MemberDetails() {
  const { userId } = useParams()
  const { activeGroup } = useGroup()
  const [balance, setBalance] = useState<GroupBalance | null>(null)
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activeGroup || !userId) return
    Promise.all([getGroupBalances(activeGroup.id), listSettlements(activeGroup.id)]).then(([balances, s]) => {
      setBalance(balances.find(b => b.user_id === userId) ?? null)
      setSettlements(s.filter(x => x.from_user_id === userId || x.to_user_id === userId))
      setLoading(false)
    })
  }, [activeGroup, userId])

  if (loading) return <div className="center-spinner"><Spinner /></div>
  if (!balance) return <EmptyState title="Member not found" />

  const currency = activeGroup?.currency
  const label = balanceLabel(balance.net_balance, currency)
  const balanceClass = label.state === 'receive' ? 'text-receive' : label.state === 'owe' ? 'text-owe' : ''

  return (
    <div>
      <div className="profile-header">
        <div className="avatar">{balance.name?.[0]?.toUpperCase()}</div>
        <h1 className="page-title">{balance.name}</h1>
      </div>

      <Card className="mt-lg">
        <div className="stats-grid">
          <div><p className="stat-label">Paid</p><p className="stat-value">{formatMoney(balance.total_paid, currency)}</p></div>
          <div><p className="stat-label">Share</p><p className="stat-value">{formatMoney(balance.total_share, currency)}</p></div>
          <div><p className="stat-label">Balance</p><p className={`stat-value ${balanceClass}`}>{formatMoney(balance.net_balance, currency)}</p></div>
        </div>
      </Card>

      <h2 className="section-title">Settlement history</h2>
      <div className="stack-sm">
        {settlements.length === 0 && <EmptyState title="No settlements yet" />}
        {settlements.map(s => (
          <Card key={s.id} className="card-row text-sm">
            <span className="transfer">{s.from_profile?.name}<Icon name="arrowRight" size={16} />{s.to_profile?.name}</span>
            <span className="row">
              <span className="tabular fw-semibold">{formatMoney(s.amount, currency)}</span>
              <span className={clsx('status-tag', s.status)}>{s.status}</span>
            </span>
          </Card>
        ))}
      </div>
    </div>
  )
}
