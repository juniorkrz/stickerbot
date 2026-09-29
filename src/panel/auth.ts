import { jidEncode } from '@whiskeysockets/baileys'
import crypto from 'crypto'
import { eq, lt } from 'drizzle-orm'
import { NextFunction, Request, Response } from 'express'

import { getClient } from '../bot'
import { bot, panel } from '../config'
import { panelSessions } from '../db/schema'
import { db } from '../handlers/db'
import { getLogger } from '../handlers/logger'
import { sendLogToAdmins } from '../utils/baileysHelper'
import { getConnectionState } from './events'

const logger = getLogger()

export const COOKIE_NAME = 'sbpanel'
const CODE_TTL_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 5

export interface PanelUser {
  phone: string
  name: string
  isOwner: boolean
}

declare module 'express-serve-static-core' {
  interface Request {
    panelUser?: PanelUser
  }
}

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex')

export const normalizePhone = (value: unknown) => String(value || '').replace(/\D/g, '')

export const isPanelAdmin = (phone: string) => bot.admins.includes(phone)

export const adminName = (phone: string) => panel.adminNames[phone] || `+${phone}`

export const toPanelUser = (phone: string): PanelUser => ({
  phone,
  name: adminName(phone),
  isOwner: bot.admins[0] === phone
})

// ---------- códigos de login (em memória) ----------

const codes = new Map<string, { hash: string, expires: number, attempts: number }>()
const lastRequestByPhone = new Map<string, number>()
const requestsByIp = new Map<string, number[]>()

const clientIp = (req: Request) =>
  (req.headers['cf-connecting-ip'] as string) ||
  (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
  req.socket.remoteAddress || ''

const ipAllowed = (ip: string) => {
  const now = Date.now()
  const recent = (requestsByIp.get(ip) || []).filter(t => now - t < 60 * 60 * 1000)
  if (recent.length >= 15) return false
  recent.push(now)
  requestsByIp.set(ip, recent)
  return true
}

export const requestCode = async (req: Request, res: Response) => {
  const phone = normalizePhone(req.body?.phone)
  if (phone.length < 10) return res.status(400).json({ error: 'Informe o número com DDI e DDD, ex.: 5581999999999' })

  const ip = clientIp(req)
  if (!ipAllowed(ip)) return res.status(429).json({ error: 'Muitas tentativas. Tente de novo mais tarde.' })

  const last = lastRequestByPhone.get(phone) || 0
  const wait = Math.ceil((last + 30_000 - Date.now()) / 1000)
  if (wait > 0) return res.status(429).json({ error: `Aguarde ${wait}s para pedir outro código.` })
  lastRequestByPhone.set(phone, Date.now())

  const connected = getConnectionState().status === 'open'

  // Resposta igual para admin e não-admin (não revela quem é admin)
  if (isPanelAdmin(phone)) {
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
    codes.set(phone, { hash: sha256(`${phone}:${code}`),
      expires: Date.now() + CODE_TTL_MS,
      attempts: 0 })

    if (connected) {
      try {
        await getClient().sendMessage(jidEncode(phone, 's.whatsapp.net'), {
          text: `🔐 *${bot.name} — Painel*\n\nSeu código de acesso é: *${code}*\n\n` +
            'Ele vale por 5 minutos. Se não foi você, ignore esta mensagem.'
        })
      } catch (error) {
        logger.error(`[PAINEL] Falha ao enviar código para ${phone}: ${error}`)
        logger.warn(`[PAINEL] Código de acesso para ${phone}: ${code}`)
      }
    } else {
      // Sem WhatsApp conectado não dá para mandar a mensagem: o código vai para o log do container
      logger.warn(`[PAINEL] WhatsApp desconectado. Código de acesso para ${phone}: ${code}`)
    }
  } else {
    logger.warn(`[PAINEL] Pedido de código para número que não é admin: ${phone} (${ip})`)
  }

  return res.json({
    ok: true,
    delivery: connected ? 'whatsapp' : 'logs'
  })
}

export const verifyCode = async (req: Request, res: Response) => {
  const phone = normalizePhone(req.body?.phone)
  const code = String(req.body?.code || '').replace(/\D/g, '')
  const entry = codes.get(phone)

  if (!entry || entry.expires < Date.now()) {
    codes.delete(phone)
    return res.status(400).json({ error: 'Código expirado ou inválido. Peça um novo.' })
  }
  entry.attempts++
  if (entry.attempts > MAX_ATTEMPTS) {
    codes.delete(phone)
    return res.status(429).json({ error: 'Tentativas demais. Peça um novo código.' })
  }
  const expected = Buffer.from(entry.hash)
  const received = Buffer.from(sha256(`${phone}:${code}`))
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received) || !isPanelAdmin(phone)) {
    return res.status(400).json({ error: 'Código incorreto.' })
  }
  codes.delete(phone)

  const token = crypto.randomBytes(32).toString('hex')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + panel.sessionDays * 86_400_000)
  await db.insert(panelSessions).values({
    tokenHash: sha256(token),
    phone,
    userAgent: String(req.headers['user-agent'] || '').slice(0, 255),
    ip: clientIp(req).slice(0, 64),
    createdAt: now,
    lastSeenAt: now,
    expiresAt
  })

  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https'
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/painel',
    maxAge: panel.sessionDays * 86_400_000
  })

  logger.info(`[PAINEL] Login de ${phone}`)
  void sendLogToAdmins(`*[PAINEL]:* ${adminName(phone)} entrou no painel.`).catch(() => undefined)

  return res.json({ ok: true,
    user: toPanelUser(phone) })
}

const readCookie = (req: Request): string | undefined => {
  const header = req.headers.cookie
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === COOKIE_NAME) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

// cache curto das sessões para não consultar o banco a cada requisição
const sessionCache = new Map<string, { phone: string, expiresAt: number, checkedAt: number }>()

const resolveSession = async (token: string): Promise<string | undefined> => {
  const hash = sha256(token)
  const cached = sessionCache.get(hash)
  if (cached && Date.now() - cached.checkedAt < 60_000) {
    return cached.expiresAt > Date.now() ? cached.phone : undefined
  }
  const rows = await db.select().from(panelSessions).where(eq(panelSessions.tokenHash, hash)).limit(1)
  const session = rows[0]
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
    sessionCache.delete(hash)
    return undefined
  }
  sessionCache.set(hash, { phone: session.phone,
    expiresAt: new Date(session.expiresAt).getTime(),
    checkedAt: Date.now() })
  void db.update(panelSessions).set({ lastSeenAt: new Date() }).where(eq(panelSessions.tokenHash, hash)).catch(() => undefined)
  return session.phone
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // proteção contra CSRF: toda chamada da API precisa deste cabeçalho (formulários de outros sites não conseguem enviar)
    if (req.method !== 'GET' && req.headers['x-sb-panel'] !== '1') {
      return res.status(403).json({ error: 'Requisição inválida' })
    }
    const token = readCookie(req)
    const phone = token ? await resolveSession(token) : undefined
    // admin removido perde o acesso na hora
    if (!phone || !isPanelAdmin(phone)) return res.status(401).json({ error: 'Não autenticado' })
    req.panelUser = toPanelUser(phone)
    next()
  } catch (error) {
    logger.error(`[PAINEL] Erro na autenticação: ${error}`)
    res.status(500).json({ error: 'Erro interno' })
  }
}

export const requireOwner = (req: Request, res: Response, next: NextFunction) => {
  if (!req.panelUser?.isOwner) return res.status(403).json({ error: 'Só o dono do bot pode fazer isso.' })
  next()
}

export const logout = async (req: Request, res: Response) => {
  const token = readCookie(req)
  if (token) {
    const hash = sha256(token)
    sessionCache.delete(hash)
    await db.delete(panelSessions).where(eq(panelSessions.tokenHash, hash))
  }
  res.clearCookie(COOKIE_NAME, { path: '/painel' })
  res.json({ ok: true })
}

// limpa sessões vencidas
setInterval(() => {
  if (!db) return
  void db.delete(panelSessions).where(lt(panelSessions.expiresAt, new Date())).catch(() => undefined)
  for (const [phone, entry] of codes) if (entry.expires < Date.now()) codes.delete(phone)
}, 60 * 60 * 1000)
