import { formatMoney } from '@/lib/money'

/** Text shown while the split "remaining / over by" number tweens. */
export function formatSplitProxy(value: number, mode: string, currency: string): string {
  if (mode === 'percentage') {
    const diff = +value.toFixed(2)
    return Math.abs(diff) < 0.01
      ? 'Adds up to 100%'
      : `${diff > 0 ? 'Remaining' : 'Over by'} ${Math.abs(diff)}%`
  }
  if (mode === 'unequal') {
    const cents = Math.round(value)
    return cents === 0
      ? 'Adds up to the total'
      : `${cents > 0 ? 'Remaining' : 'Over by'} ${formatMoney(Math.abs(cents) / 100, currency)}`
  }
  return 'Evenly split'
}
