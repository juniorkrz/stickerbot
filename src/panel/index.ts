import express, { Express, Router } from 'express'
import fs from 'fs'
import path from 'path'

import { panel } from '../config'
import { getLogger } from '../handlers/logger'
import { colors } from '../utils/colors'
import { logout, requestCode, requireAuth, toPanelUser, verifyCode } from './auth'
import { chatsRouter, mediaRouter } from './routes/chats'
import { groupsRouter } from './routes/groups'
import { adsRouter, commandsRouter, configRouter, profileRouter } from './routes/manage'
import { adminsRouter, bansRouter, membersRouter, vipsRouter } from './routes/people'
import { statsRouter } from './routes/stats'
import { systemRouter } from './routes/system'
import { h } from './routes/util'

export { setConnectionState } from './events'
export { attachMessageStore } from './messageStore'
export { loadPanelSettings } from './settings'

const logger = getLogger()

// build do frontend (panel/dist), relativo a src/panel ou dist/panel
const staticDir = path.resolve(__dirname, '../../panel/dist')

export const mountPanel = (app: Express) => {
  if (!panel.enabled) return

  const api = Router()
  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  // rotas públicas (login)
  api.post('/auth/request', h(requestCode))
  api.post('/auth/verify', h(verifyCode))
  api.post('/auth/logout', h(logout))

  // daqui para baixo, só admin logado
  api.use(requireAuth)
  api.get('/auth/me', (req, res) => res.json(toPanelUser(req.panelUser!.phone)))
  api.use('/system', systemRouter)
  api.use('/stats', statsRouter)
  api.use('/chats', chatsRouter)
  api.use('/media', mediaRouter)
  api.use('/groups', groupsRouter)
  api.use('/members', membersRouter)
  api.use('/bans', bansRouter)
  api.use('/vips', vipsRouter)
  api.use('/admins', adminsRouter)
  api.use('/ads', adsRouter)
  api.use('/commands', commandsRouter)
  api.use('/config', configRouter)
  api.use('/profile', profileRouter)
  api.use((_req, res) => res.status(404).json({ error: 'Rota não encontrada' }))

  app.use('/painel/api', api)

  if (fs.existsSync(staticDir)) {
    app.use('/painel', express.static(staticDir, { index: false,
      maxAge: '1h' }))
    // SPA: qualquer outra rota do painel devolve o index.html
    app.get(['/painel', '/painel/*'], (_req, res) => {
      res.set('Cache-Control', 'no-cache')
      res.sendFile(path.join(staticDir, 'index.html'))
    })
  } else {
    logger.warn(`[PAINEL] Frontend não encontrado em ${staticDir} (rode o build do panel/)`)
  }

  logger.info(`${colors.green}[PAINEL]${colors.reset} Disponível em /painel`)
}
