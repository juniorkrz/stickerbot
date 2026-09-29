import {
  BufferJSON,
  getContentType,
  isJidGroup,
  normalizeMessageContent,
  proto,
  WAMessage,
  WAMessageStubType
} from '@whiskeysockets/baileys'
import { and, eq, inArray, lt, sql } from 'drizzle-orm'
import fs from 'fs'
import path from 'path'

import { bot, panel } from '../config'
import { panelChats, panelContacts, panelMessages, usageLog } from '../db/schema'
import { db, pool } from '../handlers/db'
import { getLogger } from '../handlers/logger'
import { getFullCachedGroupMetadata, getPhoneFromJid } from '../utils/baileysHelper'
import { broadcast } from './events'

const logger = getLogger()

type MessageRow = typeof panelMessages.$inferInsert

export interface QuotedInfo {
  id?: string
  participant?: string
  type?: string
  text?: string
}

export interface MessageMeta {
  mimetype?: string
  fileName?: string
  fileLength?: number
  seconds?: number
  width?: number
  height?: number
  animated?: boolean
  viewOnce?: boolean
  forwarded?: boolean
  quoted?: QuotedInfo
  mentions?: string[]
  latitude?: number
  longitude?: number
  name?: string
  options?: string[]
  vcard?: string
}

// Diretório de cache das mídias baixadas pelo painel
export const mediaCacheDir = `/data/${bot.sessionId}/panel-media`

// Tipos que têm mídia para baixar
const MEDIA_TYPES = new Set(['image', 'video', 'gif', 'audio', 'ptt', 'sticker', 'document'])

export const hasMedia = (type: string) => MEDIA_TYPES.has(type)

const toDate = (ts: WAMessage['messageTimestamp']): Date => {
  if (!ts) return new Date()
  const n = typeof ts === 'number' ? ts : Number(ts.toString())
  return new Date(n * 1000)
}

const toNumber = (v: unknown): number | undefined => {
  if (v === null || v === undefined) return undefined
  const n = typeof v === 'number' ? v : Number(v.toString())
  return isNaN(n) ? undefined : n
}

// Texto curto usado na lista de conversas e nas citações
export const previewFor = (type: string, text?: string | null, meta?: MessageMeta): string => {
  const t = text ? text.slice(0, 200) : ''
  switch (type) {
  case 'image': return `📷 ${t || 'Foto'}`
  case 'video': return `🎥 ${t || 'Vídeo'}`
  case 'gif': return `🎞️ ${t || 'GIF'}`
  case 'audio': return '🎵 Áudio'
  case 'ptt': return '🎤 Mensagem de voz'
  case 'sticker': return '🩵 Figurinha'
  case 'document': return `📄 ${meta?.fileName || t || 'Documento'}`
  case 'location': return '📍 Localização'
  case 'contact': return `👤 ${meta?.name || 'Contato'}`
  case 'poll': return `📊 ${t || 'Enquete'}`
  case 'viewonce': return '👁️ Visualização única'
  case 'system': return t
  case 'deleted': return '🚫 Mensagem apagada'
  default: return t || `[${type}]`
  }
}

interface ParsedContent {
  type: string
  text?: string
  meta: MessageMeta
}

// Converte o conteúdo de uma mensagem do WhatsApp num formato simples para o painel
export const parseContent = (message: proto.IMessage | null | undefined): ParsedContent | undefined => {
  const content = normalizeMessageContent(message)
  if (!content) return undefined
  const contentType = getContentType(content)
  if (!contentType) return undefined

  const meta: MessageMeta = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inner = (content as any)[contentType]
  const ctx: proto.IContextInfo | undefined = inner?.contextInfo
  if (ctx?.stanzaId) {
    const quoted = parseContent(ctx.quotedMessage)
    meta.quoted = {
      id: ctx.stanzaId,
      participant: ctx.participant || undefined,
      type: quoted?.type,
      text: quoted ? previewFor(quoted.type, quoted.text, quoted.meta) : undefined
    }
  }
  if (ctx?.mentionedJid?.length) meta.mentions = ctx.mentionedJid
  if (ctx?.isForwarded) meta.forwarded = true

  switch (contentType) {
  case 'conversation':
    return { type: 'text',
      text: content.conversation || '',
      meta }
  case 'extendedTextMessage':
    return { type: 'text',
      text: content.extendedTextMessage?.text || '',
      meta }
  case 'imageMessage': {
    const m = content.imageMessage!
    Object.assign(meta, { mimetype: m.mimetype,
      width: m.width,
      height: m.height,
      viewOnce: m.viewOnce || undefined })
    return { type: 'image',
      text: m.caption || undefined,
      meta }
  }
  case 'videoMessage': {
    const m = content.videoMessage!
    Object.assign(meta, { mimetype: m.mimetype,
      seconds: m.seconds,
      width: m.width,
      height: m.height })
    return { type: m.gifPlayback ? 'gif' : 'video',
      text: m.caption || undefined,
      meta }
  }
  case 'audioMessage': {
    const m = content.audioMessage!
    Object.assign(meta, { mimetype: m.mimetype,
      seconds: m.seconds })
    return { type: m.ptt ? 'ptt' : 'audio',
      meta }
  }
  case 'stickerMessage': {
    const m = content.stickerMessage!
    Object.assign(meta, { mimetype: m.mimetype,
      animated: m.isAnimated || undefined,
      width: m.width,
      height: m.height })
    return { type: 'sticker',
      meta }
  }
  case 'documentMessage': {
    const m = content.documentMessage!
    Object.assign(meta, { mimetype: m.mimetype,
      fileName: m.fileName,
      fileLength: toNumber(m.fileLength) })
    return { type: 'document',
      text: m.caption || undefined,
      meta }
  }
  case 'locationMessage':
  case 'liveLocationMessage': {
    const m = content.locationMessage || content.liveLocationMessage
    Object.assign(meta, { latitude: m?.degreesLatitude,
      longitude: m?.degreesLongitude })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { type: 'location',
      text: (m as any)?.name || (m as any)?.address || undefined,
      meta }
  }
  case 'contactMessage':
    Object.assign(meta, { name: content.contactMessage?.displayName,
      vcard: content.contactMessage?.vcard })
    return { type: 'contact',
      meta }
  case 'contactsArrayMessage':
    Object.assign(meta, { name: content.contactsArrayMessage?.displayName })
    return { type: 'contact',
      meta }
  case 'pollCreationMessage':
  case 'pollCreationMessageV2':
  case 'pollCreationMessageV3': {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = inner as any
    meta.options = (m?.options || []).map((o: { optionName?: string }) => o.optionName || '')
    return { type: 'poll',
      text: m?.name || '',
      meta }
  }
  case 'buttonsMessage':
    return { type: 'text',
      text: content.buttonsMessage?.contentText || '',
      meta }
  case 'listMessage':
    return { type: 'text',
      text: content.listMessage?.description || content.listMessage?.title || '',
      meta }
  case 'templateMessage':
    return { type: 'text',
      text: content.templateMessage?.hydratedTemplate?.hydratedContentText || '',
      meta }
  case 'buttonsResponseMessage':
    return { type: 'text',
      text: content.buttonsResponseMessage?.selectedDisplayText || '',
      meta }
  case 'listResponseMessage':
    return { type: 'text',
      text: content.listResponseMessage?.title || '',
      meta }
  case 'interactiveMessage':
    return { type: 'text', text: content.interactiveMessage?.body?.text || '', meta }
  case 'interactiveResponseMessage':
    return { type: 'text', text: content.interactiveResponseMessage?.body?.text || '', meta }
  case 'eventMessage':
    return { type: 'text',
      text: `📅 ${content.eventMessage?.name || 'Evento'}`,
      meta }
  // tipos que não viram mensagem visível
  case 'reactionMessage':
  case 'protocolMessage':
  case 'senderKeyDistributionMessage':
  case 'messageContextInfo':
  case 'pollUpdateMessage':
  case 'keepInChatMessage':
  case 'pinInChatMessage':
  case 'encReactionMessage':
  case 'secretEncryptedMessage': // edição/voto criptografado (o conteúdo chega por outro evento)
  case 'associatedChildMessage':
  case 'albumMessage': // só o "envelope" do álbum; as fotos chegam uma a uma
  case 'placeholderMessage':
  case 'callLogMesssage':
  case 'botInvokeMessage':
    return undefined
  case 'lottieStickerMessage':
    return { type: 'sticker', meta: { animated: true } }
  default:
    return { type: 'unknown',
      text: `[${contentType}]`,
      meta }
  }
}

// Mensagens de sistema dos grupos (entrou, saiu, promovido...)
const stubText = (message: WAMessage): string | undefined => {
  const params = (message.messageStubParameters || []).map((p: string) => `@${p.split('@')[0]}`).join(', ')
  switch (message.messageStubType) {
  case WAMessageStubType.GROUP_CREATE: return 'Grupo criado'
  case WAMessageStubType.GROUP_PARTICIPANT_ADD: return `${params} foi adicionado`
  case WAMessageStubType.GROUP_PARTICIPANT_INVITE: return `${params} entrou pelo link`
  case WAMessageStubType.GROUP_PARTICIPANT_ACCEPT: return `${params} entrou`
  case WAMessageStubType.GROUP_PARTICIPANT_REMOVE: return `${params} foi removido`
  case WAMessageStubType.GROUP_PARTICIPANT_LEAVE: return `${params} saiu`
  case WAMessageStubType.GROUP_PARTICIPANT_PROMOTE: return `${params} agora é admin`
  case WAMessageStubType.GROUP_PARTICIPANT_DEMOTE: return `${params} não é mais admin`
  case WAMessageStubType.GROUP_CHANGE_SUBJECT: return `Nome do grupo alterado para "${message.messageStubParameters?.[0] || ''}"`
  case WAMessageStubType.GROUP_CHANGE_DESCRIPTION: return 'Descrição do grupo alterada'
  case WAMessageStubType.GROUP_CHANGE_ICON: return 'Foto do grupo alterada'
  case WAMessageStubType.GROUP_CHANGE_ANNOUNCE: return 'Configuração de envio de mensagens alterada'
  case WAMessageStubType.GROUP_CHANGE_RESTRICT: return 'Configuração de edição do grupo alterada'
  default: return undefined
  }
}

// Guarda só o necessário para baixar a mídia depois (sem miniaturas, para economizar espaço)
const serializeForMedia = (message: WAMessage): string => {
  const copy = proto.WebMessageInfo.fromObject({ key: message.key,
    message: message.message })
  const content = normalizeMessageContent(copy.message)
  const type = content ? getContentType(content) : undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (content && type && (content as any)[type]) (content as any)[type].jpegThumbnail = undefined
  return JSON.stringify(copy, BufferJSON.replacer)
}

export const reviveMessage = (raw: string): WAMessage => JSON.parse(raw, BufferJSON.reviver) as WAMessage

export interface PanelMessageDTO {
  id: string
  jid: string
  fromMe: boolean
  sender?: string | null
  senderPhone?: string | null
  pushName?: string | null
  type: string
  text?: string | null
  meta: MessageMeta
  reactions: Record<string, string>
  status: number
  deleted: boolean
  edited: boolean
  sentBy?: string | null
  timestamp: number
  hasMedia: boolean
}

const safeJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export const toMessageDTO = (row: MessageRow): PanelMessageDTO => ({
  id: row.id,
  jid: row.jid,
  fromMe: !!row.fromMe,
  sender: row.sender,
  senderPhone: row.senderPhone,
  pushName: row.pushName,
  type: row.type,
  text: row.text,
  meta: safeJson<MessageMeta>(row.meta, {}),
  reactions: safeJson<Record<string, string>>(row.reactions, {}),
  status: row.status ?? 0,
  deleted: !!row.deleted,
  edited: !!row.edited,
  sentBy: row.sentBy,
  timestamp: new Date(row.timestamp).getTime(),
  hasMedia: hasMedia(row.type) && !!row.raw
})

// ---------------- Fila de gravação ----------------

interface ChatDelta {
  jid: string
  name?: string
  isGroup: boolean
  lastMessageAt: Date
  lastMessage: string
  lastFromMe: boolean
  unread: number
  incoming: boolean
}

const pendingMessages = new Map<string, MessageRow>()
const pendingChats = new Map<string, ChatDelta>()
const pendingContacts = new Map<string, { phone?: string, name: string }>()
const savedContactNames = new Map<string, string>()
// admin que enviou cada mensagem pelo painel (id -> telefone)
const sentByMap = new Map<string, string>()

export const markSentBy = (id: string, phone: string) => {
  sentByMap.set(id, phone)
  setTimeout(() => sentByMap.delete(id), 120_000)
}

export const rememberContact = (jid: string, phone: string | undefined, name: string) => {
  if (!jid || !name || isJidGroup(jid)) return
  if (savedContactNames.get(jid) === name) return
  pendingContacts.set(jid, { phone,
    name })
}

const queueChat = (delta: ChatDelta) => {
  const current = pendingChats.get(delta.jid)
  if (!current) {
    pendingChats.set(delta.jid, delta)
    return
  }
  current.unread += delta.unread
  current.incoming = current.incoming || delta.incoming
  if (delta.name) current.name = delta.name
  if (delta.lastMessageAt >= current.lastMessageAt) {
    current.lastMessageAt = delta.lastMessageAt
    current.lastMessage = delta.lastMessage
    current.lastFromMe = delta.lastFromMe
  }
}

const flush = async () => {
  if (!db) return
  if (pendingMessages.size > 0) {
    const rows = Array.from(pendingMessages.values())
    pendingMessages.clear()
    try {
      for (let i = 0; i < rows.length; i += 200) {
        await db.insert(panelMessages).values(rows.slice(i, i + 200)).onDuplicateKeyUpdate({
          set: {
            text: sql`VALUES(\`text\`)`,
            meta: sql`VALUES(\`meta\`)`,
            status: sql`GREATEST(\`status\`, VALUES(\`status\`))`,
            sentBy: sql`COALESCE(VALUES(\`sentBy\`), \`sentBy\`)`,
            raw: sql`COALESCE(VALUES(\`raw\`), \`raw\`)`
          }
        })
      }
    } catch (error) {
      logger.error(`[PAINEL] Erro ao gravar mensagens: ${error}`)
    }
  }

  if (pendingChats.size > 0) {
    const chats = Array.from(pendingChats.values())
    pendingChats.clear()
    try {
      for (const c of chats) {
        await pool.query(
          `INSERT INTO \`PanelChats\` (\`jid\`, \`name\`, \`isGroup\`, \`lastMessageAt\`, \`lastMessage\`, \`lastFromMe\`, \`unread\`)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             \`name\` = COALESCE(VALUES(\`name\`), \`name\`),
             \`lastMessage\` = IF(\`lastMessageAt\` IS NULL OR VALUES(\`lastMessageAt\`) >= \`lastMessageAt\`,
               VALUES(\`lastMessage\`), \`lastMessage\`),
             \`lastFromMe\` = IF(\`lastMessageAt\` IS NULL OR VALUES(\`lastMessageAt\`) >= \`lastMessageAt\`,
               VALUES(\`lastFromMe\`), \`lastFromMe\`),
             \`lastMessageAt\` = GREATEST(COALESCE(\`lastMessageAt\`, VALUES(\`lastMessageAt\`)), VALUES(\`lastMessageAt\`)),
             \`unread\` = \`unread\` + VALUES(\`unread\`),
             \`status\` = IF(?, 'open', \`status\`)`,
          [c.jid, c.name || null, c.isGroup ? 1 : 0, c.lastMessageAt, c.lastMessage, c.lastFromMe ? 1 : 0, c.unread,
            c.incoming ? 1 : 0]
        )
      }
    } catch (error) {
      logger.error(`[PAINEL] Erro ao gravar conversas: ${error}`)
    }
  }

  if (pendingContacts.size > 0) {
    const contacts = Array.from(pendingContacts.entries())
    pendingContacts.clear()
    try {
      const now = new Date()
      await db.insert(panelContacts)
        .values(contacts.map(([jid, c]) => ({ jid,
          phone: c.phone || null,
          name: c.name.slice(0, 255),
          lastSeenAt: now })))
        .onDuplicateKeyUpdate({
          set: {
            name: sql`VALUES(\`name\`)`,
            phone: sql`COALESCE(VALUES(\`phone\`), \`phone\`)`,
            lastSeenAt: sql`VALUES(\`lastSeenAt\`)`
          }
        })
      for (const [jid, c] of contacts) savedContactNames.set(jid, c.name)
    } catch (error) {
      logger.error(`[PAINEL] Erro ao gravar contatos: ${error}`)
    }
  }
}

let flushing = false
setInterval(async () => {
  if (flushing) return
  flushing = true
  try {
    await flush()
  } finally {
    flushing = false
  }
}, 1_500)

// ---------------- Processamento dos eventos do WhatsApp ----------------

const handleReaction = async (message: WAMessage) => {
  const reaction = message.message?.reactionMessage
  const target = reaction?.key
  if (!reaction || !target?.id || !target.remoteJid) return
  const jid = target.remoteJid
  const who = message.key.fromMe ? 'me' : (message.key.participant || message.key.remoteJid || 'unknown')
  const rows = await db.select({ reactions: panelMessages.reactions }).from(panelMessages)
    .where(and(eq(panelMessages.jid, jid), eq(panelMessages.id, target.id))).limit(1)
  // a mensagem pode estar ainda na fila
  const queued = pendingMessages.get(`${jid}|${target.id}`)
  const current = safeJson<Record<string, string>>(queued?.reactions ?? rows[0]?.reactions, {})
  if (reaction.text) current[who] = reaction.text
  else delete current[who]
  const reactions = JSON.stringify(current)
  if (queued) queued.reactions = reactions
  else if (rows.length > 0) {
    await db.update(panelMessages).set({ reactions })
      .where(and(eq(panelMessages.jid, jid), eq(panelMessages.id, target.id)))
  }
  broadcast('message-update', { jid,
    id: target.id,
    reactions: current })
}

const markDeleted = async (jid: string, id: string) => {
  const queued = pendingMessages.get(`${jid}|${id}`)
  if (queued) queued.deleted = 1
  await db.update(panelMessages).set({ deleted: 1 }).where(and(eq(panelMessages.jid, jid), eq(panelMessages.id, id)))
  broadcast('message-update', { jid,
    id,
    deleted: true })
}

const markEdited = async (jid: string, id: string, newContent: proto.IMessage) => {
  const parsed = parseContent(newContent)
  if (!parsed) return
  const queued = pendingMessages.get(`${jid}|${id}`)
  if (queued) {
    queued.text = parsed.text
    queued.edited = 1
  }
  await db.update(panelMessages).set({ text: parsed.text ?? null,
    edited: 1 })
    .where(and(eq(panelMessages.jid, jid), eq(panelMessages.id, id)))
  broadcast('message-update', { jid,
    id,
    text: parsed.text,
    edited: true })
}

const processMessage = async (message: WAMessage, isNew: boolean) => {
  const jid = message.key.remoteJid
  const id = message.key.id
  if (!jid || !id || jid === 'status@broadcast' || jid.endsWith('@newsletter') || jid.endsWith('@broadcast')) return

  const isGroup = !!isJidGroup(jid)
  if (isGroup && !panel.storeGroupMessages) return

  if (message.message?.reactionMessage) return await handleReaction(message)

  const protocol = message.message?.protocolMessage
  if (protocol) {
    if (protocol.type === proto.Message.ProtocolMessage.Type.REVOKE && protocol.key?.id) {
      return await markDeleted(jid, protocol.key.id)
    }
    if (protocol.type === proto.Message.ProtocolMessage.Type.MESSAGE_EDIT && protocol.key?.id && protocol.editedMessage) {
      return await markEdited(jid, protocol.key.id, protocol.editedMessage)
    }
    return
  }

  let parsed = parseContent(message.message)
  if (!parsed) {
    // mensagens de visualização única chegam só como "stub" no aparelho vinculado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((message.key as any).isViewOnce) parsed = { type: 'viewonce',
      meta: {} }
    else if (isGroup && message.messageStubType) {
      const text = stubText(message)
      if (!text) return
      parsed = { type: 'system',
        text,
        meta: {} }
    } else return
  }

  const fromMe = !!message.key.fromMe
  const sender = fromMe ? undefined : (message.key.participant || jid)
  const senderPhone = sender ? await getPhoneFromJid(sender) : undefined
  const timestamp = toDate(message.messageTimestamp)

  const row: MessageRow = {
    jid,
    id,
    fromMe: fromMe ? 1 : 0,
    sender: sender || null,
    senderPhone: senderPhone || null,
    pushName: fromMe ? null : (message.pushName || null),
    type: parsed.type,
    text: parsed.text ?? null,
    meta: Object.keys(parsed.meta).length ? JSON.stringify(parsed.meta) : null,
    reactions: null,
    status: message.status ?? (fromMe ? 2 : 0),
    deleted: 0,
    edited: 0,
    sentBy: sentByMap.get(id) || null,
    raw: hasMedia(parsed.type) ? serializeForMedia(message) : null,
    timestamp
  }
  pendingMessages.set(`${jid}|${id}`, row)

  if (sender && message.pushName) rememberContact(sender, senderPhone, message.pushName)

  let name: string | undefined
  if (isGroup) name = (await getFullCachedGroupMetadata(jid))?.subject
  else if (!fromMe && message.pushName) name = message.pushName

  const preview = previewFor(parsed.type, parsed.text, parsed.meta)
  const incoming = !fromMe && isNew && parsed.type !== 'system'
  const delta: ChatDelta = {
    jid,
    name,
    isGroup,
    lastMessageAt: timestamp,
    lastMessage: isGroup && !fromMe && message.pushName ? `${message.pushName}: ${preview}` : preview,
    lastFromMe: fromMe,
    unread: incoming ? 1 : 0,
    incoming
  }
  queueChat(delta)

  broadcast('message', { message: toMessageDTO(row),
    chat: { ...delta,
      lastMessageAt: timestamp.getTime() } })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const attachMessageStore = (ev: any) => {
  ev.on('messages.upsert', async (event: { messages: WAMessage[], type: string, requestId?: string }) => {
    for (const message of event.messages) {
      try {
        await processMessage(message, event.type === 'notify')
      } catch (error) {
        logger.error(`[PAINEL] Erro ao processar mensagem: ${error}`)
      }
    }
  })

  ev.on('messages.update', async (updates: { key: proto.IMessageKey, update: Partial<WAMessage> }[]) => {
    for (const { key, update } of updates) {
      try {
        if (!key.remoteJid || !key.id) continue
        if (update.message === null || update.messageStubType === WAMessageStubType.REVOKE) {
          await markDeleted(key.remoteJid, key.id)
          continue
        }
        if (typeof update.status === 'number') {
          const queued = pendingMessages.get(`${key.remoteJid}|${key.id}`)
          if (queued) queued.status = Math.max(queued.status ?? 0, update.status)
          else {
            await db.update(panelMessages).set({ status: sql`GREATEST(\`status\`, ${update.status})` })
              .where(and(eq(panelMessages.jid, key.remoteJid), eq(panelMessages.id, key.id)))
          }
          broadcast('message-update', { jid: key.remoteJid,
            id: key.id,
            status: update.status })
        }
      } catch (error) {
        logger.error(`[PAINEL] Erro ao atualizar mensagem: ${error}`)
      }
    }
  })
}

// Busca a mensagem crua (para baixar mídia / citar)
export const getRawMessage = async (jid: string, id: string): Promise<WAMessage | undefined> => {
  const queued = pendingMessages.get(`${jid}|${id}`)
  const raw = queued?.raw ?? (await db.select({ raw: panelMessages.raw }).from(panelMessages)
    .where(and(eq(panelMessages.jid, jid), eq(panelMessages.id, id))).limit(1))[0]?.raw
  return raw ? reviveMessage(raw) : undefined
}

// ---------------- Limpeza ----------------

const cleanup = async () => {
  try {
    const cutoff = new Date(Date.now() - panel.retentionDays * 86_400_000)
    await db.delete(panelMessages).where(lt(panelMessages.timestamp, cutoff))
    const usageCutoff = new Date(Date.now() - panel.usageRetentionDays * 86_400_000)
    await db.delete(usageLog).where(lt(usageLog.ts, usageCutoff))

    // cache de mídia
    if (fs.existsSync(mediaCacheDir)) {
      for (const file of await fs.promises.readdir(mediaCacheDir)) {
        const full = path.join(mediaCacheDir, file)
        const stat = await fs.promises.stat(full)
        if (stat.mtimeMs < Date.now() - 3 * 86_400_000) await fs.promises.unlink(full)
      }
    }
  } catch (error) {
    logger.error(`[PAINEL] Erro na limpeza: ${error}`)
  }
}

setInterval(() => void cleanup(), 60 * 60 * 1000)
setTimeout(() => void cleanup(), 60 * 1000)

// usado pelas rotas para apagar conversas inteiras
export const deleteChatHistory = async (jid: string) => {
  await db.delete(panelMessages).where(eq(panelMessages.jid, jid))
  await db.delete(panelChats).where(eq(panelChats.jid, jid))
}

export const getContactNames = async (jids: string[]): Promise<Record<string, string>> => {
  const unique = Array.from(new Set(jids.filter(Boolean)))
  if (unique.length == 0) return {}
  const rows = await db.select({ jid: panelContacts.jid,
    name: panelContacts.name }).from(panelContacts)
    .where(inArray(panelContacts.jid, unique))
  const result: Record<string, string> = {}
  for (const r of rows) if (r.name) result[r.jid] = r.name
  return result
}
