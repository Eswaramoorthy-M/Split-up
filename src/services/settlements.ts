import { supabase } from '@/lib/supabase'
import type { PaymentMethod, Settlement, SettlementStatus } from '@/types'

export async function createSettlement(input: {
  group_id: string
  monthly_cycle_id?: string | null
  from_user_id: string
  to_user_id: string
  amount: number
  payment_method?: PaymentMethod
  upi_id_used?: string | null
}): Promise<Settlement> {
  const { data, error } = await supabase.from('settlements').insert(input).select().single()
  if (error) throw error
  return data as Settlement
}

export async function updateSettlementStatus(id: string, status: SettlementStatus): Promise<void> {
  const patch: Record<string, unknown> = { status }
  if (status === 'paid') patch.paid_at = new Date().toISOString()
  if (status === 'confirmed') patch.confirmed_at = new Date().toISOString()
  if (status === 'rejected') patch.rejected_at = new Date().toISOString()
  const { error } = await supabase.from('settlements').update(patch).eq('id', id)
  if (error) throw error
}

/**
 * The payer says they paid through their UPI app. Marking it "paid" keeps it in
 * the receiver's confirmation queue; the receiver can still reject it.
 */
export async function markSettlementPaidViaUpi(id: string, upiId: string): Promise<void> {
  const { error } = await supabase
    .from('settlements')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_method: 'upi',
      upi_id_used: upiId
    })
    .eq('id', id)
  if (error) throw error
}

export async function listSettlements(groupId: string): Promise<Settlement[]> {
  const { data, error } = await supabase
    .from('settlements')
    .select('*, from_profile:profiles!settlements_from_user_id_fkey(*), to_profile:profiles!settlements_to_user_id_fkey(*)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Settlement[]
}

/** Admin only: mark every pending / awaiting settlement as confirmed. */
export async function closeAllSettlements(groupId: string): Promise<number> {
  const { data, error } = await supabase.rpc('admin_close_settlements', { p_group_id: groupId })
  if (error) throw error
  return Number(data ?? 0)
}

/** Admin only: delete the settlement history and recalculate from expenses. */
export async function resetAllSettlements(groupId: string): Promise<number> {
  const { data, error } = await supabase.rpc('admin_reset_settlements', { p_group_id: groupId })
  if (error) throw error
  return Number(data ?? 0)
}
