import { useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase'
import type { AppNotification } from '@/types'

/**
 * Tiny live-notification store shared by the global toast and the
 * Notifications page. Realtime rows are also inserted by database triggers,
 * so this is the in-app companion to OS push.
 */
interface LiveState {
  latest: AppNotification | null
}

let state: LiveState = { latest: null }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(listener => listener())

let sequence = 0
function channelName(userId: string, scope: string) {
  sequence += 1
  return `notifications-${scope}:${userId}:${sequence}`
}

export function useLiveNotification() {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb) },
    () => state,
    () => state
  )
}

export function dismissLiveNotification() {
  if (!state.latest) return
  state = { latest: null }
  emit()
}

/** Subscribe the global toast to this user's new notifications. */
export function subscribeLiveToasts(userId: string): () => void {
  const channel = supabase
    .channel(channelName(userId, 'toast'))
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      payload => {
        state = { latest: payload.new as unknown as AppNotification }
        emit()
      }
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

/** Subscribe the Notifications list to live inserts (no toast). */
export function subscribeNotificationList(
  userId: string,
  onInsert: (notification: AppNotification) => void
): () => void {
  const channel = supabase
    .channel(channelName(userId, 'list'))
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      payload => onInsert(payload.new as unknown as AppNotification)
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}
