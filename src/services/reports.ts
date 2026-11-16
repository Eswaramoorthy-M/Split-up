import { supabase } from '@/lib/supabase'

export interface CategoryTotal { category: string; icon: string; total: number }

/** Spending per category for one month. Added up in whole cents, so totals never drift. */
export async function getCategoryBreakdown(groupId: string, monthlyCycleId: string): Promise<CategoryTotal[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('amount, category:categories(name, icon)')
    .eq('group_id', groupId)
    .eq('monthly_cycle_id', monthlyCycleId)
    .eq('is_deleted', false)
  if (error) throw error

  const map = new Map<string, { category: string; icon: string; cents: number }>()
  for (const row of (data ?? []) as any[]) {
    const name = row.category?.name ?? 'Other'
    const entry = map.get(name) ?? { category: name, icon: row.category?.icon ?? '🧾', cents: 0 }
    entry.cents += Math.round(Number(row.amount) * 100)
    map.set(name, entry)
  }
  return Array.from(map.values())
    .map(e => ({ category: e.category, icon: e.icon, total: e.cents / 100 }))
    .sort((a, b) => b.total - a.total)
}
