import { jidEncode } from '@whiskeysockets/baileys'
import { eq } from 'drizzle-orm'
import { Router } from 'express'
import moment from 'moment'

import { getClient } from '../../bot'
import { bot, panel } from '../../config'
import { banned, vips } from '../../db/schema'
import { addVip, ban, db, pool, removeVip, unban } from '../../handlers/db'
import { getLogger } from '../../handlers/logger'
import {
  amAdminOfGroup,
  getAllGroupsFromCommunity,
  getPhoneFromJid,
  isJidInParticipantList,
  sendLogToAdmins
} from '../../utils/baileysHelper'
import { adminName, normalizePhone, requireOwner } from '../auth'
import { saveField } from '../settings'
import { phoneOf } from './chats'
import { bad, h, paginate, toJid } from './util'

const logger = getLogger()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const q = async <T = any>(sql: string, params: unknown[] = []): Promise<T[]> => {
  const [rows] = await pool.query(sql, params)
  return rows as T[]
}

const nameFor = async (jid: string, phone?: string): Promise<string | null> => {
  const rows = await q('SELECT name FROM PanelContacts WHERE jid = ? OR (phone IS NOT NULL AND phone = ?) ' +
    'ORDER BY lastSeenAt DESC LIMIT 1', [jid, phone || '-'])
  return rows[0]?.name || null
}

const log = (text: string) => {
  logger.warn(text.replaceAll('*', ''))
  void sendLogToAdmins(text).catch(() => undefined)
}

// ================= Membros (contatos conhecidos) =================

export const membersRouter = Router()

membersRouter.get('/', h(async (req, res) => {
  const { limit, offset } = paginate(req, 50, 200)
  const search = String(req.query.q || '').trim()
  const filter = String(req.query.filter || 'all')
  const where: string[] = []
  const params: unknown[] = []
  if (search) {
    const digits = search.replace(/\D/g, '')
    where.push(digits.length >= 3 ? '(c.name LIKE ? OR c.phone LIKE ? OR c.jid LIKE ?)' : 'c.name LIKE ?')
    params.push(`%${search}%`)
    if (digits.length >= 3) params.push(`%${digits}%`, `%${digits}%`)
  }
  const vipExpr = 'EXISTS(SELECT 1 FROM Vips v WHERE v.jid IN (c.jid, CONCAT(c.phone, \'@s.whatsapp.net\')) ' +
    'AND (v.expires >= NOW() OR v.permanent = 1))'
  const banExpr = 'EXISTS(SELECT 1 FROM Banned b WHERE b.user IN (c.jid, c.phone, CONCAT(c.phone, \'@s.whatsapp.net\')))'
  if (filter === 'vip') where.push(vipExpr)
  if (filter === 'banned') where.push(banExpr)
  const rows = await q(
    `SELECT c.jid, c.phone, c.name, c.lastSeenAt, ${vipExpr} isVip, ${banExpr} isBanned,
      (SELECT COUNT(*) FROM UsageLog u WHERE u.sender = COALESCE(c.phone, c.jid) AND u.ts >= NOW() - INTERVAL 30 DAY) usage30d
     FROM PanelContacts c ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY c.lastSeenAt DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )
  const [{ total }] = await q(`SELECT COUNT(*) total FROM PanelContacts c ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`,
    params)
  res.json({
    total: Number(total),
    items: rows.map(r => ({
      jid: r.jid,
      phone: r.phone,
      name: r.name,
      lastSeenAt: new Date(r.lastSeenAt).getTime(),
      isVip: !!r.isVip,
      isBanned: !!r.isBanned,
      isAdmin: r.phone ? bot.admins.includes(r.phone) : false,
      usage30d: Number(r.usage30d)
    }))
  })
}))

// ================= Banidos =================

export const bansRouter = Router()

bansRouter.get('/', h(async (_req, res) => {
  const rows = await db.select().from(banned)
  const result = []
  for (const r of rows) {
    const phone = r.user.includes('@') ? await phoneOf(r.user) : r.user
    result.push({ user: r.user,
      phone: phone || null,
      name: await nameFor(r.user, phone) })
  }
  res.json(result)
}))

bansRouter.post('/', h(async (req, res) => {
  const jid = toJid(String(req.body?.phone || req.body?.jid || ''))
  const phone = await getPhoneFromJid(jid)
  const client = getClient()
  if (phone && bot.admins.includes(phone)) throw bad('Não é possível banir um admin do bot')
  if (phone && client?.user?.id && phone === await getPhoneFromJid(client.user.id)) throw bad('Não é possível banir o próprio bot')

  await ban(jid)
  const kicked: string[] = []
  if (req.body?.kick !== false && bot.community) {
    const groups = await getAllGroupsFromCommunity(bot.community)
    for (const group of groups) {
      if (!await isJidInParticipantList(jid, group.participants)) continue
      if (!await amAdminOfGroup(group)) continue
      await client.groupParticipantsUpdate(group.id, [jid], 'remove').catch(() => undefined)
      kicked.push(group.subject)
    }
  }
  if (req.body?.block !== false) await client.updateBlockStatus(jid, 'block').catch(() => undefined)
  log(`*[BANS]:* ${adminName(req.panelUser!.phone)} baniu ${phone || jid} pelo painel` +
    (kicked.length ? ` (removido de ${kicked.length} grupo${kicked.length > 1 ? 's' : ''})` : ''))
  res.json({ ok: true,
    kicked })
}))

bansRouter.delete('/:user', h(async (req, res) => {
  const user = decodeURIComponent(req.params.user)
  await unban(user)
  const jid = user.includes('@') ? user : jidEncode(user, 's.whatsapp.net')
  await getClient()?.updateBlockStatus(jid, 'unblock').catch(() => undefined)
  log(`*[BANS]:* ${adminName(req.panelUser!.phone)} desbaniu ${user} pelo painel`)
  res.json({ ok: true })
}))

// ================= VIPs =================

export const vipsRouter = Router()

vipsRouter.get('/', h(async (_req, res) => {
  const rows = await db.select().from(vips)
  const result = []
  for (const r of rows) {
    const phone = await phoneOf(r.jid)
    const expires = new Date(r.expires).getTime()
    result.push({
      jid: r.jid,
      phone: phone || null,
      name: await nameFor(r.jid, phone),
      expires,
      permanent: !!r.permanent,
      active: !!r.permanent || expires > Date.now()
    })
  }
  result.sort((a, b) => Number(b.active) - Number(a.active) || b.expires - a.expires)
  res.json(result)
}))

vipsRouter.post('/', h(async (req, res) => {
  const jid = toJid(String(req.body?.phone || req.body?.jid || ''))
  const permanent = !!req.body?.permanent
  const months = Number(req.body?.months || 1)
  if (!permanent && (!(months > 0) || months > 120)) throw bad('Informe de 1 a 120 meses')
  const expires = await addVip(jid, permanent ? 0 : months, permanent)
  const period = permanent ? 'permanente' : `${months} ${months == 1 ? 'mês' : 'meses'}`
  if (req.body?.notify !== false) {
    const expiration = permanent ? 'Nunca' : moment(expires).format('DD/MM/YY [às] HH:mm:ss')
    await getClient().sendMessage(jid, {
      text: `Olá! 💜\n\nSeu status *VIP* foi atualizado para *${period}*!\n` +
        'Confira o que você consegue fazer digitando o comando *!vantagens*\n\n' +
        `*Data de expiração:* ${expiration}`
    }).catch(() => undefined)
  }
  log(`*[VIP]:* ${adminName(req.panelUser!.phone)} adicionou ${period} de VIP para ${jid.split('@')[0]} pelo painel`)
  res.json({ ok: true,
    expires: expires.getTime() })
}))

// editar a data de vencimento diretamente
vipsRouter.patch('/:jid', h(async (req, res) => {
  const jid = decodeURIComponent(req.params.jid)
  const set: Partial<typeof vips.$inferInsert> = {}
  if (req.body?.expires !== undefined) {
    const d = new Date(Number(req.body.expires) || String(req.body.expires))
    if (isNaN(d.getTime())) throw bad('Data inválida')
    set.expires = d
  }
  if (req.body?.permanent !== undefined) set.permanent = req.body.permanent ? 1 : 0
  if (Object.keys(set).length == 0) throw bad('Nada para alterar')
  await db.update(vips).set(set).where(eq(vips.jid, jid))
  log(`*[VIP]:* ${adminName(req.panelUser!.phone)} editou o VIP de ${jid.split('@')[0]} pelo painel`)
  res.json({ ok: true })
}))

vipsRouter.delete('/:jid', h(async (req, res) => {
  const jid = decodeURIComponent(req.params.jid)
  await removeVip(jid)
  log(`*[VIP]:* ${adminName(req.panelUser!.phone)} removeu o VIP de ${jid.split('@')[0]} pelo painel`)
  res.json({ ok: true })
}))

// ================= Admins =================

export const adminsRouter = Router()

adminsRouter.get('/', h(async (_req, res) => {
  const result = []
  for (const [i, phone] of bot.admins.entries()) {
    result.push({
      phone,
      name: panel.adminNames[phone] || null,
      whatsappName: await nameFor(jidEncode(phone, 's.whatsapp.net'), phone),
      isOwner: i == 0
    })
  }
  res.json(result)
}))

adminsRouter.post('/', requireOwner, h(async (req, res) => {
  const phone = normalizePhone(req.body?.phone)
  if (phone.length < 10) throw bad('Informe o número com DDI e DDD')
  if (bot.admins.includes(phone)) throw bad('Este número já é admin')
  await saveField('bot.admins', [...bot.admins, phone])
  if (req.body?.name) await saveField('panel.adminNames', { ...panel.adminNames,
    [phone]: String(req.body.name).trim() })
  log(`*[ADMINS]:* ${adminName(req.panelUser!.phone)} adicionou ${phone} como admin`)
  res.json({ ok: true })
}))

adminsRouter.patch('/:phone', h(async (req, res) => {
  const phone = normalizePhone(req.params.phone)
  if (!bot.admins.includes(phone)) throw bad('Admin não encontrado')
  // cada um pode mudar o próprio nome; o dono muda o de todos
  if (phone !== req.panelUser!.phone && !req.panelUser!.isOwner) throw bad('Só o dono pode renomear outros admins')
  const names = { ...panel.adminNames }
  const name = String(req.body?.name || '').trim()
  if (name) names[phone] = name
  else delete names[phone]
  await saveField('panel.adminNames', names)
  res.json({ ok: true })
}))

adminsRouter.delete('/:phone', requireOwner, h(async (req, res) => {
  const phone = normalizePhone(req.params.phone)
  if (bot.admins[0] === phone) throw bad('O dono não pode ser removido')
  await saveField('bot.admins', bot.admins.filter(a => a !== phone))
  log(`*[ADMINS]:* ${adminName(req.panelUser!.phone)} removeu ${phone} dos admins`)
  res.json({ ok: true })
}))
