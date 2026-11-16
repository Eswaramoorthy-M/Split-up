import { supabase } from '@/lib/supabase'
import type { Group, GroupMember, Category, SplitType } from '@/types'

export async function createGroup(input: {
  group_name: string
  description?: string
  currency: string
  default_split_method: SplitType
}): Promise<Group> {
  const { data: userRes } = await supabase.auth.getUser()
  if (!userRes.user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('groups')
    .insert({ ...input, created_by: userRes.user.id })
    .select()
    .single()

  if (error) throw error
  return data as Group
}

export async function joinGroupByCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_group_by_code', { p_code: code.trim().toUpperCase() })
  if (error) throw error
  return data as string
}

export async function listMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*, profile:profiles(*)')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .order('joined_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as GroupMember[]
}

export async function setMemberRole(memberId: string, role: 'admin' | 'member') {
  const { error } = await supabase.from('group_members').update({ role }).eq('id', memberId)
  if (error) throw error
}

export async function removeMember(memberId: string) {
  // Never hard-delete — preserve history, just deactivate.
  const { error } = await supabase.from('group_members').update({ is_active: false }).eq('id', memberId)
  if (error) throw error
}

export async function listCategories(groupId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .or(`group_id.eq.${groupId},group_id.is.null`)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
  if (error) throw error
  return (data ?? []) as Category[]
}

export async function createCategory(groupId: string, name: string, icon = '🧾') {
  const { data, error } = await supabase
    .from('categories')
    .insert({ group_id: groupId, name, icon })
    .select()
    .single()
  if (error) throw error
  return data as Category
}

export interface AddMemberResult {
  ok: boolean
  created: boolean // false = that email already had an account and was just added to the group
  user_id: string
}

/**
 * Admin-only: creates a login for a new member and adds them to the group.
 * Runs in the `add-member` Supabase Edge Function (it needs a secret key that
 * can never be placed in browser code); the function re-checks admin rights.
 */
export async function addMemberByAdmin(input: {
  group_id: string
  name: string
  email: string
  password: string
}): Promise<AddMemberResult> {
  const { data, error } = await supabase.functions.invoke('add-member', { body: input })

  if (error) {
    let message = error.message
    try {
      const body = await (error as any).context?.json?.()
      if (body?.error) message = body.error
    } catch { /* keep the generic message */ }
    if (/not found|404/i.test(message) && !/member/i.test(message)) {
      message = 'The add-member function is not deployed yet. Deploy it in Supabase (Edge Functions) first.'
    }
    throw new Error(message)
  }
  return data as AddMemberResult
}
