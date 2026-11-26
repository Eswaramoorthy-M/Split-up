import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { formatMoney } from '@/lib/money'
import type { SettlementSuggestion } from '@/types'
import { avatarColor, initials } from '../reportUtils'

interface Props {
  suggestions: SettlementSuggestion[]
  total: number
  currency: string
  isDark: boolean
}

export function PaymentBreakupCard({ suggestions, total, currency, isDark }: Props) {
  return (
    <Card className="report-card report-payment-card" data-animate>
      <div className="report-card-head">
        <div>
          <p className="report-card-label">Settlements</p>
          <h2 className="report-card-title">Payment breakup</h2>
        </div>
        {suggestions.length > 0 && (
          <span className="report-card-count">{suggestions.length} {suggestions.length === 1 ? 'payment' : 'payments'}</span>
        )}
      </div>

      {suggestions.length === 0 ? (
        <div className="report-settled">
          <span className="report-settled-icon" aria-hidden="true"><Icon name="checkCircle" size={24} /></span>
          <div>
            <strong>Everyone is settled up</strong>
            <p>No payments are pending for this month.</p>
          </div>
        </div>
      ) : (
        <div className="payment-list">
          {suggestions.map(suggestion => (
            <div
              key={`${suggestion.from_user}-${suggestion.to_user}`}
              className="payment-row"
              data-report-row="payment"
            >
              <div className="payment-people">
                <span className="payment-person">
                  <span
                    className="avatar"
                    style={{ background: avatarColor(suggestion.from_name, isDark) }}
                    aria-hidden="true"
                  >
                    {initials(suggestion.from_name)}
                  </span>
                  <span className="payment-name" title={suggestion.from_name}>{suggestion.from_name}</span>
                </span>
                <span className="payment-arrow" aria-hidden="true"><Icon name="arrowRight" size={18} /></span>
                <span className="payment-person">
                  <span
                    className="avatar"
                    style={{ background: avatarColor(suggestion.to_name, isDark) }}
                    aria-hidden="true"
                  >
                    {initials(suggestion.to_name)}
                  </span>
                  <span className="payment-name" title={suggestion.to_name}>{suggestion.to_name}</span>
                </span>
              </div>
              <span
                className="payment-amount count-value"
                data-count-value={suggestion.amount}
                data-count-currency={currency}
              >
                {formatMoney(suggestion.amount, currency)}
              </span>
            </div>
          ))}

          <div className="payment-footer" data-settle-total>
            <span>Total to settle</span>
            <span className="count-value" data-count-value={total} data-count-currency={currency}>
              {formatMoney(total, currency)}
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}
