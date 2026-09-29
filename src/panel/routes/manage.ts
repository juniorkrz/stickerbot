import { jidNormalizedUser } from '@whiskeysockets/baileys'
import { Router } from 'express'
import { normalizeText } from 'normalize-text'

import { getClient } from '../../bot'
import { bot } from '../../config'
import { ads } from '../../db/schema'
import {
  addAd,
  getAdById,
  getAdsConfig,
  getAllAds,
  removeAd,
  sendAdPreviewById,
  setAdsCooldown,
  setAdsEvery,
  setAdsSystem,
  updateAd
} from '../../handlers/ads'
import { getSetting, pool } from '../../handlers/db'
import { getLogger } from '../../handlers/logger'
import {
  allCommands,
  CommandOverride,
  editableCommandFields,
  getCommandDefaults
} from '../../handlers/text'
import { adminName } from '../auth'
import { configFields, isSecretSet, publicValue, saveCommandOverride, saveField } from '../settings'
import { forgetAvatar } from './chats'
import { bad, decodeBase64File, h, notFound, toJid } from './util'

const logger = getLogger()

// ================= Anúncios =================

export const adsRouter = Router()

type AdRow = typeof ads.$inferSelect

const adDTO = (ad: AdRow) => ({
  id: ad.id,
  content: ad.content,
  hasImage: !!ad.imageBase64,
  active: !!ad.active,
  sentCount: ad.sentCount,
  lastSentAt: ad.lastSentAt ? new Date(ad.lastSentAt).getTime() : null,
  createdAt: new Date(ad.createdAt).getTime(),
  updatedAt: new Date(ad.updatedAt).getTime()
})

const toImageBase64 = (data: unknown): string => {
  const value = String(data || '')
  const mime = value.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg'
  const buffer = decodeBase64File(value)
  if (buffer.length > 5 * 1024 * 1024) throw bad('Imagem muito grande (máx. 5 MB)')
  return `data:${mime};base64,${buffer.toString('base64')}`
}

adsRouter.get('/', h(async (_req, res) => {
  res.json((await getAllAds()).map(adDTO))
}))

adsRouter.get('/config', h(async (_req, res) => {
  res.json(getAdsConfig())
}))

adsRouter.put('/config', h(async (req, res) => {
  const { every, cooldown, system } = req.body || {}
  if (every !== undefined) {
    const n = parseInt(every)
    if (!(n > 0)) throw bad('"A cada" precisa ser maior que zero')
    await setAdsEvery(n)
  }
  if (cooldown !== undefined) {
    const n = parseInt(cooldown)
    if (!(n >= 0)) throw bad('Intervalo inválido')
    await setAdsCooldown(n)
  }
  if (system !== undefined) await setAdsSystem(!!system)
  res.json(getAdsConfig())
}))

adsRouter.get('/:id/image', h(async (req, res) => {
  const ad = await getAdById(Number(req.params.id))
  if (!ad?.imageBase64) throw notFound('Anúncio sem imagem')
  const mime = ad.imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg'
  res.set('Cache-Control', 'private, max-age=60')
  res.type(mime).send(Buffer.from(ad.imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64'))
}))

adsRouter.post('/', h(async (req, res) => {
  const content = String(req.body?.content || '').trim()
  if (!content) throw bad('O texto do anúncio é obrigatório')
  await addAd(content, req.body?.image ? toImageBase64(req.body.image) : null)
  logger.info(`[PAINEL] ${adminName(req.panelUser!.phone)} criou um anúncio`)
  res.json({ ok: true })
}))

adsRouter.patch('/:id', h(async (req, res) => {
  const id = Number(req.params.id)
  if (!await getAdById(id)) throw notFound('Anúncio não encontrado')
  const body = req.body || {}
  const data: { content?: string, imageBase64?: string | null, active?: boolean } = {}
  if (body.content !== undefined) {
    data.content = String(body.content).trim()
    if (!data.content) throw bad('O texto do anúncio é obrigatório')
  }
  if (body.active !== undefined) data.active = !!body.active
  if (body.image === null) data.imageBase64 = null
  else if (body.image) data.imageBase64 = toImageBase64(body.image)
  await updateAd(id, data)
  res.json({ ok: true })
}))

adsRouter.delete('/:id', h(async (req, res) => {
  await removeAd(Number(req.params.id))
  logger.info(`[PAINEL] ${adminName(req.panelUser!.phone)} apagou o anúncio ${req.params.id}`)
  res.json({ ok: true })
}))

adsRouter.post('/:id/test', h(async (req, res) => {
  const jid = toJid(String(req.body?.jid || req.panelUser!.phone))
  const sent = await sendAdPreviewById(jid, Number(req.params.id))
  if (!sent) throw bad('Não foi possível enviar o teste')
  res.json({ ok: true })
}))

// ================= Comandos =================

export const commandsRouter = Router()

const readOverride = async (name: string): Promise<CommandOverride> => {
  const raw = await getSetting(`cmd.${name.toUpperCase()}`)
  try {
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

commandsRouter.get('/', h(async (_req, res) => {
  const [usageRows] = await pool.query('SELECT `type`, `count` FROM `Usage`')
  const usage = new Map((usageRows as { type: string, count: number }[]).map(r => [r.type.toUpperCase(), Number(r.count)]))
  const [recentRows] = await pool.query('SELECT command, COUNT(*) n FROM UsageLog WHERE ts >= NOW() - INTERVAL 30 DAY GROUP BY command')
  const recent = new Map((recentRows as { command: string, n: number }[]).map(r => [r.command.toUpperCase(), Number(r.n)]))

  const result = []
  for (const [key, command] of Object.entries(allCommands)) {
    const current: Record<string, unknown> = {}
    for (const field of editableCommandFields) current[field] = command[field]
    current.disabled = !!command.disabled
    const override = await readOverride(key)
    result.push({
      key,
      name: command.name,
      ...current,
      defaults: getCommandDefaults(key),
      overridden: Object.keys(override),
      usageAllTime: usage.get(key) || 0,
      usage30d: recent.get(key) || 0
    })
  }
  result.sort((a, b) => a.name.localeCompare(b.name))
  res.json(result)
}))

const normalizeAlias = (alias: string) => normalizeText(alias.toLowerCase()).trim()

commandsRouter.patch('/:name', h(async (req, res) => {
  const key = req.params.name.toUpperCase()
  const command = allCommands[key]
  if (!command) throw notFound('Comando não encontrado')
  const defaults = getCommandDefaults(key)!
  const body = req.body || {}
  const override: Record<string, unknown> = { ...(await readOverride(key)) }

  for (const field of editableCommandFields) {
    if (body[field] === undefined) continue
    let value = body[field]
    const def = defaults[field]
    if (field === 'aliases') {
      const list = (Array.isArray(value) ? value : String(value).split(/[,;\n]/))
        .map((a: unknown) => String(a).trim().replace(/^[!/#@.]/, ''))
        .filter(Boolean)
      if (list.length == 0) throw bad('O comando precisa de pelo menos um nome (alias)')
      // não deixa dois comandos ativos com o mesmo alias
      for (const [otherKey, other] of Object.entries(allCommands)) {
        if (otherKey === key || other.disabled) continue
        const clash = list.find((a: string) => other.aliases.map(normalizeAlias).includes(normalizeAlias(a)))
        if (clash) throw bad(`O alias "${clash}" já é usado pelo comando ${other.name}`)
      }
      value = list
    } else if (field === 'interval') {
      value = Number(value)
      if (!(value >= 0) || value > 86400) throw bad('Intervalo inválido (0 a 86400 segundos)')
    } else if (field === 'desc' || field === 'example') {
      value = String(value || '').trim() || (field === 'example' ? undefined : '')
    } else {
      value = !!value
    }
    // guarda só o que difere do padrão do código
    if (JSON.stringify(value) === JSON.stringify(def ?? (typeof value === 'boolean' ? false : undefined))) delete override[field]
    else override[field] = value
  }

  await saveCommandOverride(key, override as CommandOverride)
  logger.info(`[PAINEL] ${adminName(req.panelUser!.phone)} alterou o comando ${command.name}`)
  res.json({ ok: true })
}))

commandsRouter.post('/:name/reset', h(async (req, res) => {
  const key = req.params.name.toUpperCase()
  if (!allCommands[key]) throw notFound('Comando não encontrado')
  await saveCommandOverride(key, undefined)
  res.json({ ok: true })
}))

// ================= Configurações =================

export const configRouter = Router()

configRouter.get('/', h(async (_req, res) => {
  res.json(configFields.map(f => ({
    key: f.key,
    label: f.label,
    help: f.help,
    section: f.section,
    type: f.type,
    options: f.options,
    min: f.min,
    max: f.max,
    restart: !!f.restart,
    readonly: !!f.readonly,
    value: publicValue(f),
    isSet: f.type === 'secret' ? isSecretSet(f) : undefined
  })))
}))

configRouter.put('/', h(async (req, res) => {
  const values: Record<string, unknown> = req.body?.values || {}
  const errors: Record<string, string> = {}
  const saved: string[] = []
  let restart = false
  for (const [key, value] of Object.entries(values)) {
    const field = configFields.find(f => f.key === key)
    if (!field || field.readonly) continue
    // segredo em branco = manter o atual (use clear para apagar)
    if (field.type === 'secret' && value === '' ) continue
    try {
      await saveField(key, value === '__clear__' ? '' : value)
      saved.push(key)
      if (field.restart) restart = true
    } catch (error) {
      errors[key] = error instanceof Error ? error.message : String(error)
    }
  }
  if (saved.length) logger.info(`[PAINEL] ${adminName(req.panelUser!.phone)} alterou: ${saved.join(', ')}`)
  res.status(Object.keys(errors).length && !saved.length ? 400 : 200).json({ saved,
    errors,
    restart })
}))

// ================= Perfil do bot =================

export const profileRouter = Router()

profileRouter.get('/', h(async (_req, res) => {
  const client = getClient()
  const me = client?.user
  if (!me) return res.json({ connected: false,
    name: bot.name,
    status: bot.status })
  const jid = jidNormalizedUser(me.id)
  let status: string | null = null
  try {
    const result = await client.fetchStatus(jid)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status = (result?.[0] as any)?.status?.status ?? null
  } catch {
    status = null
  }
  let privacy = {}
  try {
    privacy = await client.fetchPrivacySettings(true)
  } catch {
    privacy = {}
  }
  res.json({
    connected: true,
    jid,
    phone: jid.split('@')[0],
    name: me.name || bot.name,
    status: status ?? bot.status,
    privacy
  })
}))

profileRouter.put('/', h(async (req, res) => {
  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim()
    if (!name) throw bad('O nome não pode ficar vazio')
    await saveField('bot.name', name)
  }
  if (req.body?.status !== undefined) await saveField('bot.status', String(req.body.status))
  logger.info(`[PAINEL] ${adminName(req.panelUser!.phone)} alterou o perfil do bot`)
  res.json({ ok: true })
}))

profileRouter.post('/picture', h(async (req, res) => {
  const client = getClient()
  const jid = jidNormalizedUser(client.user!.id)
  await client.updateProfilePicture(jid, decodeBase64File(req.body?.data))
  forgetAvatar(jid)
  logger.info(`[PAINEL] ${adminName(req.panelUser!.phone)} trocou a foto do bot`)
  res.json({ ok: true })
}))

profileRouter.delete('/picture', h(async (req, res) => {
  const client = getClient()
  const jid = jidNormalizedUser(client.user!.id)
  await client.removeProfilePicture(jid)
  forgetAvatar(jid)
  res.json({ ok: true })
}))
