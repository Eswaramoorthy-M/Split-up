import { Link } from 'react-router-dom'
import type { Expense } from '@/types'
import { formatMoney } from '@/lib/money'
import { CategoryTile } from '@/components/ui/Icon'

export function ExpenseCard({ expense, currency }: { expense: Expense; currency: string }) {
  const perPerson = expense.participants?.length ? expense.amount / expense.participants.length : expense.amount
  return (
    <Link to={`/expenses/${expense.id}`} className="expense-card">
      <div className="expense-main">
        <CategoryTile icon={expense.category?.icon} />
        <div>
          <p className="expense-title">{expense.description}</p>
          <p className="expense-meta">Paid by {expense.paid_by?.name} · {expense.participants?.length ?? 0} members</p>
        </div>
      </div>
      <div>
        <p className="expense-amount">{formatMoney(expense.amount, currency)}</p>
        <p className="expense-per">{formatMoney(perPerson, currency)}/person</p>
      </div>
    </Link>
  )
}
