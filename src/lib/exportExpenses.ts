import type { Group } from '@/types'
import { listAllExpenses, listCycles } from '@/services/expenses'
import { listMembers } from '@/services/groups'
import { getGroupBalances } from '@/services/balances'
import { buildXlsx, downloadBlob, type CellValue } from '@/lib/excel'

const SPLIT_LABELS: Record<string, string> = {
  equal: 'Equal',
  unequal: 'Unequal',
  percentage: 'Percentage'
}

/**
 * Admin export: one .xlsx with every expense in the group (all months).
 *
 * Sheet "Expenses" — one row per expense: date, month, description, category,
 * who paid, total, split method, then ONE COLUMN PER MEMBER with that
 * member's share (empty when they were not part of the split), notes and who
 * added it. Former members keep their column so old splits stay complete.
 *
 * Sheet "Member summary" — per-member totals straight from the
 * get_group_balances database function (the source of truth for balances).
 */
export async function exportExpensesExcel(group: Group): Promise<void> {
  const [expenses, members, cycles, balances] = await Promise.all([
    listAllExpenses(group.id),
    listMembers(group.id),
    listCycles(group.id),
    getGroupBalances(group.id)
  ])

  const cycleLabel = new Map(cycles.map(c => [c.id, c.label]))

  // Member columns: active members first (join order), then anyone who still
  // appears in old payments/splits after leaving the group.
  const columns: { id: string; name: string }[] = members.map(m => ({
    id: m.user_id,
    name: m.profile?.name ?? 'Unknown member'
  }))
  const seen = new Set(columns.map(c => c.id))
  const addColumn = (id: string | null | undefined, name: string | null | undefined) => {
    if (!id || seen.has(id)) return
    seen.add(id)
    columns.push({ id, name: name ?? 'Former member' })
  }
  for (const e of expenses) {
    addColumn(e.paid_by_user_id, e.paid_by?.name)
    for (const p of e.participants ?? []) addColumn(p.user_id, p.profile?.name)
  }

  const money = (label: string) => `${label} (${group.currency})`
  const expenseRows: CellValue[][] = [
    ['Date', 'Month', 'Description', 'Category', 'Paid by', money('Amount'), 'Split',
      ...columns.map(c => c.name), 'Notes', 'Added by']
  ]
  for (const e of expenses) {
    const shareByUser = new Map((e.participants ?? []).map(p => [p.user_id, p.amount]))
    const splitType = e.participants?.[0]?.split_type
    expenseRows.push([
      e.expense_date,
      cycleLabel.get(e.monthly_cycle_id) ?? '',
      e.description,
      e.category?.name ?? '',
      e.paid_by?.name ?? '',
      e.amount,
      splitType ? SPLIT_LABELS[splitType] ?? splitType : '',
      ...columns.map(c => shareByUser.get(c.id) ?? null),
      e.notes ?? '',
      e.creator?.name ?? ''
    ])
  }

  const summaryRows: CellValue[][] = [
    ['Member', money('Total paid'), money('Total share'), money('Net balance')],
    ...balances.map(b => [b.name, b.total_paid, b.total_share, b.net_balance] as CellValue[])
  ]

  const workbook = buildXlsx([
    { name: 'Expenses', rows: expenseRows },
    { name: 'Member summary', rows: summaryRows }
  ])

  const slug = group.group_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'group'
  const today = new Date().toISOString().slice(0, 10)
  downloadBlob(workbook, `splitup-${slug}-expenses-${today}.xlsx`)
}
