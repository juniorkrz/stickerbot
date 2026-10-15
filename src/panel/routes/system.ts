import { jidNormalizedUser } from '@whiskeysockets/baileys'
import { Router } from 'express'
import os from 'os'
import { imageSync } from 'qr-image'

import { botStartedAt, getClient, resetWhatsAppSession } from '../../bot'
import { bot } from '../../config'
import { getLogBuffer, getLogger, onLog } from '../../handlers/logger'
import { getTotalCommandsLoaded } from '../../handlers/text'
import { getProjectLocalVersion } from '../../utils/misc'
import { requireOwner } from '../auth'
import { addEventClient, broadcast, getConnectionState, getOnlineAdmins, publicConnectionState } from '../events'
import { h } from './util'

const logger = getLogger()

// envia os logs para quem está com a tela de logs aberta
onLog(entry => broadcast('log', entry))

export const systemRouter = Router()

systemRouter.get('/status', h(async (_req, res) => {
  const client = getClient()
  const me = client?.user
  const mem = process.memoryUsage()
  res.json({
    connection: publicConnectionState(),
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

systemRouter.get('/qr', requireOwner, (_req, res) => {
  const conn = getConnectionState()
  if (conn.status === 'open' || !conn.qr) return res.status(404).json({ error: 'Sem QR Code no momento' })
  res.type('png').end(imageSync(conn.qr, { type: 'png',
    margin: 2,
    size: 8 }))
})

systemRouter.get('/pairing-code', requireOwner, (_req, res) => {
  const conn = getConnectionState()
  if (conn.status === 'open' || !conn.pairingCode) {
    return res.status(404).json({ error: 'Sem código de pareamento no momento' })
  }
  res.json({ code: conn.pairingCode })
})

// Desconecta o aparelho atual, apaga a sessão e começa outra (QR Code ou código de pareamento)
systemRouter.post('/session/reset', requireOwner, h(async (req, res) => {
  const mode = req.body?.mode === 'code' ? 'code' : 'qr'
  const phone = String(req.body?.phone || '').replace(/\D/g, '')
  if (mode === 'code' && (phone.length < 10 || phone.length > 15)) {
    return res.status(400).json({ error: 'Informe o número do bot com DDI e DDD (ex.: 5581999999999)' })
  }
  const how = mode === 'code' ? 'código' : 'QR Code'
  logger.warn(`[PAINEL] Sessão do WhatsApp renovada por ${req.panelUser?.phone} (${how})`)
  await resetWhatsAppSession(mode, mode === 'code' ? phone : undefined)
  res.json({ ok: true })
}))

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
  res.write(`event: connection\ndata: ${JSON.stringify(publicConnectionState())}\n\n`)
  const remove = addEventClient(res, req.panelUser!.phone, req.query.logs === '1')
  req.on('close', remove)
})

systemRouter.post('/restart', requireOwner, (req, res) => {
  logger.warn(`[PAINEL] Reinício solicitado por ${req.panelUser?.phone}`)
  res.json({ ok: true })
  // o Docker (restart: unless-stopped) religa o container
  setTimeout(() => process.exit(0), 500)
})
