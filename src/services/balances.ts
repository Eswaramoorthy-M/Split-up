import { supabase } from '@/lib/supabase'
import type { GroupBalance, SettlementSuggestion } from '@/types'

// Always defers to the get_group_balances Postgres function — the frontend
// never sums expense amounts itself to produce a balance figure.
export async function getGroupBalances(groupId: string, monthlyCycleId?: string): Promise<GroupBalance[]> {
  const { data, error } = await supabase.rpc('get_group_balances', {
    p_group_id: groupId,
    p_monthly_cycle_id: monthlyCycleId ?? null
  })
  if (error) throw error
  return (data ?? []) as GroupBalance[]
}

export async function getSettlementSuggestions(groupId: string, monthlyCycleId?: string): Promise<SettlementSuggestion[]> {
  const { data, error } = await supabase.rpc('get_settlement_suggestions', {
    p_group_id: groupId,
    p_monthly_cycle_id: monthlyCycleId ?? null
  })
  if (error) throw error
  return (data ?? []) as SettlementSuggestion[]
}
