import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import type { Group, GroupMember } from '@/types'

const ACTIVE_GROUP_KEY = 'splitup:activeGroupId'

interface GroupState {
  groups: Group[]
  activeGroup: Group | null
  activeMembership: GroupMember | null
  loading: boolean
  setActiveGroupId: (id: string) => void
  refreshGroups: () => Promise<void>
}

const GroupContext = createContext<GroupState | undefined>(undefined)

export function GroupProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id

  const [groups, setGroups] = useState<Group[]>([])
  const [memberships, setMemberships] = useState<GroupMember[]>([])
  const [activeGroupId, setActiveGroupIdState] = useState<string | null>(() => localStorage.getItem(ACTIVE_GROUP_KEY))
  // Which user's groups have been loaded. Until it matches the logged-in user
  // we report "loading", so a refresh keeps you on the page you were on
  // instead of bouncing to the group list for a split second.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  const refreshGroups = useCallback(async () => {
    if (!userId) return
    try {
      const { data } = await supabase
        .from('group_members')
        .select('group_id, role, id, joined_at, is_active, user_id, groups(*)')
        .eq('user_id', userId)
        .eq('is_active', true)
      const rows = (data ?? []) as any[]
      setMemberships(rows as GroupMember[])
      setGroups(rows.map(r => r.groups as Group).filter(Boolean))
    } finally {
      setLoadedFor(userId)
    }
  }, [userId])

  useEffect(() => {
    if (authLoading) return
    if (userId) {
      refreshGroups()
    } else {
      // Logged out: forget the previous person's group on this device.
      localStorage.removeItem(ACTIVE_GROUP_KEY)
      setActiveGroupIdState(null)
      setGroups([])
      setMemberships([])
      setLoadedFor(null)
    }
  }, [authLoading, userId, refreshGroups])

  const setActiveGroupId = useCallback((id: string) => {
    localStorage.setItem(ACTIVE_GROUP_KEY, id)
    setActiveGroupIdState(id)
  }, [])

  // Returning user: reopen the saved group, or the first one if the saved
  // group is gone, so login goes straight to the dashboard.
  useEffect(() => {
    if (loadedFor && groups.length > 0 && !groups.some(g => g.id === activeGroupId)) {
      setActiveGroupId(groups[0].id)
    }
  }, [loadedFor, groups, activeGroupId, setActiveGroupId])

  const activeGroup = useMemo(() => groups.find(g => g.id === activeGroupId) ?? null, [groups, activeGroupId])
  const activeMembership = useMemo(
    () => memberships.find(m => m.group_id === activeGroupId) ?? null,
    [memberships, activeGroupId]
  )
  const loading = authLoading || (Boolean(userId) && loadedFor !== userId)

  return (
    <GroupContext.Provider value={{ groups, activeGroup, activeMembership, loading, setActiveGroupId, refreshGroups }}>
      {children}
    </GroupContext.Provider>
  )
}

export function useGroup() {
  const ctx = useContext(GroupContext)
  if (!ctx) throw new Error('useGroup must be used within GroupProvider')
  return ctx
}
