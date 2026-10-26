import { getStoredServerUrl, getStoredSessionToken, isCapacitorAndroid, setStoredSessionToken } from '../mobile/native-bridge'

export class ApiError extends Error {
  status: number; details?: any
  constructor(status: number, message: string, details?: any) { super(message); this.status = status; this.details = details }
}

function resolveApiUrl(path: string): { url: string; crossOrigin: boolean } {
  const base = getStoredServerUrl()
  if (base && path.startsWith('/')) {
    return { url: `${base}${path}`, crossOrigin: true }
  }
  return { url: path, crossOrigin: false }
}

function buildClientHeaders(extra?: Record<string, string>): Record<string, string> {
  const isAndroid = isCapacitorAndroid()
  const sessionToken = getStoredSessionToken()
  return {
    'x-swk-client': isAndroid ? 'android' : 'web',
    ...(sessionToken ? { 'x-swk-session': sessionToken } : {}),
    ...(extra || {}),
  }
}

export async function api<T = any>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const { url, crossOrigin } = resolveApiUrl(path)
  const res = await fetch(url, {
    method,
    signal,
    credentials: crossOrigin ? 'include' : 'same-origin',
    headers: buildClientHeaders({ 'content-type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data: any = null
  if (text) { try { data = JSON.parse(text) } catch { data = text } }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth/login')) window.dispatchEvent(new Event('swk:unauthorized'))
    throw new ApiError(res.status, (data && data.error) || res.statusText || 'Request failed', data?.details)
  }
  if (path === '/api/auth/login' && data?.sessionToken) {
    setStoredSessionToken(data.sessionToken)
  } else if (path === '/api/auth/logout') {
    setStoredSessionToken(null)
  }
  return data as T
}
export const get = <T = any>(p: string, params?: Record<string, any>, signal?: AbortSignal) => {
  if (params) {
    const u = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
    const s = u.toString(); if (s) p += (p.includes('?') ? '&' : '?') + s
  }
  return api<T>('GET', p, undefined, signal)
}
export const post = <T = any>(p: string, b?: unknown) => api<T>('POST', p, b ?? {})
export const put = <T = any>(p: string, b?: unknown) => api<T>('PUT', p, b ?? {})
export const del = <T = any>(p: string) => api<T>('DELETE', p)

export async function upload(files: File[], fields: Record<string, string | number | undefined>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== '') fd.append(k, String(v))
  for (const f of files) fd.append('file', f)
  const { url, crossOrigin } = resolveApiUrl('/api/files')
  const res = await fetch(url, {
    method: 'POST',
    body: fd,
    headers: buildClientHeaders(),
    credentials: crossOrigin ? 'include' : 'same-origin',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error || 'Upload failed')
  return data
}
export function downloadUrl(path: string, params?: Record<string, any>) {
  const u = new URLSearchParams(); for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== null && v !== '') u.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
  const s = u.toString(); return s ? `${path}?${s}` : path
}
