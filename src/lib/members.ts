import type { Expense, GroupMember } from '@/types'

/**
 * Members who left the group still appear on old expenses (history is never
 * deleted). When editing such an expense we add them back to the picker,
 * marked "(left)", so saving does not silently drop them from the split.
 */
export function withHistoricalParticipants(members: GroupMember[], expense: Expense): GroupMember[] {
  const known = new Set(members.map(m => m.user_id))
  const extra: GroupMember[] = []

  const add = (userId: string, profile?: GroupMember['profile']) => {
    if (known.has(userId)) return
    known.add(userId)
    extra.push({
      id: userId,
      group_id: expense.group_id,
      user_id: userId,
      role: 'member',
      joined_at: '',
      is_active: false,
      profile: profile ? { ...profile, name: `${profile.name} (left)` } : undefined
    })
  }

  expense.participants?.forEach(p => add(p.user_id, p.profile))
  add(expense.paid_by_user_id, expense.paid_by)
  return [...members, ...extra]
}
