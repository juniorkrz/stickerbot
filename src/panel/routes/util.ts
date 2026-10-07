import { isJidGroup, jidEncode, jidNormalizedUser } from '@whiskeysockets/baileys'
import { NextFunction, Request, RequestHandler, Response } from 'express'

import { getLogger } from '../../handlers/logger'

const logger = getLogger()

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Envolve handlers async: erros viram JSON { error } em vez de derrubar a requisição
export const h = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(error => {
      const status = error instanceof HttpError ? error.status : 500
      if (status >= 500) logger.error(`[PAINEL] ${req.method} ${req.path}: ${error?.stack || error}`)
      if (!res.headersSent) res.status(status).json({ error: error?.message || String(error) })
    })
  }

export const bad = (message: string) => new HttpError(400, message)
export const notFound = (message = 'Não encontrado') => new HttpError(404, message)

// Aceita telefone ("5581...", "+55 (81) ...") ou jid e devolve um jid
export const toJid = (value: string): string => {
  const v = String(value || '').trim()
  if (!v) throw bad('Número ou conversa não informado')
  if (v.includes('@')) return isJidGroup(v) ? v : jidNormalizedUser(v)
  const digits = v.replace(/\D/g, '')
  if (digits.length < 8) throw bad('Número inválido')
  return jidEncode(digits, 's.whatsapp.net')
}

export const decodeBase64File = (data: string): Buffer => {
  const base64 = String(data || '').replace(/^data:[^;]+;base64,/, '')
  if (!base64) throw bad('Arquivo vazio')
  return Buffer.from(base64, 'base64')
}

export const paginate = (req: Request, def = 50, max = 200) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || def)) || def, 1), max)
  const offset = Math.max(parseInt(String(req.query.offset || 0)) || 0, 0)
  return { limit,
    offset }
}
