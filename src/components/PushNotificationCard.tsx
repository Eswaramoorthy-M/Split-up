import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { disablePush, enablePush, getPushStatus, syncPushSubscription } from '@/services/push'
import type { PushStatus } from '@/services/push'

/**
 * Enable / disable free Web Push notifications for this device.
 * Browsers require the permission prompt to come from a real user tap,
 * which is why this is a button and not an automatic prompt on load.
 */
export function PushNotificationCard() {
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const refresh = async () => {
    try { setStatus(await getPushStatus()) } catch { /* leave the last known state */ }
  }

  useEffect(() => { refresh() }, [])

  // Keep the stored endpoint fresh if the browser rotated it.
  useEffect(() => {
    if (status?.subscribed) syncPushSubscription().catch(() => {})
  }, [status?.subscribed])

  const toggle = async () => {
    if (!status) return
    setBusy(true)
    setMessage(null)
    try {
      if (status.subscribed) {
        await disablePush()
        setMessage({ ok: true, text: 'Push notifications are off for this device.' })
      } else {
        await enablePush()
        setMessage({ ok: true, text: 'Push notifications are on for this device.' })
      }
      await refresh()
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not update notifications.' })
    } finally {
      setBusy(false)
    }
  }

  const supported = status?.supported ?? false
  const configured = status?.configured ?? false
  const blocked = status?.permission === 'denied'
  const needsInstall = status?.needsInstall ?? false
  const canToggle = supported && configured && !blocked && !needsInstall && Boolean(status)

  const statusText = !status
    ? 'Checking this device…'
    : !supported
      ? 'This browser does not support push notifications.'
      : !configured
        ? 'Push is not set up on this deployment yet.'
        : blocked
          ? 'Notifications are blocked. Allow them for this site in your browser settings.'
          : needsInstall
            ? 'On iPhone and iPad, add SplitUp to your Home Screen first.'
            : status.subscribed
              ? 'On for this device — alerts arrive even when the app is closed.'
              : 'Off. Turn on alerts for new expenses, settlements and month changes.'

  return (
    <Card>
      <div className="push-card">
        <span className="notification-icon" aria-hidden="true"><Icon name="bell" size={19} /></span>
        <div className="flex-1">
          <p className="fw-semibold">Push notifications</p>
          <p className="text-sm muted">{statusText}</p>
        </div>
        {canToggle && (
          <Button
            variant={status!.subscribed ? 'secondary' : 'primary'}
            disabled={busy}
            onClick={toggle}
          >
            {busy ? 'Saving…' : status!.subscribed ? 'Turn off' : 'Turn on'}
          </Button>
        )}
      </div>
      {message && (
        <p className={`banner ${message.ok ? 'banner-ok' : 'banner-error'} mt-sm`} role={message.ok ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}
    </Card>
  )
}
