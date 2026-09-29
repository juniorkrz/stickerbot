import { jidNormalizedUser } from '@whiskeysockets/baileys'
import { Router } from 'express'
import os from 'os'
import { imageSync } from 'qr-image'

import { botStartedAt, getClient } from '../../bot'
import { bot } from '../../config'
import { getLogBuffer, getLogger, onLog } from '../../handlers/logger'
import { getTotalCommandsLoaded } from '../../handlers/text'
import { getProjectLocalVersion } from '../../utils/misc'
import { requireOwner } from '../auth'
import { addEventClient, broadcast, getConnectionState, getOnlineAdmins } from '../events'
import { h } from './util'

const logger = getLogger()

// envia os logs para quem está com a tela de logs aberta
onLog(entry => broadcast('log', entry))

export const systemRouter = Router()

systemRouter.get('/status', h(async (_req, res) => {
  const client = getClient()
  const conn = getConnectionState()
  const me = client?.user
  const mem = process.memoryUsage()
  res.json({
    connection: { status: conn.status,
      since: conn.since,
      hasQr: !!conn.qr },
    me: me ? { id: jidNormalizedUser(me.id),
      name: me.name || bot.name,
      phone: jidNormalizedUser(me.id).split('@')[0] } : null,
    bot: { name: bot.name,
      version: getProjectLocalVersion(),
      commands: getTotalCommandsLoaded() },
    startedAt: botStartedAt().valueOf(),
    process: {
      memoryMb: Math.round(mem.rss / 1024 / 1024),
      heapMb: Math.round(mem.heapUsed / 1024 / 1024),
      node: process.version
    },
    host: {
      loadavg: os.loadavg(),
      totalMemMb: Math.round(os.totalmem() / 1024 / 1024),
      freeMemMb: Math.round(os.freemem() / 1024 / 1024),
      uptime: os.uptime()
    },
    onlineAdmins: getOnlineAdmins()
  })
}))

systemRouter.get('/qr', (_req, res) => {
  const conn = getConnectionState()
  if (conn.status === 'open' || !conn.qr) return res.status(404).json({ error: 'Sem QR Code no momento' })
  res.type('png').end(imageSync(conn.qr, { type: 'png',
    margin: 2,
    size: 8 }))
})

systemRouter.get('/logs', (req, res) => {
  const since = parseInt(String(req.query.since || 0)) || 0
  res.json(getLogBuffer().filter(l => l.id > since).slice(-1000))
})

// Stream de eventos em tempo real (mensagens, conversas, conexão e logs)
systemRouter.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  })
  res.flushHeaders()
  const conn = getConnectionState()
  res.write(`event: connection\ndata: ${JSON.stringify({ status: conn.status,
    hasQr: !!conn.qr,
    since: conn.since })}\n\n`)
  const remove = addEventClient(res, req.panelUser!.phone, req.query.logs === '1')
  req.on('close', remove)
})

systemRouter.post('/restart', requireOwner, (req, res) => {
  logger.warn(`[PAINEL] Reinício solicitado por ${req.panelUser?.phone}`)
  res.json({ ok: true })
  // o Docker (restart: unless-stopped) religa o container
  setTimeout(() => process.exit(0), 500)
})
