import clsx from 'clsx'
import { balanceLabel, formatMoney } from '@/lib/money'
import { Card } from './Card'

interface Props {
  netBalance: number
  currency: string
  totalPaid: number
  totalShare: number
}

export function BalanceCard({ netBalance, currency, totalPaid, totalShare }: Props) {
  const { text, state } = balanceLabel(netBalance, currency)
  return (
    <Card className={clsx('balance-card', state)}>
      <p className="card-label">Your balance</p>
      <p className="balance-amount tabular">{text}</p>
      <div className="balance-meta">
        <span>Paid <strong className="tabular">{formatMoney(totalPaid, currency)}</strong></span>
        <span>Your share <strong className="tabular">{formatMoney(totalShare, currency)}</strong></span>
      </div>
    </Card>
  )
}
