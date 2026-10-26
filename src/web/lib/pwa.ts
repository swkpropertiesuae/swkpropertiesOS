/** Installable web app (PWA): service worker registration, update prompt and install prompt. */
import { useSyncExternalStore } from 'react'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
type State = { canInstall: boolean; installed: boolean; updateReady: boolean }

let deferred: InstallEvent | null = null
let waiting: ServiceWorker | null = null
let state: State = { canInstall: false, installed: false, updateReady: false }
const listeners = new Set<() => void>()
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; listeners.forEach(l => l()) }

export const isStandalone = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true)
export const isIosBrowser = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone()

export function startPwa() {
  if (typeof window === 'undefined') return
  state = { ...state, installed: isStandalone() }
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallEvent; set({ canInstall: true }) })
  window.addEventListener('appinstalled', () => { deferred = null; set({ canInstall: false, installed: true }) })
  // The service worker only runs in production builds so development hot reload is not cached.
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      const watch = (sw: ServiceWorker | null) => {
        if (!sw) return
        sw.addEventListener('statechange', () => { if (sw.state === 'installed' && navigator.serviceWorker.controller) { waiting = sw; set({ updateReady: true }) } })
      }
      if (reg.waiting && navigator.serviceWorker.controller) { waiting = reg.waiting; set({ updateReady: true }) }
      watch(reg.installing)
      reg.addEventListener('updatefound', () => watch(reg.installing))
      setInterval(() => { void reg.update().catch(() => {}) }, 60 * 60 * 1000)
    }).catch(() => { /* installability is optional: the app works without it */ })
    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; window.location.reload() })
  })
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable'
  const e = deferred
  deferred = null; set({ canInstall: false })
  await e.prompt()
  return (await e.userChoice).outcome
}
export const applyUpdate = () => { if (waiting) waiting.postMessage('SKIP_WAITING'); else window.location.reload() }

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export const usePwa = () => useSyncExternalStore(subscribe, () => state, () => state)
