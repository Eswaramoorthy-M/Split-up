// Display-only formatting. All real arithmetic happens in Postgres
// (NUMERIC(12,2)) via the get_group_balances / get_settlement_suggestions
// functions — the frontend never sums money itself for balance purposes.
const SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£'
}

export function currencySymbol(code: string): string {
  return SYMBOLS[code] ?? code + ' '
}

export function formatMoney(amount: number, currency = 'INR'): string {
  const symbol = currencySymbol(currency)
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Math.abs(amount))
  return `${symbol}${formatted}`
}

export function balanceLabel(netBalance: number, currency = 'INR'): { text: string; state: 'receive' | 'owe' | 'settled' } {
  if (Math.abs(netBalance) < 0.01) return { text: 'Settled up', state: 'settled' }
  if (netBalance > 0) return { text: `You get back ${formatMoney(netBalance, currency)}`, state: 'receive' }
  return { text: `You owe ${formatMoney(Math.abs(netBalance), currency)}`, state: 'owe' }
}

// ---- Cent-safe helpers (display/validation only; the database is the
// source of truth for balances). Working in whole cents avoids 0.1 + 0.2 bugs.
export const toCents = (n: number): number => Math.round((n || 0) * 100)

export function sameMoney(a: number, b: number): boolean {
  return toCents(a) === toCents(b)
}

export function sumMoney(values: number[]): number {
  return values.reduce((s, v) => s + toCents(v), 0) / 100
}
