import type { Expense, GroupBalance, SettlementSuggestion } from '@/types'
import { formatMoney, sumMoney } from '@/lib/money'
import { alertDialog } from '@/lib/dialogs'

/** Opens the phone's share sheet when available, otherwise copies to the clipboard. */
export async function shareText(text: string, title: string): Promise<'shared' | 'copied' | 'cancelled'> {
  if (navigator.share) {
    try { await navigator.share({ text, title }); return 'shared' } catch { return 'cancelled' }
  }
  await navigator.clipboard.writeText(text)
  return 'copied'
}

export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`

async function share(text: string, title: string) {
  if ((await shareText(text, title)) === 'copied') {
    await alertDialog({
      title: 'Copied to clipboard',
      message: 'Paste it into WhatsApp or anywhere you like.',
      tone: 'success'
    })
  }
}

export function shareExpense(expense: Expense, currency: string) {
  const perPerson = expense.participants?.length ? expense.amount / expense.participants.length : expense.amount
  const text = [
    'Expense Added',
    '',
    expense.description,
    formatMoney(expense.amount, currency),
    '',
    `Paid by: ${expense.paid_by?.name}`,
    `Split between: ${expense.participants?.length ?? 0} members`,
    `${formatMoney(perPerson, currency)}/person`
  ].join('\n')
  return share(text, 'Expense Added')
}

export function shareSettlementSuggestions(suggestions: SettlementSuggestion[], currency: string) {
  const total = suggestions.reduce((s, x) => s + x.amount, 0)
  const lines = [
    'Settlement',
    '',
    ...suggestions.map(s => `${s.from_name} → ${s.to_name}\n${formatMoney(s.amount, currency)}`),
    '',
    `Total Pending: ${formatMoney(total, currency)}`
  ]
  return share(lines.join('\n'), 'Settlement')
}

export function shareMonthlySummary(opts: {
  monthLabel: string
  totalExpenses: number
  currency: string
  pending: SettlementSuggestion[]
}) {
  const totalPending = opts.pending.reduce((s, x) => s + x.amount, 0)
  const lines = [
    `${opts.monthLabel} Expense Summary`,
    '',
    `Total Expenses: ${formatMoney(opts.totalExpenses, opts.currency)}`,
    '',
    'Pending Settlements:',
    ...opts.pending.map(p => `${p.from_name} → ${p.to_name} ${formatMoney(p.amount, opts.currency)}`),
    '',
    `Total Pending: ${formatMoney(totalPending, opts.currency)}`
  ]
  return share(lines.join('\n'), `${opts.monthLabel} Summary`)
}

export interface ReportData {
  groupName: string
  monthLabel: string
  currency: string
  categories: { category: string; icon: string; total: number }[]
  balances: GroupBalance[]
  suggestions: SettlementSuggestion[]
}

/**
 * Plain-text monthly report, formatted for WhatsApp (*bold* headings):
 * category-wise totals, member summary, and who has to pay whom.
 */
export function buildReportText(d: ReportData): string {
  const money = (n: number) => formatMoney(n, d.currency)
  const total = sumMoney(d.categories.map(c => c.total))
  const toSettle = sumMoney(d.suggestions.map(s => s.amount))
  const lines: string[] = []

  lines.push(`*${d.monthLabel} - Expense Report*`, d.groupName, '')

  lines.push('*Category-wise breakdown*')
  if (d.categories.length === 0) lines.push('No expenses yet')
  d.categories.forEach(c => lines.push(`${c.icon} ${c.category}: ${money(c.total)}`))
  lines.push('', `*Total Expenses: ${money(total)}*`, '')

  lines.push('*Member summary*')
  d.balances.forEach(b => {
    const state =
      Math.abs(b.net_balance) < 0.005 ? 'settled'
      : b.net_balance > 0 ? `gets back ${money(b.net_balance)}`
      : `owes ${money(b.net_balance)}`
    lines.push(`${b.name}: paid ${money(b.total_paid)}, share ${money(b.total_share)} (${state})`)
  })
  lines.push('')

  lines.push('*Payment breakup*')
  if (d.suggestions.length === 0) {
    lines.push('Everyone is settled up 🎉')
  } else {
    d.suggestions.forEach(s => lines.push(`${s.from_name} to pay ${s.to_name}: ${money(s.amount)}`))
    lines.push(`Total to settle: ${money(toSettle)}`)
  }
  return lines.join('\n')
}
