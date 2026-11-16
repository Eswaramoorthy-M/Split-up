import { applyUpdate, dismissUpdate, usePwa } from '@/pwa'
import { Icon } from '@/components/ui/Icon'
import { LiveNotificationToast } from '@/components/LiveNotificationToast'

/** App-wide toasts: live notifications, "new version available" and "you're offline". */
export function PwaPrompts() {
  const { updateReady, online } = usePwa()

  return (
    <div className="pwa-toasts" aria-live="polite">
      <LiveNotificationToast />
      {!online && (
        <div className="pwa-toast pwa-toast-offline" role="status">
          <Icon name="alert" size={18} />
          <span className="flex-1">You’re offline. Changes can’t be saved until you reconnect.</span>
        </div>
      )}
      {updateReady && (
        <div className="pwa-toast" role="status">
          <Icon name="refresh" size={18} />
          <span className="flex-1">A new version of SplitUp is ready.</span>
          <button type="button" className="pwa-toast-action" onClick={applyUpdate}>Update</button>
          <button type="button" className="pwa-toast-close" onClick={dismissUpdate} aria-label="Later">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
