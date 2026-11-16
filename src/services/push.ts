import { supabase } from '@/lib/supabase'

// Public half of the VAPID key pair. Safe to ship in the browser bundle.
// Generate a pair with `npm run vapid` and paste it into .env.
const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '').trim()

export interface PushStatus {
  supported: boolean
  configured: boolean
  permission: NotificationPermission
  subscribed: boolean
  needsInstall: boolean
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined'
    && window.isSecureContext
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

export function pushConfigured(): boolean {
  return VAPID_PUBLIC_KEY.length > 0
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

async function activeRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration()
  if (!existing) {
    throw new Error('Push notifications only work in the installed app or a production build, not the dev server.')
  }
  return navigator.serviceWorker.ready
}

async function saveSubscription(sub: PushSubscription): Promise<void> {
  const { data: who, error: whoError } = await supabase.auth.getUser()
  if (whoError || !who.user) throw new Error('You need to be signed in to turn on notifications.')

  const json = sub.toJSON()
  const keys = json.keys ?? {}
  if (!json.endpoint || !keys.p256dh || !keys.auth) {
    throw new Error('The browser did not return a usable push subscription.')
  }

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: who.user.id,
    endpoint: json.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    user_agent: navigator.userAgent,
    updated_at: new Date().toISOString()
  }, { onConflict: 'endpoint' })

  if (error) throw error
}

export async function getPushStatus(): Promise<PushStatus> {
  const supported = pushSupported()
  const permission: NotificationPermission = supported ? Notification.permission : 'default'
  let subscribed = false

  if (supported && permission === 'granted') {
    const registration = await navigator.serviceWorker.getRegistration()
    const sub = await registration?.pushManager.getSubscription()
    subscribed = Boolean(sub)
  }

  return {
    supported,
    configured: pushConfigured(),
    permission,
    subscribed,
    needsInstall: supported && isIos() && !isStandalone()
  }
}

/** Ask for permission and subscribe this device (must be called from a tap). */
export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error('This browser does not support push notifications.')
  if (!pushConfigured()) throw new Error('Push is not configured. Add VITE_VAPID_PUBLIC_KEY to .env and redeploy.')
  if (isIos() && !isStandalone()) {
    throw new Error('On iPhone and iPad, add SplitUp to your Home Screen first, then turn on notifications.')
  }

  const permission = await Notification.requestPermission()
  if (permission === 'denied') {
    throw new Error('Notifications are blocked. Allow them for this site in your browser settings.')
  }
  if (permission !== 'granted') {
    throw new Error('Notifications were not turned on.')
  }

  const registration = await activeRegistration()
  const existing = await registration.pushManager.getSubscription()
  const sub = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  })

  await saveSubscription(sub)
}

/** Unsubscribe this device and remove it from the database. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return
  const registration = await navigator.serviceWorker.getRegistration()
  const sub = await registration?.pushManager.getSubscription()
  if (!sub) return
  const { endpoint } = sub
  await sub.unsubscribe().catch(() => {})
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}

/** Refresh endpoint keys after a browser rotation. Failures are non-fatal. */
export async function syncPushSubscription(): Promise<void> {
  if (!pushSupported() || !pushConfigured() || Notification.permission !== 'granted') return
  const registration = await navigator.serviceWorker.getRegistration()
  const sub = await registration?.pushManager.getSubscription()
  if (sub) await saveSubscription(sub)
}
