import { jidEncode } from '@whiskeysockets/baileys'
import crypto from 'crypto'
import { and, eq, like, lt, ne } from 'drizzle-orm'
import { NextFunction, Request, Response } from 'express'

import { getClient } from '../bot'
import { bot, panel } from '../config'
import { panelSessions } from '../db/schema'
import { db } from '../handlers/db'
import { getLogger } from '../handlers/logger'
import { getConnectionState } from './events'

const logger = getLogger()

export const COOKIE_NAME = 'sbpanel'
const CODE_TTL_MS = 5 * 60 * 1000
const HOUR = 60 * 60 * 1000
const MAX_ATTEMPTS_PER_CODE = 5
const MAX_CODES_PER_HOUR = 5
const MAX_FAILURES_PER_HOUR = 10
const LOCK_MS = HOUR

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

// O painel é exclusivo do dono (admin master). SB_PANEL_OWNER fixa o número; sem ele, vale o 1º de SB_ADMINS.
export const panelOwner = () => normalizePhone(process.env.SB_PANEL_OWNER) || bot.admins[0] || ''

export const isPanelAdmin = (phone: string) => !!phone && phone === panelOwner()

export const adminName = (phone: string) => panel.adminNames[phone] || `+${phone}`

export const toPanelUser = (phone: string): PanelUser => ({
  phone,
  name: adminName(phone),
  isOwner: isPanelAdmin(phone)
})

const ownerJid = () => jidEncode(panelOwner(), 's.whatsapp.net')

// avisa o dono no privado (nunca em grupo)
const alertOwner = async (text: string) => {
  try {
    if (getConnectionState().status !== 'open' || !panelOwner()) return
    await getClient().sendMessage(ownerJid(), { text })
  } catch (error) {
    logger.error(`[PAINEL] Falha ao avisar o dono: ${error}`)
  }
}

// ---------- origem da requisição ----------

export const clientIp = (req: Request) =>
  (req.headers['cf-connecting-ip'] as string) ||
  (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
  req.socket.remoteAddress || ''

const origin = (req: Request) => {
  const country = req.headers['cf-ipcountry'] as string | undefined
  const ua = String(req.headers['user-agent'] || '')
  const device = /iphone|ipad/i.test(ua) ? 'iPhone/iPad'
    : /android/i.test(ua) ? 'Android'
      : /windows/i.test(ua) ? 'Windows'
        : /mac os/i.test(ua) ? 'Mac'
          : /linux/i.test(ua) ? 'Linux' : 'desconhecido'
  return `IP ${clientIp(req)}${country ? ` (${country})` : ''} · ${device}`
}

// ---------- limites (em memória) ----------

const codes = new Map<string, { hash: string, expires: number, attempts: number }>()
const codeRequests = new Map<string, number[]>() // por telefone
const ipRequests = new Map<string, number[]>()
const failures = new Map<string, number[]>() // falhas de código por telefone
const lockedUntil = new Map<string, number>()

const recent = (map: Map<string, number[]>, key: string, windowMs = HOUR) => {
  const now = Date.now()
  const list = (map.get(key) || []).filter(t => now - t < windowMs)
  map.set(key, list)
  return list
}

const isLocked = (phone: string) => (lockedUntil.get(phone) || 0) > Date.now()

const registerFailure = async (phone: string, req: Request) => {
  const list = recent(failures, phone)
  list.push(Date.now())
  if (list.length >= MAX_FAILURES_PER_HOUR && !isLocked(phone)) {
    lockedUntil.set(phone, Date.now() + LOCK_MS)
    codes.delete(phone)
    logger.warn(`[PAINEL] Login bloqueado por 1h após ${list.length} códigos errados (${origin(req)})`)
    await alertOwner('🚨 *Painel do bot*\n\nMuitos códigos errados na tentativa de entrar no painel. ' +
      `O login foi *bloqueado por 1 hora*.\n\nÚltima tentativa: ${origin(req)}\n\n` +
      'Se não foi você, alguém está tentando acessar. Nenhum código foi aceito.')
  }
}

export const requestCode = async (req: Request, res: Response) => {
  const phone = normalizePhone(req.body?.phone)
  if (phone.length < 10) return res.status(400).json({ error: 'Informe o número com DDI e DDD, ex.: 5581999999999' })

  const ip = clientIp(req)
  const byIp = recent(ipRequests, ip)
  if (byIp.length >= 15) return res.status(429).json({ error: 'Muitas tentativas. Tente de novo mais tarde.' })
  byIp.push(Date.now())

  const connected = getConnectionState().status === 'open'
  const generic = { ok: true, delivery: connected ? 'whatsapp' : 'logs' }

  // Resposta idêntica para qualquer número: não revela quem tem acesso
  if (!isPanelAdmin(phone)) {
    logger.warn(`[PAINEL] Pedido de código para número sem acesso: ${phone} (${origin(req)})`)
    return res.json(generic)
  }

  if (isLocked(phone)) return res.status(429).json({ error: 'Login bloqueado temporariamente por excesso de tentativas.' })

  const byPhone = recent(codeRequests, phone)
  const last = byPhone[byPhone.length - 1] || 0
  const wait = Math.ceil((last + 30_000 - Date.now()) / 1000)
  if (wait > 0) return res.status(429).json({ error: `Aguarde ${wait}s para pedir outro código.` })
  if (byPhone.length >= MAX_CODES_PER_HOUR) {
    return res.status(429).json({ error: 'Limite de códigos por hora atingido. Tente mais tarde.' })
  }
  byPhone.push(Date.now())

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
  codes.set(phone, { hash: sha256(`${phone}:${code}`), expires: Date.now() + CODE_TTL_MS, attempts: 0 })

  if (connected) {
    try {
      await getClient().sendMessage(ownerJid(), {
        text: `🔐 *${bot.name} — Painel*\n\nSeu PIN de acesso: *${code}*\n\nVale por 5 minutos.\n` +
          `Pedido de: ${origin(req)}\n\n⚠ Se não foi você, *não passe esse código para ninguém*.`
      })
    } catch (error) {
      logger.error(`[PAINEL] Falha ao enviar o PIN: ${error}`)
      logger.warn(`[PAINEL] PIN de acesso: ${code}`)
    }
  } else {
    // Sem WhatsApp conectado não dá para mandar a mensagem: o PIN vai para o log do container
    logger.warn(`[PAINEL] WhatsApp desconectado. PIN de acesso: ${code}`)
  }
  return res.json(generic)
}

export const verifyCode = async (req: Request, res: Response) => {
  const phone = normalizePhone(req.body?.phone)
  const code = String(req.body?.code || '').replace(/\D/g, '')

  if (isLocked(phone)) return res.status(429).json({ error: 'Login bloqueado temporariamente por excesso de tentativas.' })

  const entry = codes.get(phone)
  if (!entry || entry.expires < Date.now()) {
    codes.delete(phone)
    if (isPanelAdmin(phone)) await registerFailure(phone, req)
    return res.status(400).json({ error: 'Código expirado ou inválido. Peça um novo.' })
  }
  entry.attempts++
  if (entry.attempts > MAX_ATTEMPTS_PER_CODE) {
    codes.delete(phone)
    return res.status(429).json({ error: 'Tentativas demais. Peça um novo código.' })
  }
  const expected = Buffer.from(entry.hash)
  const received = Buffer.from(sha256(`${phone}:${code}`))
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received) || !isPanelAdmin(phone)) {
    await registerFailure(phone, req)
    return res.status(400).json({ error: 'Código incorreto.' })
  }
  codes.delete(phone)
  failures.delete(phone)

  const token = crypto.randomBytes(32).toString('hex')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + panel.sessionDays * 86_400_000)
  await db.insert(panelSessions).values({
    tokenHash: sha256(token),
    phone,
    userAgent: String(req.headers['user-agent'] || '').slice(0, 255),
    ip: `${clientIp(req)}${req.headers['cf-ipcountry'] ? ` (${req.headers['cf-ipcountry']})` : ''}`.slice(0, 64),
    createdAt: now,
    lastSeenAt: now,
    expiresAt
  })

  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https'
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure,
    path: '/painel',
    maxAge: panel.sessionDays * 86_400_000
  })

  logger.info(`[PAINEL] Login do dono (${origin(req)})`)
  void alertOwner(`✅ *Painel do bot*\n\nNovo acesso ao painel.\n${origin(req)}\n\n` +
    'Se não foi você, abra o painel › Sistema › Sessões e encerre todas.')

  return res.json({ ok: true, user: toPanelUser(phone) })
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

const resolveSession = async (hash: string): Promise<string | undefined> => {
  const cached = sessionCache.get(hash)
  if (cached && Date.now() - cached.checkedAt < 15_000) {
    return cached.expiresAt > Date.now() ? cached.phone : undefined
  }
  const rows = await db.select().from(panelSessions).where(eq(panelSessions.tokenHash, hash)).limit(1)
  const session = rows[0]
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
    sessionCache.delete(hash)
    return undefined
  }
  sessionCache.set(hash, { phone: session.phone, expiresAt: new Date(session.expiresAt).getTime(), checkedAt: Date.now() })
  void db.update(panelSessions).set({ lastSeenAt: new Date() }).where(eq(panelSessions.tokenHash, hash)).catch(() => undefined)
  return session.phone
}

const currentHash = (req: Request) => {
  const token = readCookie(req)
  return token ? sha256(token) : undefined
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // proteção contra CSRF: toda chamada da API precisa deste cabeçalho (formulários de outros sites não conseguem enviar)
    if (req.method !== 'GET' && req.headers['x-sb-panel'] !== '1') {
      return res.status(403).json({ error: 'Requisição inválida' })
    }
    const hash = currentHash(req)
    const phone = hash ? await resolveSession(hash) : undefined
    // só o dono; se o número dono mudar, as sessões antigas deixam de valer na hora
    if (!phone || !isPanelAdmin(phone)) return res.status(401).json({ error: 'Não autenticado' })
    req.panelUser = toPanelUser(phone)
    next()
  } catch (error) {
    logger.error(`[PAINEL] Erro na autenticação: ${error}`)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// Mantido para as rotas que já o usam; com o painel exclusivo do dono, sempre passa
export const requireOwner = (req: Request, res: Response, next: NextFunction) => {
  if (!req.panelUser?.isOwner) return res.status(403).json({ error: 'Só o dono do bot pode fazer isso.' })
  next()
}

export const requireCsrfHeader = (req: Request, res: Response, next: NextFunction) => {
  if (req.headers['x-sb-panel'] !== '1') return res.status(403).json({ error: 'Requisição inválida' })
  next()
}

export const logout = async (req: Request, res: Response) => {
  const hash = currentHash(req)
  if (hash) {
    sessionCache.delete(hash)
    await db.delete(panelSessions).where(eq(panelSessions.tokenHash, hash))
  }
  res.clearCookie(COOKIE_NAME, { path: '/painel' })
  res.json({ ok: true })
}

// ---------- sessões ativas ----------

export const listSessions = async (req: Request, res: Response) => {
  const hash = currentHash(req)
  const rows = await db.select().from(panelSessions)
  res.json(rows
    .filter(r => new Date(r.expiresAt).getTime() > Date.now())
    .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())
    .map(r => ({
      id: r.tokenHash.slice(0, 16), // só um pedaço do hash: não serve para autenticar
      current: r.tokenHash === hash,
      ip: r.ip,
      userAgent: r.userAgent,
      createdAt: new Date(r.createdAt).getTime(),
      lastSeenAt: new Date(r.lastSeenAt).getTime(),
      expiresAt: new Date(r.expiresAt).getTime()
    })))
}

export const revokeSession = async (req: Request, res: Response) => {
  const id = String(req.params.id || '').replace(/[^0-9a-f]/g, '')
  if (id.length !== 16) return res.status(400).json({ error: 'Sessão inválida' })
  await db.delete(panelSessions).where(like(panelSessions.tokenHash, `${id}%`))
  sessionCache.clear()
  res.json({ ok: true })
}

// encerra todas as outras sessões (mantém a atual)
export const revokeOtherSessions = async (req: Request, res: Response) => {
  const hash = currentHash(req)
  if (!hash) return res.status(400).json({ error: 'Sessão inválida' })
  await db.delete(panelSessions).where(ne(panelSessions.tokenHash, hash))
  sessionCache.clear()
  res.json({ ok: true })
}

// limpa sessões vencidas
setInterval(() => {
  if (!db) return
  void db.delete(panelSessions).where(and(lt(panelSessions.expiresAt, new Date()))).catch(() => undefined)
  for (const [phone, entry] of codes) if (entry.expires < Date.now()) codes.delete(phone)
}, HOUR)
