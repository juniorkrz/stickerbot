// Cliente da API do painel. Toda chamada leva o cabeçalho x-sb-panel (proteção CSRF do servidor).

export const API_BASE = '/painel/api'

export class ApiError extends Error {
  status: number
  data: unknown
  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

let onUnauthorized: (() => void) | undefined
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn
}

export const api = async <T = unknown>(path: string, options: { method?: string, body?: unknown } = {}): Promise<T> => {
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    credentials: 'same-origin',
    headers: {
      'x-sb-panel': '1',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {})
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  })
  const text = await res.text()
  let data: unknown = undefined
  try {
    data = text ? JSON.parse(text) : undefined
  } catch {
    data = text
  }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized?.()
    const message = (data as { error?: string })?.error || `Erro ${res.status}`
    throw new ApiError(res.status, message, data)
  }
  return data as T
}

export const get = <T>(path: string) => api<T>(path)
export const post = <T>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body })
export const patch = <T>(path: string, body: unknown = {}) => api<T>(path, { method: 'PATCH', body })
export const put = <T>(path: string, body: unknown = {}) => api<T>(path, { method: 'PUT', body })
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' })

export const enc = (value: string) => encodeURIComponent(value)

export const mediaUrl = (jid: string, id: string, download = false) =>
  `${API_BASE}/media/${enc(jid)}/${enc(id)}${download ? '?download=1' : ''}`

export const avatarUrl = (jid: string) => `${API_BASE}/media/avatar/${enc(jid)}`

// Lê um arquivo como data URL (base64) para upload
export const fileToDataUrl = (file: File | Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
