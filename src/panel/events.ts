import { Response } from 'express'

// Hub de eventos em tempo real (Server-Sent Events) para as abas abertas do painel

export type PanelEventType = 'message' | 'message-update' | 'chat' | 'connection' | 'log'

const clients = new Map<number, { res: Response, phone: string, logs: boolean }>()
let clientSeq = 0

// Estado da conexão com o WhatsApp, alimentado pelo bot.ts
export type ConnectionStatus = 'connecting' | 'open' | 'close'
const connection: {
  status: ConnectionStatus
  qr?: string
  pairingCode?: string
  reason?: string
  since: number
} = {
  status: 'connecting',
  since: Date.now()
}

export const getConnectionState = () => connection

// O que vai para todas as abas (o QR e o código de pareamento em si só saem por rotas do dono)
export const publicConnectionState = () => ({
  status: connection.status,
  hasQr: !!connection.qr,
  hasPairingCode: !!connection.pairingCode,
  reason: connection.reason,
  since: connection.since
})

export const setConnectionState = (status: ConnectionStatus, qr?: string, reason?: string) => {
  if (status !== connection.status) connection.since = Date.now()
  connection.status = status
  connection.qr = status === 'open' ? undefined : (qr ?? connection.qr)
  if (status === 'open') connection.pairingCode = undefined
  connection.reason = status === 'open' ? undefined : (reason ?? connection.reason)
  broadcast('connection', publicConnectionState())
}

export const setPairingCode = (code: string | undefined) => {
  connection.pairingCode = code
  broadcast('connection', publicConnectionState())
}

// Sessão descartada: o QR e o código antigos não servem mais
export const clearConnectionAuth = (reason?: string) => {
  connection.qr = undefined
  connection.pairingCode = undefined
  connection.reason = reason
  broadcast('connection', publicConnectionState())
}

export const addEventClient = (res: Response, phone: string, logs: boolean): (() => void) => {
  const id = ++clientSeq
  clients.set(id, { res,
    phone,
    logs })
  return () => clients.delete(id)
}

export const broadcast = (type: PanelEventType, data: unknown) => {
  if (clients.size == 0) return
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
  for (const client of clients.values()) {
    if (type === 'log' && !client.logs) continue
    try {
      client.res.write(payload)
    } catch {
      // conexão caiu; o close handler remove
    }
  }
}

export const getOnlineAdmins = (): string[] => Array.from(new Set(Array.from(clients.values()).map(c => c.phone)))

// Mantém as conexões vivas atrás de proxies
setInterval(() => {
  for (const client of clients.values()) {
    try {
      client.res.write(': ping\n\n')
    } catch {
      // ignora
    }
  }
}, 25_000)
