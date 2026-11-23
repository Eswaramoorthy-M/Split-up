import { supabase } from '@/lib/supabase'
import type { Expense, SplitType } from '@/types'

export interface ParticipantInput {
  user_id: string
  amount: number
  percentage?: number | null
}

export interface ExpenseInput {
  group_id: string
  description: string
  amount: number
  category_id: string | null
  paid_by_user_id: string
  expense_date: string
  notes?: string | null
  receipt_path?: string | null
  split_type: SplitType
  participants: ParticipantInput[]
}

export type ExpenseUpdateInput = Omit<ExpenseInput, 'group_id' | 'receipt_path'>

/** Equal split in whole cents; odd cents go to the first people so the sum is exact. */
export function computeEqualShares(amount: number, memberIds: string[]): ParticipantInput[] {
  const cents = Math.round(amount * 100)
  const n = memberIds.length
  if (n === 0) return []
  const base = Math.floor(cents / n)
  const remainder = cents - base * n
  return memberIds.map((id, idx) => ({
    user_id: id,
    amount: (base + (idx < remainder ? 1 : 0)) / 100
  }))
}

/**
 * Turns percentages into amounts that add up to the total EXACTLY
 * (largest-remainder method), so 33.33% x 3 of ₹100.01 never drifts by a cent.
 */
export function allocateByPercent(amount: number, rows: ParticipantInput[]): ParticipantInput[] {
  const cents = Math.round(amount * 100)
  const raw = rows.map(r => (cents * (r.percentage || 0)) / 100)
  const floors = raw.map(v => Math.floor(v + 1e-9))
  const out = floors.slice()
  const totalPct = rows.reduce((s, r) => s + (r.percentage || 0), 0)
  let remainder = cents - floors.reduce((a, b) => a + b, 0)

  if (Math.abs(totalPct - 100) < 0.01 && remainder > 0) {
    const order = raw
      .map((v, i) => ({ i, frac: v - Math.floor(v + 1e-9) }))
      .sort((a, b) => b.frac - a.frac)
    for (let k = 0; remainder > 0 && k < order.length; k++, remainder--) out[order[k].i] += 1
  }
  return rows.map((r, i) => ({ ...r, amount: out[i] / 100 }))
}

function participantsPayload(split: SplitType, participants: ParticipantInput[]) {
  return participants.map(p => ({
    user_id: p.user_id,
    amount: p.amount,
    percentage: split === 'percentage' ? p.percentage ?? null : null
  }))
}

/** One atomic database call: expense + split are saved together or not at all. */
export async function createExpense(input: ExpenseInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_expense_full', {
    p_group_id: input.group_id,
    p_description: input.description,
    p_amount: input.amount,
    p_category_id: input.category_id,
    p_paid_by_user_id: input.paid_by_user_id,
    p_expense_date: input.expense_date,
    p_notes: input.notes ?? null,
    p_receipt_path: input.receipt_path ?? null,
    p_split_type: input.split_type,
    p_participants: participantsPayload(input.split_type, input.participants)
  })
  if (error) throw error
  return data as string
}

/** Updates the expense and replaces its per-member breakdown atomically. */
export async function updateExpense(expenseId: string, input: ExpenseUpdateInput): Promise<void> {
  const { error } = await supabase.rpc('update_expense_full', {
    p_expense_id: expenseId,
    p_description: input.description,
    p_amount: input.amount,
    p_category_id: input.category_id,
    p_paid_by_user_id: input.paid_by_user_id,
    p_expense_date: input.expense_date,
    p_notes: input.notes ?? null,
    p_split_type: input.split_type,
    p_participants: participantsPayload(input.split_type, input.participants)
  })
  if (error) throw error
}

/**
 * Soft delete via a SECURITY DEFINER RPC.
 * A direct `.update({ is_deleted: true })` is rejected by RLS: the expenses
 * SELECT policy hides deleted rows, and PostgREST checks the updated row
 * against that policy ("new row violates row-level security policy").
 * The RPC performs the same soft delete with an explicit owner/admin check.
 */
export async function deleteExpense(expenseId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_expense', { p_expense_id: expenseId })
  if (error) throw error
}

const EXPENSE_SELECT =
  '*, category:categories(*), paid_by:profiles!expenses_paid_by_user_id_fkey(*), creator:profiles!expenses_created_by_fkey(*), participants:expense_participants(*, profile:profiles(*))'

export async function listExpenses(
  groupId: string,
  opts: { page?: number; pageSize?: number; categoryId?: string; memberId?: string; search?: string } = {}
): Promise<{ data: Expense[]; count: number }> {
  const page = opts.page ?? 0
  const pageSize = opts.pageSize ?? 20
  let query = supabase
    .from('expenses')
    .select(EXPENSE_SELECT, { count: 'exact' })
    .eq('group_id', groupId)
    .eq('is_deleted', false)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)

  if (opts.categoryId) query = query.eq('category_id', opts.categoryId)
  if (opts.memberId) query = query.eq('paid_by_user_id', opts.memberId)
  if (opts.search) query = query.ilike('description', `%${opts.search}%`)

  const { data, error, count } = await query
  if (error) throw error
  return { data: (data ?? []) as unknown as Expense[], count: count ?? 0 }
}

export async function getExpense(expenseId: string): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .select(`${EXPENSE_SELECT}, cycle:monthly_cycles(id, status)`)
    .eq('id', expenseId)
    .eq('is_deleted', false)
    .single()
  if (error) throw error
  return data as unknown as Expense
}

/** Every expense in a month (or all months when cycleId is omitted) for the Manage screen. */
export async function listExpensesForManage(groupId: string, cycleId?: string): Promise<Expense[]> {
  let query = supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('group_id', groupId)
    .eq('is_deleted', false)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000)
  if (cycleId) query = query.eq('monthly_cycle_id', cycleId)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as Expense[]
}

/**
 * Every expense in the group, oldest first, for the admin Excel export.
 * Pages through the results because PostgREST caps a single request at 1000
 * rows — a plain .limit(1000) would silently truncate busy groups.
 */
export async function listAllExpenses(groupId: string): Promise<Expense[]> {
  const pageSize = 1000
  const all: Expense[] = []
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from('expenses')
      .select(EXPENSE_SELECT)
      .eq('group_id', groupId)
      .eq('is_deleted', false)
      .order('expense_date', { ascending: true })
      .order('created_at', { ascending: true })
      .range(page * pageSize, page * pageSize + pageSize - 1)
    if (error) throw error
    const rows = (data ?? []) as unknown as Expense[]
    all.push(...rows)
    if (rows.length < pageSize) break
  }
  return all
}

export async function listCycles(groupId: string) {
  const { data, error } = await supabase
    .from('monthly_cycles')
    .select('id, year, month, status')
    .eq('group_id', groupId)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
  if (error) throw error
  return (data ?? []).map((c: any) => ({
    id: c.id as string,
    year: c.year as number,
    month: c.month as number,
    status: c.status as 'open' | 'closed',
    label: new Date(c.year, c.month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  }))
}
