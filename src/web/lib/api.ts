export class ApiError extends Error {
  status: number; details?: any
  constructor(status: number, message: string, details?: any) { super(message); this.status = status; this.details = details }
}

function buildClientHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'x-swk-client': 'web',
    ...(extra || {}),
  }
}

async function rawApi<T = any>(method: string, path: string, body?: unknown, signal?: AbortSignal, extraHeaders?: Record<string, string>): Promise<T> {
  const res = await fetch(path, {
    method,
    signal,
    credentials: 'same-origin',
    headers: buildClientHeaders({ 'content-type': 'application/json', ...(extraHeaders || {}) }),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data: any = null
  if (text) { try { data = JSON.parse(text) } catch { data = text } }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth/login')) window.dispatchEvent(new Event('swk:unauthorized'))
    throw new ApiError(res.status, (data && data.error) || res.statusText || 'Request failed', data?.details)
  }
  return data as T
}
export const get = <T = any>(p: string, params?: Record<string, any>, signal?: AbortSignal) => {
  if (params) {
    const u = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
    const s = u.toString(); if (s) p += (p.includes('?') ? '&' : '?') + s
  }
  return rawApi<T>('GET', p, undefined, signal)
}
export const post = <T = any>(p: string, b?: unknown, extraHeaders?: Record<string, string>) => rawApi<T>('POST', p, b ?? {}, undefined, extraHeaders)
export const put = <T = any>(p: string, b?: unknown, extraHeaders?: Record<string, string>) => rawApi<T>('PUT', p, b ?? {}, undefined, extraHeaders)
export const del = <T = any>(p: string, extraHeaders?: Record<string, string>) => rawApi<T>('DELETE', p, undefined, undefined, extraHeaders)

export const api = Object.assign(rawApi, { get, post, put, del })

export async function upload(files: File[], fields: Record<string, string | number | undefined>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== '') fd.append(k, String(v))
  for (const f of files) fd.append('file', f)
  const res = await fetch('/api/files', {
    method: 'POST',
    body: fd,
    headers: buildClientHeaders(),
    credentials: 'same-origin',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error || 'Upload failed')
  return data
}
export function downloadUrl(path: string, params?: Record<string, any>) {
  const u = new URLSearchParams(); for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== null && v !== '') u.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
  const s = u.toString(); return s ? `${path}?${s}` : path
}
