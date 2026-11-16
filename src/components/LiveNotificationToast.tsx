import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { dismissLiveNotification, subscribeLiveToasts, useLiveNotification } from '@/lib/liveNotifications'
import { Icon } from '@/components/ui/Icon'

/** In-app toast for new notifications while the app is open (Realtime). */
export function LiveNotificationToast() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { latest } = useLiveNotification()

  useEffect(() => {
    if (!user) return
    return subscribeLiveToasts(user.id)
  }, [user?.id])

  // Auto-dismiss so the toast never blocks the bottom action bar.
  useEffect(() => {
    if (!latest) return
    const timer = setTimeout(dismissLiveNotification, 8000)
    return () => clearTimeout(timer)
  }, [latest?.id])

  if (!latest) return null

  return (
    <div className="pwa-toast live-toast" role="status">
      <Icon name="bell" size={18} />
      <div className="flex-1 live-toast-text">
        <p className="live-toast-title">{latest.title}</p>
        {latest.message && <p className="live-toast-body">{latest.message}</p>}
      </div>
      <button
        type="button"
        className="pwa-toast-action"
        onClick={() => { dismissLiveNotification(); navigate('/notifications') }}
      >
        View
      </button>
      <button type="button" className="pwa-toast-close" onClick={dismissLiveNotification} aria-label="Dismiss">
        <Icon name="x" size={16} />
      </button>
    </div>
  )
}
