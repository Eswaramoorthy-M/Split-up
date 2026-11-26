import clsx from 'clsx'
import { Link } from 'react-router-dom'
import type { Expense } from '@/types'
import { formatMoney } from '@/lib/money'
import { CategoryTile, Icon } from '@/components/ui/Icon'

interface Props {
  expense: Expense
  currency: string
  /** Adds the premium history styling without changing the shared card styles. */
  premium?: boolean
  className?: string
}

export function ExpenseCard({ expense, currency, premium = false, className }: Props) {
  const perPerson = expense.participants?.length ? expense.amount / expense.participants.length : expense.amount
  const paidBy = expense.paid_by?.name ?? 'a member'
  const participantCount = expense.participants?.length ?? 0
  const date = new Date(expense.expense_date).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  })

  return (
    <Link
      to={`/expenses/${expense.id}`}
      className={clsx('expense-card', premium && 'expense-card-premium', className)}
      data-expense-id={expense.id}
      aria-label={`${expense.description}, ${formatMoney(expense.amount, currency)}, paid by ${paidBy}`}
    >
      <span className="expense-card-tile">
        <CategoryTile icon={expense.category?.icon} />
      </span>

      <span className="expense-card-copy">
        <span className="expense-title">{expense.description}</span>
        <span className="expense-meta">Paid by {paidBy} · {participantCount} members</span>
        <span className="expense-cell expense-cell--paidby">
          <Icon name="user" size={14} />{paidBy}
        </span>
        <span className="expense-cell expense-cell--date">
          <Icon name="calendar" size={14} />{date}
        </span>
      </span>

      <span className="expense-card-right">
        <span className="expense-amount">{formatMoney(expense.amount, currency)}</span>
        <span className="expense-per">{formatMoney(perPerson, currency)}/person</span>
      </span>

      <span className="expense-card-chevron" aria-hidden="true">
        <Icon name="chevronRight" size={16} />
      </span>
    </Link>
  )
}
