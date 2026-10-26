export interface DeviceIdentity {
  device_id: string
  device_name: string
  model: string
  manufacturer: string
  os_version: string
  app_version: string
  is_native_android: boolean
  biometric_supported: boolean
}

export interface GpsPosition {
  lat: string
  lng: string
  accuracy_m: number
  timestamp: string
}

export interface OfflineQueueItem {
  idempotency_key: string
  client_queue_id: string
  action_type: string
  /** API path the action is replayed against when connectivity returns (see /api/swk-one/offline/sync). */
  endpoint?: string
  label: string
  payload: Record<string, any>
  queued_at: string
}

const DEVICE_STORAGE_KEY = 'swk.one.device_id'
const OFFLINE_QUEUE_KEY = 'swk.one.offline_queue'
const SESSION_TOKEN_KEY = 'swk.one.session_token'
const SERVER_URL_KEY = 'swk.one.server_url'

type SwkBridge = {
  getDefaultServerUrl?: () => string
  getDeviceIdentityJson?: () => string
  startDutyLocationService?: (paramsJson: string) => string
  stopDutyLocationService?: () => string
  getTelemetryJson?: () => string
  isBiometricAvailable?: () => boolean
  promptBiometricUnlock?: (reason: string) => void
}
const bridge = (): SwkBridge | null => (typeof window !== 'undefined' ? ((window as any).SwkAndroidBridge ?? null) : null)

/** True inside the SWK ONE Android app (native bridge present) or when opened with ?platform=android for testing. */
export function isNativeAndroid(): boolean {
  if (typeof window === 'undefined') return false
  if (bridge()) return true
  return new URLSearchParams(window.location.search).get('platform') === 'android'
}

/** Inside the app the bundled UI is served from https://localhost, so the API lives on the company server, never on the page origin. */
export function getStoredServerUrl(): string {
  try {
    const stored = localStorage.getItem(SERVER_URL_KEY)
    if (stored) return stored
  } catch { /* fall through to the app default */ }
  try {
    return bridge()?.getDefaultServerUrl?.().replace(/\/+$/, '') || ''
  } catch {
    return ''
  }
}

export function setStoredServerUrl(url: string) {
  try {
    const clean = url.trim().replace(/\/+$/, '')
    if (clean) localStorage.setItem(SERVER_URL_KEY, clean)
    else localStorage.removeItem(SERVER_URL_KEY)
  } catch { /* ignore */ }
}

export function getStoredSessionToken(): string {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setStoredSessionToken(token: string | null) {
  try {
    if (token) localStorage.setItem(SESSION_TOKEN_KEY, token)
    else localStorage.removeItem(SESSION_TOKEN_KEY)
  } catch { /* ignore */ }
}

export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  const native = bridge()
  if (native?.getDeviceIdentityJson) {
    try {
      const info = JSON.parse(native.getDeviceIdentityJson())
      if (info?.device_id) {
        try { localStorage.setItem(DEVICE_STORAGE_KEY, info.device_id) } catch { /* ignore */ }
        return {
          device_id: info.device_id,
          device_name: info.device_name || `${info.manufacturer || 'Android'} ${info.model || 'handset'}`,
          model: info.model || 'Android',
          manufacturer: info.manufacturer || 'Android',
          os_version: info.os_version || 'Android',
          app_version: info.app_version || '',
          is_native_android: true,
          biometric_supported: info.biometric_supported === true,
        }
      }
    } catch { /* fall back to a browser identity below */ }
  }

  // Browser / PWA: a stable per-browser id that describes what it really is. It is never presented as a handset.
  let devId = ''
  try {
    devId = localStorage.getItem(DEVICE_STORAGE_KEY) || ''
    if (!devId) {
      devId = `WEB-${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 12).toUpperCase()}`
      localStorage.setItem(DEVICE_STORAGE_KEY, devId)
    }
  } catch {
    devId = 'WEB-UNKNOWN'
  }
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  return {
    device_id: devId,
    device_name: /Android/i.test(ua) ? 'Android browser' : 'Web browser',
    model: 'Browser',
    manufacturer: '',
    os_version: typeof navigator !== 'undefined' ? navigator.platform || 'Unknown' : 'Unknown',
    app_version: 'web',
    is_native_android: false,
    biometric_supported: false,
  }
}

export async function authenticateBiometricSession(
  reason = 'Unlock SWK ONE Staff & Agent Workspace',
): Promise<{ verified: boolean; method: string }> {
  const native = bridge()
  if (!native?.promptBiometricUnlock) return { verified: false, method: 'Unavailable' }
  return new Promise(resolve => {
    const handler = (ev: any) => {
      window.removeEventListener('swk:biometric-result', handler)
      resolve({ verified: !!ev?.detail?.verified, method: ev?.detail?.method || 'Android BiometricPrompt' })
    }
    window.addEventListener('swk:biometric-result', handler)
    native.promptBiometricUnlock!(reason)
  })
}

/** A real location fix or an error: the app never substitutes made-up coordinates (they would become attendance / duty evidence). */
export async function getCurrentGpsPosition(): Promise<GpsPosition> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) throw new Error('Location is not available on this device')
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 })
    })
    return {
      lat: Number(pos.coords.latitude).toFixed(6),
      lng: Number(pos.coords.longitude).toFixed(6),
      accuracy_m: Math.round(pos.coords.accuracy || 0),
      timestamp: new Date(pos.timestamp || Date.now()).toISOString(),
    }
  } catch (e: any) {
    throw new Error(e?.code === 1 ? 'Location permission is off. Allow location for SWK ONE and try again.' : 'Could not get a location fix. Move to open sky or check that location is on, then try again.')
  }
}

export interface DutyServiceResult {
  fgServiceActive: boolean
  notificationTitle: string
  /** Set when the native service did not start, e.g. "location_permission_required". */
  reason?: string
}

export async function startNativeForegroundDutyService(opts: {
  sessionId?: number
  assignedLocation?: string
  serverUrl?: string
  sessionToken?: string
  deviceId?: string
}): Promise<DutyServiceResult> {
  const title = `SWK ONE: Active Field Duty (${opts.assignedLocation || 'field duty'})`
  const native = bridge()
  if (!native?.startDutyLocationService) return { fgServiceActive: false, notificationTitle: title, reason: 'not_native' }
  try {
    const res = JSON.parse(native.startDutyLocationService(JSON.stringify({
      sessionId: Number(opts.sessionId || 0),
      assignedLocation: opts.assignedLocation || '',
      serverUrl: opts.serverUrl || getStoredServerUrl(),
      sessionToken: opts.sessionToken || getStoredSessionToken(),
      deviceId: opts.deviceId || '',
    })))
    return { fgServiceActive: !!res.started, notificationTitle: title, reason: res.reason }
  } catch {
    return { fgServiceActive: false, notificationTitle: title, reason: 'start_failed' }
  }
}

export async function stopNativeForegroundDutyService(): Promise<{ stopped: boolean }> {
  try {
    bridge()?.stopDutyLocationService?.()
  } catch { /* ignore */ }
  return { stopped: true }
}

export async function getBatteryAndNetworkTelemetry(): Promise<{
  battery_pct: number | null
  is_charging: boolean
  online: boolean
  network_type: string
}> {
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true
  const native = bridge()
  if (native?.getTelemetryJson) {
    try {
      const t = JSON.parse(native.getTelemetryJson())
      return {
        battery_pct: typeof t.battery_pct === 'number' && t.battery_pct >= 0 ? t.battery_pct : null,
        is_charging: !!t.is_charging,
        online: online && t.network_type !== 'Offline',
        network_type: t.network_type || (online ? 'Online' : 'Offline'),
      }
    } catch { /* fall through to browser APIs */ }
  }
  let batteryPct: number | null = null
  let isCharging = false
  try {
    const b = await (navigator as any)?.getBattery?.()
    if (b && typeof b.level === 'number') batteryPct = Math.round(b.level * 100)
    isCharging = !!b?.charging
  } catch { /* ignore */ }
  const conn = typeof navigator !== 'undefined' ? (navigator as any).connection : null
  return { battery_pct: batteryPct, is_charging: isCharging, online, network_type: !online ? 'Offline' : conn?.type === 'wifi' ? 'Wi-Fi' : conn?.effectiveType ? String(conn.effectiveType).toUpperCase() : 'Online' }
}

export function getOfflineQueue(): OfflineQueueItem[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]')
  } catch {
    return []
  }
}

export function enqueueOfflineAction(
  action_type: string,
  labelOrPayload: string | Record<string, any>,
  maybePayload?: Record<string, any>,
  endpoint?: string,
): OfflineQueueItem {
  const label = typeof labelOrPayload === 'string' ? labelOrPayload : action_type
  const payload = (typeof labelOrPayload === 'object' && labelOrPayload !== null ? labelOrPayload : maybePayload) || {}
  const key = `OFF-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  const item: OfflineQueueItem = {
    idempotency_key: key,
    client_queue_id: key,
    action_type,
    endpoint,
    label,
    payload,
    queued_at: new Date().toISOString(),
  }
  const current = getOfflineQueue()
  const updated = [item, ...current]
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated))
  } catch { /* ignore */ }
  return item
}

export function clearSyncedOfflineItems(keys?: string[]) {
  if (!keys || keys.length === 0) {
    clearAllOfflineQueue()
    return []
  }
  const set = new Set(keys)
  const current = getOfflineQueue().filter(i => !set.has(i.idempotency_key) && !set.has(i.client_queue_id))
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(current))
  } catch { /* ignore */ }
  return current
}

export function clearOfflineQueueItem(idempotencyKey: string) {
  const current = getOfflineQueue().filter(i => i.idempotency_key !== idempotencyKey)
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(current))
  } catch { /* ignore */ }
  return current
}

export function clearAllOfflineQueue() {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY)
  } catch { /* ignore */ }
}

export function openAndroidMapsNavigation(lat?: string | number | null, lng?: string | number | null, label?: string) {
  const q = lat && lng ? `${lat},${lng}` : encodeURIComponent(label || 'Dubai Marina, Dubai, UAE')
  const url = `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`
  // Inside the app the WebView hands https links to the system (Maps / browser).
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** Keeps only the queue items that did not sync, so a failed action is never silently dropped. */
export function removeSyncedOfflineItems(results: Array<{ idempotency_key: string; status: string }>) {
  const done = new Set(results.filter(r => r.status === 'synced' || r.status === 'already_synced').map(r => r.idempotency_key))
  if (done.size === 0) return getOfflineQueue() // clearSyncedOfflineItems([]) would wipe the whole queue
  return clearSyncedOfflineItems([...done])
}
