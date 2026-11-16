/**
 * PWA runtime: registers the service worker and tracks two pieces of state
 * the UI cares about — "a new version is ready" and "the app can be
 * installed". Components read it through usePwa().
 */
import { useSyncExternalStore } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PwaState {
  updateReady: boolean
  canInstall: boolean
  isStandalone: boolean
  isIos: boolean
  online: boolean
}

let waitingWorker: ServiceWorker | null = null
let installEvent: BeforeInstallPromptEvent | null = null

const standaloneQuery = typeof window !== 'undefined' ? window.matchMedia('(display-mode: standalone)') : null

function detectStandalone() {
  return Boolean(standaloneQuery?.matches || (navigator as Navigator & { standalone?: boolean }).standalone)
}

let state: PwaState = {
  updateReady: false,
  canInstall: false,
  isStandalone: typeof window !== 'undefined' && detectStandalone(),
  isIos: typeof navigator !== 'undefined' &&
    (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)),
  online: typeof navigator === 'undefined' ? true : navigator.onLine
}

const listeners = new Set<() => void>()
function set(patch: Partial<PwaState>) {
  state = { ...state, ...patch }
  listeners.forEach(l => l())
}

export function usePwa() {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb) },
    () => state,
    () => state
  )
}

/** Show the browser's install dialog (Chrome, Edge, Android). */
export async function promptInstall(): Promise<boolean> {
  if (!installEvent) return false
  const e = installEvent
  installEvent = null
  set({ canInstall: false })
  await e.prompt()
  const { outcome } = await e.userChoice
  return outcome === 'accepted'
}

/** Activate the waiting service worker; the page reloads once it takes over. */
export function applyUpdate() {
  if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' })
  else window.location.reload()
}

export function dismissUpdate() {
  set({ updateReady: false })
}

function trackWaiting(reg: ServiceWorkerRegistration) {
  const markReady = (sw: ServiceWorker | null) => {
    // Only an *update* counts: on first install there is no controller yet.
    if (sw && navigator.serviceWorker.controller) {
      waitingWorker = sw
      set({ updateReady: true })
    }
  }
  if (reg.waiting) markReady(reg.waiting)
  reg.addEventListener('updatefound', () => {
    const sw = reg.installing
    if (!sw) return
    sw.addEventListener('statechange', () => {
      if (sw.state === 'installed') markReady(sw)
    })
  })
}

export function registerPwa() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault() // we show our own "Install app" button instead of the mini-infobar
    installEvent = e as BeforeInstallPromptEvent
    set({ canInstall: true })
  })
  window.addEventListener('appinstalled', () => {
    installEvent = null
    set({ canInstall: false, isStandalone: true })
  })
  standaloneQuery?.addEventListener?.('change', () => set({ isStandalone: detectStandalone() }))
  window.addEventListener('online', () => set({ online: true }))
  window.addEventListener('offline', () => set({ online: false }))

  // The dev server serves unbundled modules; a SW there only gets in the way.
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Fires after applyUpdate(). Skip the very first claim on a fresh install.
    if (reloading || !waitingWorker) return
    reloading = true
    window.location.reload()
  })

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      trackWaiting(reg)
      // Installed apps can stay open for days: look for a new deploy periodically
      // and whenever the app comes back to the foreground.
      const check = () => { reg.update().catch(() => {}) }
      setInterval(check, 60 * 60 * 1000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    } catch (err) {
      console.warn('Service worker registration failed', err)
    }
  })
}
