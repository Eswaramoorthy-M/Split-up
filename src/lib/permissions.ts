import type { Expense } from '@/types'

export interface ManageDecision {
  allowed: boolean
  reason?: string
}

/**
 * Who can change an expense:
 *  - the person who added it, or
 *  - a group admin (any expense),
 * and never while its month is closed.
 * The database enforces the same rules (RLS + triggers); this just lets the
 * UI hide buttons and explain why.
 */
export function canManageExpense(opts: {
  expense: Expense
  userId?: string
  role?: string
  cycleClosed: boolean
}): ManageDecision {
  const { expense, userId, role, cycleClosed } = opts
  if (cycleClosed) {
    return { allowed: false, reason: 'This month is closed. An admin can reopen it in Group settings.' }
  }
  if (role === 'admin' || expense.created_by === userId) return { allowed: true }
  return { allowed: false, reason: 'Only the person who added this expense, or an admin, can change it.' }
}
