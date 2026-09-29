import { useEffect, useRef, useSyncExternalStore } from 'react'

import { API_BASE } from './api'
import type { ConnectionStatus } from './types'

// Eventos em tempo real do bot (Server-Sent Events). Uma conexão por aba, compartilhada.

type Handler = (data: any) => void // eslint-disable-line @typescript-eslint/no-explicit-any

const handlers = new Map<string, Set<Handler>>()
let source: EventSource | undefined
const EVENT_TYPES = ['message', 'message-update', 'chat', 'connection']

// estado: o stream está conectado? e o WhatsApp?
let state = { stream: false, whatsapp: 'connecting' as ConnectionStatus, hasQr: false }
const stateListeners = new Set<() => void>()
const setState = (patch: Partial<typeof state>) => {
  state = { ...state, ...patch }
  stateListeners.forEach(l => l())
}

export const startEvents = () => {
  if (source) return
  source = new EventSource(`${API_BASE}/system/events`, { withCredentials: true })
  source.onopen = () => setState({ stream: true })
  source.onerror = () => setState({ stream: false })
  for (const type of EVENT_TYPES) {
    source.addEventListener(type, (event) => {
      let data: unknown
      try {
        data = JSON.parse((event as MessageEvent).data)
      } catch {
        return
      }
      if (type === 'connection') {
        const c = data as { status: ConnectionStatus, hasQr: boolean }
        setState({ whatsapp: c.status, hasQr: c.hasQr })
      }
      handlers.get(type)?.forEach(h => h(data))
    })
  }
}

export const stopEvents = () => {
  source?.close()
  source = undefined
  setState({ stream: false })
}

export const subscribe = (type: string, handler: Handler) => {
  if (!handlers.has(type)) handlers.set(type, new Set())
  handlers.get(type)!.add(handler)
  return () => {
    handlers.get(type)?.delete(handler)
  }
}

// Assina um tipo de evento enquanto o componente estiver montado (handler sempre atualizado)
export const useEvent = (type: string, handler: Handler) => {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => subscribe(type, data => ref.current(data)), [type])
}

export const useLiveState = () =>
  useSyncExternalStore(
    (listener) => {
      stateListeners.add(listener)
      return () => stateListeners.delete(listener)
    },
    () => state
  )
