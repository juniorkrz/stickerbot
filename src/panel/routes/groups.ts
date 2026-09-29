import { GroupMetadata, jidNormalizedUser } from '@whiskeysockets/baileys'
import { Router } from 'express'

import { getClient } from '../../bot'
import { bot } from '../../config'
import { vips } from '../../db/schema'
import { getCache } from '../../handlers/cache'
import { db, getAllBannedUsers } from '../../handlers/db'
import { getLogger } from '../../handlers/logger'
import { getCachedGroupFetchAllParticipating, getPhoneFromJid, sendLogToAdmins } from '../../utils/baileysHelper'
import { adminName } from '../auth'
import { getContactNames } from '../messageStore'
import { saveField } from '../settings'
import { forgetAvatar } from './chats'
import { bad, decodeBase64File, h, notFound, toJid } from './util'

const logger = getLogger()

export const groupsRouter = Router()

const param = (value: string) => decodeURIComponent(value)

const invalidateGroups = (jid?: string) => {
  const cache = getCache()
  cache.del('AllParticipating')
  if (jid) cache.del(jid)
}

const myPhone = async () => {
  const id = getClient()?.user?.id
  return id ? await getPhoneFromJid(id) : undefined
}

const amAdminOf = async (group: GroupMetadata, me?: string) => {
  for (const p of group.participants) {
    if (!p.admin) continue
    if ((await getPhoneFromJid(p.id)) === me) return true
  }
  return false
}

const groupSummary = async (g: GroupMetadata, me?: string) => ({
  jid: g.id,
  subject: g.subject,
  desc: g.desc,
  size: g.participants.length,
  admins: g.participants.filter(p => p.admin).length,
  creation: g.creation ? g.creation * 1000 : null,
  isCommunity: !!g.isCommunity,
  isCommunityAnnounce: !!g.isCommunityAnnounce,
  linkedParent: g.linkedParent || null,
  announce: !!g.announce,
  restrict: !!g.restrict,
  ephemeral: g.ephemeralDuration || 0,
  amAdmin: await amAdminOf(g, me),
  official: bot.groups.includes(g.id),
  muted: bot.mutedGroups.includes(g.id),
  isLogs: bot.logsGroup === g.id,
  isBotCommunity: bot.community === g.id
})

groupsRouter.get('/', h(async (req, res) => {
  if (req.query.refresh) invalidateGroups()
  const groups = await getCachedGroupFetchAllParticipating()
  const me = await myPhone()
  const result = []
  for (const g of Object.values(groups)) result.push(await groupSummary(g, me))
  result.sort((a, b) => a.subject.localeCompare(b.subject))
  res.json(result)
}))

const loadGroup = async (jid: string, fresh = false): Promise<GroupMetadata> => {
  if (fresh) invalidateGroups(jid)
  try {
    const meta = await getClient().groupMetadata(jid)
    getCache().set(jid, meta, 30)
    return meta
  } catch {
    throw notFound('Grupo não encontrado (o bot saiu ou foi removido?)')
  }
}

groupsRouter.get('/:jid', h(async (req, res) => {
  const jid = param(req.params.jid)
  const group = await loadGroup(jid, true)
  const me = await myPhone()
  const jids = group.participants.map(p => p.id)
  const names = await getContactNames(jids)
  const vipRows = await db.select().from(vips)
  const activeVip = new Set(vipRows.filter(v => v.permanent || new Date(v.expires).getTime() > Date.now()).map(v => v.jid))
  const banned = new Set((await getAllBannedUsers()).map(b => b.user))

  const participants = []
  for (const p of group.participants) {
    const phone = await getPhoneFromJid(p.id)
    const ids = [p.id, ...(phone ? [phone, `${phone}@s.whatsapp.net`] : [])]
    participants.push({
      jid: p.id,
      phone: phone && phone !== p.id.split('@')[0] ? phone : (p.id.endsWith('@lid') ? null : phone),
      name: names[p.id] || (phone ? names[`${phone}@s.whatsapp.net`] : undefined) || null,
      admin: p.admin || null,
      isMe: phone === me,
      isBotAdmin: phone ? bot.admins.includes(phone) : false,
      isVip: ids.some(id => activeVip.has(id)),
      isBanned: ids.some(id => banned.has(id))
    })
  }
  participants.sort((a, b) => Number(!!b.admin) - Number(!!a.admin) || (a.name || a.phone || '').localeCompare(b.name || b.phone || ''))

  res.json({ ...(await groupSummary(group, me)),
    participants })
}))

groupsRouter.patch('/:jid', h(async (req, res) => {
  const jid = param(req.params.jid)
  const client = getClient()
  const body = req.body || {}
  const who = adminName(req.panelUser!.phone)

  if (body.subject !== undefined) {
    const subject = String(body.subject).trim()
    if (!subject) throw bad('O nome do grupo não pode ficar vazio')
    await client.groupUpdateSubject(jid, subject)
  }
  if (body.desc !== undefined) await client.groupUpdateDescription(jid, String(body.desc) || undefined)
  if (body.announce !== undefined) await client.groupSettingUpdate(jid, body.announce ? 'announcement' : 'not_announcement')
  if (body.restrict !== undefined) await client.groupSettingUpdate(jid, body.restrict ? 'locked' : 'unlocked')
  if (body.ephemeral !== undefined) await client.groupToggleEphemeral(jid, Number(body.ephemeral) || 0)

  // configurações do bot para o grupo
  const toggleList = async (key: 'bot.groups' | 'bot.mutedGroups', list: string[], on: boolean) => {
    const next = on ? Array.from(new Set([...list, jid])) : list.filter(g => g !== jid)
    await saveField(key, next)
  }
  if (body.official !== undefined) await toggleList('bot.groups', bot.groups, !!body.official)
  if (body.muted !== undefined) await toggleList('bot.mutedGroups', bot.mutedGroups, !!body.muted)
  if (body.isLogs !== undefined) {
    await saveField('bot.logsGroup', body.isLogs ? jid : (bot.logsGroup === jid ? '' : bot.logsGroup))
  }
  if (body.isBotCommunity !== undefined) {
    await saveField('bot.community', body.isBotCommunity ? jid : (bot.community === jid ? '' : bot.community))
  }

  logger.info(`[PAINEL] ${who} alterou o grupo ${jid}: ${Object.keys(body).join(', ')}`)
  invalidateGroups(jid)
  res.json({ ok: true })
}))

groupsRouter.post('/:jid/participants', h(async (req, res) => {
  const jid = param(req.params.jid)
  const action = String(req.body?.action)
  if (!['add', 'remove', 'promote', 'demote'].includes(action)) throw bad('Ação inválida')
  const list: string[] = Array.isArray(req.body?.participants) ? req.body.participants : [req.body?.participants]
  const participants = list.filter(Boolean).map(p => toJid(String(p)))
  if (participants.length == 0) throw bad('Nenhum participante informado')

  // não deixa remover/rebaixar admins do bot pelo painel por engano
  if (action === 'remove' || action === 'demote') {
    for (const p of participants) {
      const phone = await getPhoneFromJid(p)
      if (phone && phone === await myPhone()) throw bad('Para tirar o bot do grupo, use "Sair do grupo"')
    }
  }

  const result = await getClient().groupParticipantsUpdate(jid, participants, action as 'add' | 'remove' | 'promote' | 'demote')
  invalidateGroups(jid)
  const labels: Record<string, string> = { add: 'adicionou',
    remove: 'removeu',
    promote: 'promoveu',
    demote: 'rebaixou' }
  void sendLogToAdmins(`*[PAINEL]:* ${adminName(req.panelUser!.phone)} ${labels[action]} ` +
    `${participants.map(p => p.split('@')[0]).join(', ')} no grupo ${jid}`).catch(() => undefined)
  res.json({ ok: true,
    result: result.map(r => ({ jid: r.jid,
      status: r.status })) })
}))

groupsRouter.get('/:jid/invite', h(async (req, res) => {
  const code = await getClient().groupInviteCode(param(req.params.jid))
  res.json({ link: `https://chat.whatsapp.com/${code}` })
}))

groupsRouter.post('/:jid/invite/revoke', h(async (req, res) => {
  const code = await getClient().groupRevokeInvite(param(req.params.jid))
  res.json({ link: `https://chat.whatsapp.com/${code}` })
}))

groupsRouter.post('/:jid/picture', h(async (req, res) => {
  const jid = param(req.params.jid)
  await getClient().updateProfilePicture(jid, decodeBase64File(req.body?.data))
  forgetAvatar(jid)
  res.json({ ok: true })
}))

groupsRouter.post('/:jid/leave', h(async (req, res) => {
  const jid = param(req.params.jid)
  await getClient().groupLeave(jid)
  invalidateGroups(jid)
  logger.warn(`[PAINEL] ${adminName(req.panelUser!.phone)} tirou o bot do grupo ${jid}`)
  res.json({ ok: true })
}))

groupsRouter.post('/join', h(async (req, res) => {
  const link = String(req.body?.link || '').trim()
  const code = link.split('chat.whatsapp.com/')[1]?.split(/[/?#]/)[0] || link
  if (!code || code.length < 10) throw bad('Link de convite inválido')
  const jid = await getClient().groupAcceptInvite(code)
  invalidateGroups()
  res.json({ ok: true,
    jid: jid ? jidNormalizedUser(jid) : null })
}))

groupsRouter.post('/create', h(async (req, res) => {
  const subject = String(req.body?.subject || '').trim()
  if (!subject) throw bad('Informe o nome do grupo')
  const participants = (Array.isArray(req.body?.participants) ? req.body.participants : [])
    .filter(Boolean).map((p: string) => toJid(p))
  const group = await getClient().groupCreate(subject, participants)
  invalidateGroups()
  res.json({ ok: true,
    jid: group.id })
}))
