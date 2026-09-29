import {
  AnyMessageContent,
  downloadMediaMessage,
  isJidGroup,
  jidDecode,
  jidNormalizedUser,
  MiscMessageGenerationOptions,
  proto,
  WAMessage
} from '@whiskeysockets/baileys'
import crypto from 'crypto'
import { and, desc, eq, inArray, lt } from 'drizzle-orm'
import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import Pino from 'pino'

import { getClient } from '../../bot'
import { bot, panel, stickerMeta } from '../../config'
import { panelChats, panelContacts, panelMessages, vips } from '../../db/schema'
import { db, isUserBanned, pool } from '../../handlers/db'
import { buildStickerMessage } from '../../handlers/stickerEncoder'
import { getCachedGroupFetchAllParticipating, getFullCachedGroupMetadata, getPhoneFromJid } from '../../utils/baileysHelper'
import { adminName } from '../auth'
import { broadcast } from '../events'
import {
  deleteChatHistory,
  getContactNames,
  getRawMessage,
  markSentBy,
  mediaCacheDir,
  toMessageDTO
} from '../messageStore'
import { bad, decodeBase64File, h, notFound, paginate, toJid } from './util'

export const chatsRouter = Router()

type ChatRow = typeof panelChats.$inferSelect

// telefone de um jid (resolve @lid pelo mapeamento do WhatsApp ou pela tabela de contatos)
export const phoneOf = async (jid: string): Promise<string | undefined> => {
  if (isJidGroup(jid)) return undefined
  const decoded = jidDecode(jid)
  if (decoded?.server !== 'lid') return decoded?.user
  try {
    const phone = await getPhoneFromJid(jid)
    if (phone && phone !== decoded.user) return phone
  } catch {
    // sem mapeamento
  }
  const rows = await db.select({ phone: panelContacts.phone }).from(panelContacts).where(eq(panelContacts.jid, jid)).limit(1)
  return rows[0]?.phone || undefined
}

const chatDTO = (row: ChatRow, phone?: string) => ({
  jid: row.jid,
  name: row.name,
  phone,
  isGroup: !!row.isGroup,
  lastMessageAt: row.lastMessageAt ? new Date(row.lastMessageAt).getTime() : null,
  lastMessage: row.lastMessage,
  lastFromMe: !!row.lastFromMe,
  unread: row.unread,
  status: row.status,
  assignedTo: row.assignedTo,
  assignedName: row.assignedTo ? adminName(row.assignedTo) : null,
  pinned: !!row.pinned,
  archived: !!row.archived
})

const param = (value: string) => decodeURIComponent(value)

chatsRouter.get('/', h(async (req, res) => {
  const { limit, offset } = paginate(req, 50, 100)
  const filter = String(req.query.filter || 'all')
  const search = String(req.query.q || '').trim()
  const where: string[] = []
  const params: unknown[] = []

  switch (filter) {
  case 'unread': where.push('unread > 0', 'archived = 0'); break
  case 'private': where.push('isGroup = 0', 'archived = 0'); break
  case 'groups': where.push('isGroup = 1', 'archived = 0'); break
  case 'waiting': where.push('isGroup = 0', 'status = \'open\'', 'unread > 0', 'archived = 0'); break
  case 'mine': where.push('assignedTo = ?', 'archived = 0'); params.push(req.panelUser!.phone); break
  case 'resolved': where.push('status = \'resolved\''); break
  case 'archived': where.push('archived = 1'); break
  default: where.push('archived = 0')
  }
  if (search) {
    where.push('(name LIKE ? OR jid LIKE ? OR jid IN (SELECT jid FROM PanelContacts WHERE phone LIKE ?))')
    const like = `%${search}%`
    params.push(like, `%${search.replace(/\D/g, '') || search}%`, `%${search.replace(/\D/g, '') || search}%`)
  }
  const sqlText = `SELECT * FROM PanelChats ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY pinned DESC, lastMessageAt DESC LIMIT ? OFFSET ?`
  const [rows] = await pool.query(sqlText, [...params, limit, offset])
  const chats = rows as ChatRow[]
  const result = []
  for (const row of chats) result.push(chatDTO(row, await phoneOf(row.jid)))
  res.json(result)
}))

chatsRouter.get('/counts', h(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT
      SUM(archived = 0) \`all\`,
      SUM(unread > 0 AND archived = 0) unread,
      SUM(isGroup = 0 AND status = 'open' AND unread > 0 AND archived = 0) waiting,
      SUM(assignedTo = ? AND archived = 0) mine
     FROM PanelChats`,
    [req.panelUser!.phone]
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (rows as any[])[0] || {}
  res.json({ all: Number(r.all || 0),
    unread: Number(r.unread || 0),
    waiting: Number(r.waiting || 0),
    mine: Number(r.mine || 0) })
}))

// inicia conversa com um número
chatsRouter.post('/start', h(async (req, res) => {
  const digits = String(req.body?.phone || '').replace(/\D/g, '')
  if (digits.length < 10) throw bad('Informe o número com DDI e DDD')
  const client = getClient()
  const [result] = (await client.onWhatsApp(digits)) || []
  if (!result?.exists) throw bad('Este número não tem WhatsApp')
  const jid = jidNormalizedUser(result.jid)
  res.json({ jid })
}))

chatsRouter.get('/:jid', h(async (req, res) => {
  const jid = param(req.params.jid)
  const rows = await db.select().from(panelChats).where(eq(panelChats.jid, jid)).limit(1)
  const isGroup = !!isJidGroup(jid)
  const phone = await phoneOf(jid)
  const base = rows[0]
    ? chatDTO(rows[0], phone)
    : {
      jid,
      name: null,
      phone,
      isGroup,
      lastMessageAt: null,
      lastMessage: null,
      lastFromMe: false,
      unread: 0,
      status: 'open',
      assignedTo: null,
      assignedName: null,
      pinned: false,
      archived: false
    }

  if (isGroup) {
    const meta = await getFullCachedGroupMetadata(jid)
    const client = getClient()
    const myPhone = client?.user?.id ? await getPhoneFromJid(client.user.id) : undefined
    let amAdmin = false
    for (const p of meta?.participants || []) {
      if (p.admin && (await getPhoneFromJid(p.id)) === myPhone) amAdmin = true
    }
    return res.json({
      ...base,
      name: meta?.subject || base.name,
      group: meta
        ? {
          subject: meta.subject,
          desc: meta.desc,
          size: meta.participants.length,
          announce: !!meta.announce,
          restrict: !!meta.restrict,
          amAdmin,
          official: bot.groups.includes(jid),
          muted: bot.mutedGroups.includes(jid),
          isLogs: bot.logsGroup === jid,
          ephemeral: meta.ephemeralDuration || 0
        }
        : null
    })
  }

  // contato
  const ids = [jid]
  if (phone) ids.push(phone, `${phone}@s.whatsapp.net`)
  const vipRows = await db.select().from(vips).where(inArray(vips.jid, ids))
  const vip = vipRows.find(v => v.permanent || new Date(v.expires).getTime() > Date.now()) || vipRows[0]
  const contact = await db.select().from(panelContacts).where(eq(panelContacts.jid, jid)).limit(1)
  const [usage] = await pool.query('SELECT COUNT(*) n FROM UsageLog WHERE sender IN (?) AND ts >= NOW() - INTERVAL 30 DAY', [ids])

  // grupos em comum
  const common: { jid: string, subject: string }[] = []
  try {
    const groups = await getCachedGroupFetchAllParticipating()
    for (const g of Object.values(groups)) {
      for (const p of g.participants) {
        if (p.id === jid || p.phoneNumber === `${phone}@s.whatsapp.net` || p.id === `${phone}@s.whatsapp.net`) {
          common.push({ jid: g.id,
            subject: g.subject })
          break
        }
      }
    }
  } catch {
    // sem conexão
  }

  res.json({
    ...base,
    name: base.name || contact[0]?.name || null,
    contact: {
      pushName: contact[0]?.name || null,
      isAdmin: phone ? bot.admins.includes(phone) : false,
      isBanned: await isUserBanned(ids),
      vip: vip
        ? { jid: vip.jid,
          expires: new Date(vip.expires).getTime(),
          permanent: !!vip.permanent,
          active: !!vip.permanent || new Date(vip.expires).getTime() > Date.now() }
        : null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      usage30d: Number((usage as any[])[0]?.n || 0),
      groups: common
    }
  })
}))

chatsRouter.get('/:jid/messages', h(async (req, res) => {
  const jid = param(req.params.jid)
  const { limit } = paginate(req, 50, 200)
  const before = req.query.before ? new Date(Number(req.query.before)) : undefined
  const rows = await db.select().from(panelMessages)
    .where(before ? and(eq(panelMessages.jid, jid), lt(panelMessages.timestamp, before)) : eq(panelMessages.jid, jid))
    .orderBy(desc(panelMessages.timestamp))
    .limit(limit)
  rows.reverse()
  const messages = rows.map(toMessageDTO)
  const senders = messages.map(m => m.sender || '').filter(Boolean)
  const mentioned = messages.flatMap(m => m.meta.mentions || [])
  const quotedP = messages.map(m => m.meta.quoted?.participant || '').filter(Boolean)
  const names = await getContactNames([...senders, ...mentioned, ...quotedP])
  const admins: Record<string, string> = {}
  for (const m of messages) if (m.sentBy) admins[m.sentBy] = adminName(m.sentBy)
  res.json({ messages,
    names,
    admins,
    hasMore: rows.length === limit })
}))

chatsRouter.post('/:jid/read', h(async (req, res) => {
  const jid = param(req.params.jid)
  await db.update(panelChats).set({ unread: 0 }).where(eq(panelChats.jid, jid))
  broadcast('chat', { jid,
    unread: 0 })
  res.json({ ok: true })
}))

chatsRouter.patch('/:jid', h(async (req, res) => {
  const jid = param(req.params.jid)
  const body = req.body || {}
  const set: Partial<ChatRow> = {}
  if (body.status !== undefined) {
    if (!['open', 'resolved'].includes(body.status)) throw bad('Status inválido')
    set.status = body.status
  }
  if (body.assignedTo !== undefined) {
    const phone = body.assignedTo ? String(body.assignedTo).replace(/\D/g, '') : null
    if (phone && !bot.admins.includes(phone)) throw bad('Só é possível atribuir para admins')
    set.assignedTo = phone
  }
  if (body.pinned !== undefined) set.pinned = body.pinned ? 1 : 0
  if (body.archived !== undefined) set.archived = body.archived ? 1 : 0
  if (Object.keys(set).length == 0) throw bad('Nada para alterar')

  // a conversa pode ainda não existir na tabela (conversa nova)
  await pool.query('INSERT IGNORE INTO PanelChats (jid, isGroup) VALUES (?, ?)', [jid, isJidGroup(jid) ? 1 : 0])
  await db.update(panelChats).set(set).where(eq(panelChats.jid, jid))
  const [row] = await db.select().from(panelChats).where(eq(panelChats.jid, jid)).limit(1)
  const dto = chatDTO(row, await phoneOf(jid))
  broadcast('chat', dto)
  res.json(dto)
}))

chatsRouter.delete('/:jid', h(async (req, res) => {
  await deleteChatHistory(param(req.params.jid))
  broadcast('chat', { jid: param(req.params.jid),
    removed: true })
  res.json({ ok: true })
}))

// ---------- envio ----------

const buildQuoted = async (jid: string, quotedId?: string): Promise<WAMessage | undefined> => {
  if (!quotedId) return undefined
  const raw = await getRawMessage(jid, quotedId)
  if (raw) return raw
  const rows = await db.select().from(panelMessages)
    .where(and(eq(panelMessages.jid, jid), eq(panelMessages.id, quotedId))).limit(1)
  const row = rows[0]
  if (!row) return undefined
  return {
    key: { remoteJid: jid,
      id: row.id,
      fromMe: !!row.fromMe,
      participant: row.sender || undefined },
    message: { conversation: row.text || '' }
  }
}

const sendOptions = async (jid: string, quoted?: WAMessage): Promise<MiscMessageGenerationOptions> => {
  const options: MiscMessageGenerationOptions = { quoted }
  if (isJidGroup(jid)) {
    const meta = await getFullCachedGroupMetadata(jid)
    if (meta?.ephemeralDuration) options.ephemeralExpiration = meta.ephemeralDuration
  }
  return options
}

const withSignature = (text: string, phone: string) =>
  panel.signature && text ? `*${adminName(phone)}:*\n${text}` : text

const afterSend = async (jid: string, sent: WAMessage | undefined, phone: string) => {
  if (!sent?.key?.id) throw new Error('O WhatsApp não confirmou o envio')
  markSentBy(sent.key.id, phone)
  // se a linha já foi gravada, completa quem enviou
  await db.update(panelMessages).set({ sentBy: phone })
    .where(and(eq(panelMessages.jid, jid), eq(panelMessages.id, sent.key.id)))
  // responder pelo painel marca como lido
  await db.update(panelChats).set({ unread: 0 }).where(eq(panelChats.jid, jid))
  broadcast('chat', { jid,
    unread: 0 })
  return { id: sent.key.id }
}

chatsRouter.post('/:jid/messages', h(async (req, res) => {
  const jid = toJid(param(req.params.jid))
  const text = String(req.body?.text || '').trim()
  if (!text) throw bad('Mensagem vazia')
  const phone = req.panelUser!.phone
  const quoted = await buildQuoted(jid, req.body?.quotedId)
  const mentions = Array.isArray(req.body?.mentions) ? req.body.mentions.map(String) : undefined
  const sent = await getClient().sendMessage(jid, { text: withSignature(text, phone),
    mentions }, await sendOptions(jid, quoted))
  res.json(await afterSend(jid, sent, phone))
}))

chatsRouter.post('/:jid/media', h(async (req, res) => {
  const jid = toJid(param(req.params.jid))
  const phone = req.panelUser!.phone
  const { kind, mimetype, fileName } = req.body || {}
  const caption = withSignature(String(req.body?.caption || '').trim(), phone) || undefined
  const buffer = decodeBase64File(req.body?.data)
  if (buffer.length > 60 * 1024 * 1024) throw bad('Arquivo muito grande (máx. 60 MB)')

  let content: AnyMessageContent
  switch (kind) {
  case 'image': content = { image: buffer,
    caption,
    mimetype }; break
  case 'video': content = { video: buffer,
    caption,
    mimetype }; break
  case 'gif': content = { video: buffer,
    caption,
    gifPlayback: true }; break
  case 'audio': content = { audio: buffer,
    mimetype: mimetype || 'audio/mpeg' }; break
  case 'ptt': content = { audio: buffer,
    mimetype: mimetype || 'audio/ogg; codecs=opus',
    ptt: true }; break
  case 'sticker': {
    content = await buildStickerMessage(buffer, { author: stickerMeta.author, pack: stickerMeta.pack })
    break
  }
  case 'document':
    content = { document: buffer,
      mimetype: mimetype || 'application/octet-stream',
      fileName: fileName || 'arquivo',
      caption }
    break
  default: throw bad('Tipo de mídia inválido')
  }
  const quoted = await buildQuoted(jid, req.body?.quotedId)
  const sent = await getClient().sendMessage(jid, content, await sendOptions(jid, quoted))
  res.json(await afterSend(jid, sent, phone))
}))

chatsRouter.post('/:jid/messages/:id/react', h(async (req, res) => {
  const jid = param(req.params.jid)
  const id = param(req.params.id)
  const rows = await db.select().from(panelMessages).where(and(eq(panelMessages.jid, jid), eq(panelMessages.id, id))).limit(1)
  const row = rows[0]
  if (!row) throw notFound('Mensagem não encontrada')
  const key: proto.IMessageKey = { remoteJid: jid,
    id,
    fromMe: !!row.fromMe,
    participant: row.sender || undefined }
  await getClient().sendMessage(jid, { react: { text: String(req.body?.emoji || ''),
    key } })
  res.json({ ok: true })
}))

chatsRouter.delete('/:jid/messages/:id', h(async (req, res) => {
  const jid = param(req.params.jid)
  const id = param(req.params.id)
  const rows = await db.select().from(panelMessages).where(and(eq(panelMessages.jid, jid), eq(panelMessages.id, id))).limit(1)
  const row = rows[0]
  if (!row) throw notFound('Mensagem não encontrada')
  const key: proto.IMessageKey = { remoteJid: jid,
    id,
    fromMe: !!row.fromMe,
    participant: row.sender || undefined }
  await getClient().sendMessage(jid, { delete: key })
  res.json({ ok: true })
}))

chatsRouter.post('/:jid/presence', h(async (req, res) => {
  const jid = param(req.params.jid)
  const state = req.body?.state === 'composing' ? 'composing' : 'paused'
  await getClient().sendPresenceUpdate(state, jid).catch(() => undefined)
  res.json({ ok: true })
}))

// ---------- mídia e fotos ----------

export const mediaRouter = Router()

const avatarCache = new Map<string, { url: string | null, at: number }>()

mediaRouter.get('/avatar/:jid', h(async (req, res) => {
  const jid = param(req.params.jid)
  const cached = avatarCache.get(jid)
  let url = cached && Date.now() - cached.at < 6 * 3600_000 ? cached.url : undefined
  if (url === undefined) {
    try {
      url = (await getClient().profilePictureUrl(jid, 'image')) || null
    } catch {
      url = null
    }
    avatarCache.set(jid, { url,
      at: Date.now() })
  }
  if (!url) return res.status(204).end()
  res.set('Cache-Control', 'private, max-age=3600')
  res.redirect(url)
}))

mediaRouter.get('/:jid/:id', h(async (req, res) => {
  const jid = param(req.params.jid)
  const id = param(req.params.id)
  const rows = await db.select({ meta: panelMessages.meta,
    type: panelMessages.type }).from(panelMessages)
    .where(and(eq(panelMessages.jid, jid), eq(panelMessages.id, id))).limit(1)
  const meta = rows[0]?.meta ? JSON.parse(rows[0].meta) : {}
  let mimetype: string = meta.mimetype || 'application/octet-stream'
  if (rows[0]?.type === 'sticker') mimetype = 'image/webp'

  const cacheFile = path.join(mediaCacheDir, crypto.createHash('sha1').update(`${jid}|${id}`).digest('hex'))
  res.set('Cache-Control', 'private, max-age=86400')
  if (req.query.download && meta.fileName) res.attachment(meta.fileName)
  if (fs.existsSync(cacheFile)) return res.type(mimetype.split(';')[0]).sendFile(cacheFile)

  const message = await getRawMessage(jid, id)
  if (!message) throw notFound('Mídia indisponível')
  const client = getClient()
  let buffer: Buffer
  try {
    buffer = await downloadMediaMessage(message, 'buffer', {}, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger: Pino({ level: 'silent' }) as any,
      reuploadRequest: client.updateMediaMessage
    }) as Buffer
  } catch {
    throw notFound('A mídia expirou nos servidores do WhatsApp')
  }
  await fs.promises.mkdir(mediaCacheDir, { recursive: true })
  await fs.promises.writeFile(cacheFile, buffer)
  res.type(mimetype.split(';')[0]).send(buffer)
}))

// usado pelo perfil do bot para limpar o cache depois de trocar a foto
export const forgetAvatar = (jid: string) => avatarCache.delete(jid)

