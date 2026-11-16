import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { AppNotification } from '@/types'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { Icon } from '@/components/ui/Icon'
import { PushNotificationCard } from '@/components/PushNotificationCard'
import { subscribeNotificationList } from '@/lib/liveNotifications'

const ICONS: Record<string, string> = {
  expense_added: 'plus', expense_edited: 'edit', expense_deleted: 'trash',
  member_joined: 'userPlus', settlement_created: 'exchange', settlement_paid: 'banknote',
  settlement_confirmed: 'checkCircle', cycle_closed: 'lock'
}

export default function Notifications() {
  const { user } = useAuth()
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { setItems((data ?? []) as AppNotification[]); setLoading(false) })
  }, [user])

  // New notifications appear here instantly while the app is open.
  useEffect(() => {
    if (!user) return
    return subscribeNotificationList(user.id, n => {
      setItems(prev => [n, ...prev.filter(x => x.id !== n.id)].slice(0, 50))
    })
  }, [user?.id])

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setItems(prev => prev.map(i => (i.id === id ? { ...i, is_read: true } : i)))
  }

  if (loading) return <div className="center-spinner"><Spinner /></div>

  return (
    <div>
      <h1 className="page-title">Notifications</h1>
      <div className="mt-md"><PushNotificationCard /></div>
      {items.length === 0 ? (
        <div className="mt-lg"><EmptyState title="You're all caught up" body="New activity in your groups will show up here." /></div>
      ) : (
        <div className="stack-sm mt-lg">
          {items.map(n => (
            <Card key={n.id} onClick={() => markRead(n.id)} className={clsx('notification', n.is_read && 'read')}>
              <span className="notification-icon" aria-hidden="true"><Icon name={ICONS[n.type] ?? 'bell'} size={19} /></span>
              <div className="flex-1">
                <p className="fw-medium">{n.title}</p>
                {n.message && <p className="text-sm muted">{n.message}</p>}
                <p className="text-xs faint mt-xs">{new Date(n.created_at).toLocaleString('en-IN')}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
