import { like, or } from 'drizzle-orm'

import { getClient } from '../bot'
import { baileys, bot, externalEndpoints, giphySearch, panel, stickerMeta, tenorSearch } from '../config'
import { settings } from '../db/schema'
import { db, setSetting } from '../handlers/db'
import { getLogger } from '../handlers/logger'
import { applyCommandOverride, CommandOverride } from '../handlers/text'

const logger = getLogger()

export type FieldType = 'string' | 'text' | 'number' | 'boolean' | 'select' | 'list' | 'secret' | 'group' | 'groups'

export interface ConfigField {
  key: string
  label: string
  help?: string
  section: string
  type: FieldType
  options?: { value: string | number, label: string }[]
  min?: number
  max?: number
  restart?: boolean // só vale depois de reiniciar o bot
  readonly?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get: () => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set: (value: any) => void
  // aplica a mudança no WhatsApp na hora (perfil/privacidade)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apply?: (value: any) => Promise<void>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prop = <T extends Record<string, any>>(obj: T, name: keyof T) => ({
  get: () => obj[name],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set: (value: any) => { obj[name] = value }
})

const privacyOptions = [
  { value: 'all',
    label: 'Todos' },
  { value: 'contacts',
    label: 'Meus contatos' },
  { value: 'contact_blacklist',
    label: 'Meus contatos, exceto...' },
  { value: 'none',
    label: 'Ninguém' }
]

const S = {
  general: 'Geral',
  stickers: 'Figurinhas',
  limits: 'Limites e comportamento',
  vip: 'VIP e pagamentos',
  community: 'Comunidade e grupos',
  privacy: 'Privacidade do WhatsApp',
  connection: 'Conexão',
  apis: 'APIs externas',
  panel: 'Painel',
  readonly: 'Definido no servidor (.env)'
}

const client = () => getClient()

export const configFields: ConfigField[] = [
  // Geral
  {
    key: 'bot.name',
    label: 'Nome do bot',
    section: S.general,
    type: 'string',
    ...prop(bot, 'name'),
    help: 'Usado nas mensagens do bot e no nome do perfil do WhatsApp.',
    apply: async v => { await client()?.updateProfileName(v) }
  },
  {
    key: 'bot.status',
    label: 'Recado (status do perfil)',
    section: S.general,
    type: 'text',
    ...prop(bot, 'status'),
    apply: async v => { await client()?.updateProfileStatus(v) }
  },
  {
    key: 'bot.prefixes',
    label: 'Prefixos dos comandos',
    section: S.general,
    type: 'list',
    ...prop(bot, 'prefixes'),
    help: 'Um caractere por item. Ex.: ! / # .'
  },
  { key: 'bot.donationLink',
    label: 'Chave Pix / link de doação',
    section: S.general,
    type: 'string',
    ...prop(bot, 'donationLink') },

  // Figurinhas
  { key: 'sticker.author',
    label: 'Autor das figurinhas',
    section: S.stickers,
    type: 'string',
    ...prop(stickerMeta, 'author') },
  { key: 'sticker.pack',
    label: 'Nome do pacote',
    section: S.stickers,
    type: 'string',
    ...prop(stickerMeta, 'pack') },
  {
    key: 'bot.stickers',
    label: 'Figurinhas por busca',
    section: S.stickers,
    type: 'number',
    min: 1,
    max: 20,
    ...prop(bot, 'stickers'),
    help: 'Quantas figurinhas os comandos de busca (giphy, tenor, trends...) enviam.'
  },

  // Limites
  {
    key: 'bot.rateLimitUses',
    label: 'Limite de usos por usuário',
    section: S.limits,
    type: 'number',
    min: 1,
    get: () => bot.maxUsagePerTime[0],
    set: v => { bot.maxUsagePerTime[0] = v },
    help: 'Quantos pedidos cada pessoa pode fazer dentro da janela abaixo.'
  },
  {
    key: 'bot.rateLimitSeconds',
    label: 'Janela do limite (segundos)',
    section: S.limits,
    type: 'number',
    min: 1,
    get: () => bot.maxUsagePerTime[1],
    set: v => { bot.maxUsagePerTime[1] = v }
  },
  {
    key: 'bot.sendWarnings',
    label: 'Avisar quando o comando está em intervalo',
    section: S.limits,
    type: 'boolean',
    ...prop(bot, 'sendWarnings')
  },
  { key: 'bot.refuseCalls',
    label: 'Recusar chamadas',
    section: S.limits,
    type: 'boolean',
    ...prop(bot, 'refuseCalls') },
  {
    key: 'bot.groupsOnly',
    label: 'Responder só em grupos',
    section: S.limits,
    type: 'boolean',
    ...prop(bot, 'groupsOnly'),
    help: 'Ignora conversas privadas.'
  },
  {
    key: 'bot.groupAdminOnly',
    label: 'Só grupos onde o bot é admin',
    section: S.limits,
    type: 'boolean',
    ...prop(bot, 'groupAdminOnly')
  },

  // VIP
  { key: 'bot.vipSystem',
    label: 'Sistema VIP ativo',
    section: S.vip,
    type: 'boolean',
    ...prop(bot, 'vipSystem') },
  {
    key: 'bot.vipMonthlyPrice',
    label: 'Preço mensal do VIP (R$)',
    section: S.vip,
    type: 'number',
    min: 0,
    ...prop(bot, 'vipMonthlyPrice')
  },
  {
    key: 'bot.mpAccessToken',
    label: 'Access token do Mercado Pago',
    section: S.vip,
    type: 'secret',
    restart: true,
    ...prop(bot, 'mpAccessToken')
  },
  {
    key: 'bot.mpWebhookSecret',
    label: 'Segredo do webhook do Mercado Pago',
    section: S.vip,
    type: 'secret',
    ...prop(bot, 'mpWebhookSecret')
  },

  // Comunidade
  {
    key: 'bot.community',
    label: 'Comunidade do bot',
    section: S.community,
    type: 'group',
    ...prop(bot, 'community'),
    help: 'Usada pelo ban (remove de todos os grupos) e pelo convite do !link.'
  },
  {
    key: 'bot.forceCommunity',
    label: 'Exigir participação na comunidade',
    section: S.community,
    type: 'boolean',
    ...prop(bot, 'forceCommunity'),
    help: 'Só quem está no grupo de avisos da comunidade pode usar o bot.'
  },
  {
    key: 'bot.logsGroup',
    label: 'Grupo de logs',
    section: S.community,
    type: 'group',
    ...prop(bot, 'logsGroup'),
    help: 'Onde o bot manda os avisos de ban, VIP, limites etc.'
  },
  {
    key: 'bot.groups',
    label: 'Grupos oficiais',
    section: S.community,
    type: 'groups',
    ...prop(bot, 'groups'),
    help: 'Nos grupos oficiais o bot responde mídia sem precisar ser mencionado.'
  },
  {
    key: 'bot.mutedGroups',
    label: 'Grupos silenciados',
    section: S.community,
    type: 'groups',
    ...prop(bot, 'mutedGroups'),
    help: 'O bot ignora tudo que chega destes grupos.'
  },

  // Privacidade
  {
    key: 'bot.lastSeenPrivacy',
    label: 'Visto por último',
    section: S.privacy,
    type: 'select',
    options: privacyOptions,
    ...prop(bot, 'lastSeenPrivacy'),
    apply: async v => { await client()?.updateLastSeenPrivacy(v) }
  },
  {
    key: 'bot.onlinePrivacy',
    label: 'Online',
    section: S.privacy,
    type: 'select',
    options: [{ value: 'all',
      label: 'Todos' }, { value: 'match_last_seen',
      label: 'Igual ao visto por último' }],
    ...prop(bot, 'onlinePrivacy'),
    apply: async v => { await client()?.updateOnlinePrivacy(v) }
  },
  {
    key: 'bot.profilePicPrivacy',
    label: 'Foto do perfil',
    section: S.privacy,
    type: 'select',
    options: privacyOptions,
    ...prop(bot, 'profilePicPrivacy'),
    apply: async v => { await client()?.updateProfilePicturePrivacy(v) }
  },
  {
    key: 'bot.statusPrivacyValue',
    label: 'Recado',
    section: S.privacy,
    type: 'select',
    options: privacyOptions,
    ...prop(bot, 'statusPrivacyValue'),
    apply: async v => { await client()?.updateStatusPrivacy(v) }
  },
  {
    key: 'bot.readReceiptsPrivacy',
    label: 'Confirmação de leitura',
    section: S.privacy,
    type: 'select',
    options: [{ value: 'all',
      label: 'Ativada' }, { value: 'none',
      label: 'Desativada' }],
    ...prop(bot, 'readReceiptsPrivacy'),
    apply: async v => { await client()?.updateReadReceiptsPrivacy(v) }
  },
  {
    key: 'bot.groupsAddPrivacy',
    label: 'Quem pode me adicionar em grupos',
    section: S.privacy,
    type: 'select',
    options: privacyOptions.filter(o => o.value !== 'none'),
    ...prop(bot, 'groupsAddPrivacy'),
    apply: async v => { await client()?.updateGroupsAddPrivacy(v) }
  },
  {
    key: 'bot.defaultDisappearingMode',
    label: 'Mensagens temporárias padrão',
    section: S.privacy,
    type: 'select',
    options: [
      { value: 0,
        label: 'Desativadas' },
      { value: 86400,
        label: '24 horas' },
      { value: 604800,
        label: '7 dias' },
      { value: 7776000,
        label: '90 dias' }
    ],
    ...prop(bot, 'defaultDisappearingMode'),
    apply: async v => { await client()?.updateDefaultDisappearingMode(v) }
  },
  {
    key: 'bot.setup',
    label: 'Reaplicar perfil e privacidade ao iniciar',
    section: S.privacy,
    type: 'boolean',
    ...prop(bot, 'setup'),
    help: 'Ao conectar, o bot confere nome, recado e privacidade e corrige o que estiver diferente.'
  },
  {
    key: 'bot.setProfilePic',
    label: 'Trocar a foto por uma aleatória ao iniciar',
    section: S.privacy,
    type: 'boolean',
    ...prop(bot, 'setProfilePic'),
    help: 'Só funciona com a opção acima ligada.'
  },

  // Conexão
  {
    key: 'baileys.useQrCode',
    label: 'Conectar por QR Code',
    section: S.connection,
    type: 'boolean',
    restart: true,
    ...prop(baileys, 'useQrCode'),
    help: 'Desligado = código de pareamento pelo número abaixo.'
  },
  {
    key: 'baileys.phoneNumber',
    label: 'Número do bot (pareamento)',
    section: S.connection,
    type: 'string',
    restart: true,
    ...prop(baileys, 'phoneNumber')
  },
  {
    key: 'baileys.skipUnreadMessages',
    label: 'Ignorar mensagens recebidas offline',
    section: S.connection,
    type: 'boolean',
    restart: true,
    ...prop(baileys, 'skipUnreadMessages')
  },

  // APIs
  { key: 'api.fileUploader',
    label: 'File uploader',
    section: S.apis,
    type: 'string',
    ...prop(externalEndpoints, 'fileUploader') },
  { key: 'api.memegen',
    label: 'Memegen',
    section: S.apis,
    type: 'string',
    ...prop(externalEndpoints, 'memegen') },
  { key: 'api.ttp',
    label: 'TTP / ATTP',
    section: S.apis,
    type: 'string',
    ...prop(externalEndpoints, 'ttp') },
  { key: 'api.placaFipe',
    label: 'Placa / FIPE',
    section: S.apis,
    type: 'string',
    ...prop(externalEndpoints, 'placaFipe') },
  {
    key: 'api.globoProgamming',
    label: 'Programação da Globo',
    section: S.apis,
    type: 'string',
    ...prop(externalEndpoints, 'globoProgamming')
  },
  { key: 'api.rembg',
    label: 'Remover fundo (rembg)',
    section: S.apis,
    type: 'string',
    ...prop(externalEndpoints, 'rembg') },
  { key: 'giphy.api_key',
    label: 'Chave da API do Giphy',
    section: S.apis,
    type: 'secret',
    ...prop(giphySearch, 'api_key') },
  { key: 'giphy.lang',
    label: 'Idioma do Giphy',
    section: S.apis,
    type: 'string',
    ...prop(giphySearch, 'lang') },
  { key: 'tenor.key',
    label: 'Chave da API do Tenor',
    section: S.apis,
    type: 'secret',
    ...prop(tenorSearch, 'key') },
  { key: 'tenor.locale',
    label: 'Localidade do Tenor',
    section: S.apis,
    type: 'string',
    ...prop(tenorSearch, 'locale') },

  // Painel
  {
    key: 'panel.retentionDays',
    label: 'Guardar mensagens por (dias)',
    section: S.panel,
    type: 'number',
    min: 1,
    max: 365,
    ...prop(panel, 'retentionDays')
  },
  {
    key: 'panel.storeGroupMessages',
    label: 'Guardar mensagens dos grupos',
    section: S.panel,
    type: 'boolean',
    ...prop(panel, 'storeGroupMessages'),
    help: 'Desligado, só as conversas privadas aparecem no painel.'
  },
  {
    key: 'panel.signature',
    label: 'Assinar mensagens com o nome do admin',
    section: S.panel,
    type: 'boolean',
    ...prop(panel, 'signature')
  },
  {
    key: 'panel.sessionDays',
    label: 'Duração do login (dias)',
    section: S.panel,
    type: 'number',
    min: 1,
    max: 365,
    ...prop(panel, 'sessionDays')
  },
  {
    key: 'panel.usageRetentionDays',
    label: 'Guardar estatísticas detalhadas por (dias)',
    section: S.panel,
    type: 'number',
    min: 7,
    max: 3650,
    ...prop(panel, 'usageRetentionDays')
  },

  // Somente leitura
  { key: 'ro.sessionId',
    label: 'Sessão do WhatsApp',
    section: S.readonly,
    type: 'string',
    readonly: true,
    ...prop(bot, 'sessionId') },
  { key: 'ro.dbHost',
    label: 'Servidor do banco',
    section: S.readonly,
    type: 'string',
    readonly: true,
    ...prop(bot, 'dbHost') },
  { key: 'ro.dbName',
    label: 'Banco de dados',
    section: S.readonly,
    type: 'string',
    readonly: true,
    ...prop(bot, 'dbName') }
]

// Chaves guardadas fora da tela de configurações (admins, nomes dos admins)
const hiddenFields: ConfigField[] = [
  { key: 'bot.admins',
    label: 'Admins',
    section: '',
    type: 'list',
    ...prop(bot, 'admins') },
  { key: 'panel.adminNames',
    label: 'Nomes dos admins',
    section: '',
    type: 'text',
    ...prop(panel, 'adminNames') }
]

const allFields = [...configFields, ...hiddenFields]
export const getField = (key: string) => allFields.find(f => f.key === key)

const SETTING_PREFIX = 'cfg.'
const COMMAND_PREFIX = 'cmd.'

// Valida e converte o valor recebido do painel para o tipo do campo
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const coerceValue = (field: ConfigField, value: any): any => {
  switch (field.type) {
  case 'boolean':
    return value === true || value === 'true'
  case 'number': {
    const n = Number(value)
    if (isNaN(n)) throw new Error(`${field.label}: número inválido`)
    if (field.min !== undefined && n < field.min) throw new Error(`${field.label}: mínimo ${field.min}`)
    if (field.max !== undefined && n > field.max) throw new Error(`${field.label}: máximo ${field.max}`)
    return n
  }
  case 'select': {
    const option = field.options?.find(o => String(o.value) === String(value))
    if (!option) throw new Error(`${field.label}: opção inválida`)
    return option.value
  }
  case 'list':
  case 'groups': {
    const list = Array.isArray(value) ? value : String(value || '').split(/[;,\n]/)
    return list.map((v: unknown) => String(v).trim()).filter(Boolean)
  }
  case 'group':
    return value ? String(value).trim() : undefined
  default:
    if (field.key === 'panel.adminNames') return value && typeof value === 'object' ? value : {}
    return value === null || value === undefined ? '' : String(value)
  }
}

// Salva um campo (memória + banco) e aplica no WhatsApp se for o caso
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const saveField = async (key: string, rawValue: any): Promise<void> => {
  const field = getField(key)
  if (!field || field.readonly) throw new Error(`Configuração desconhecida: ${key}`)
  const value = coerceValue(field, rawValue)
  if (key === 'bot.prefixes' && value.some((p: string) => p.length !== 1)) {
    throw new Error('Cada prefixo deve ter exatamente 1 caractere')
  }
  if (key === 'bot.admins' && value.length == 0) throw new Error('É preciso ter pelo menos um admin')
  const previous = field.get()
  field.set(value)
  try {
    if (field.apply && JSON.stringify(previous) !== JSON.stringify(value)) await field.apply(value)
  } catch (error) {
    field.set(previous)
    throw new Error(`O WhatsApp recusou a alteração de "${field.label}": ${error}`)
  }
  await setSetting(`${SETTING_PREFIX}${key}`, JSON.stringify(value ?? null))
}

export const saveCommandOverride = async (name: string, override: CommandOverride | undefined) => {
  applyCommandOverride(name, override)
  await setSetting(`${COMMAND_PREFIX}${name.toUpperCase()}`, JSON.stringify(override || {}))
}

// Carrega as configurações salvas pelo painel por cima das variáveis de ambiente. Chamado no boot.
export const loadPanelSettings = async (): Promise<void> => {
  try {
    const rows = await db.select().from(settings)
      .where(or(like(settings.key, `${SETTING_PREFIX}%`), like(settings.key, `${COMMAND_PREFIX}%`)))
    let loadedConfig = 0
    let loadedCommands = 0
    for (const row of rows) {
      try {
        const value = JSON.parse(row.value)
        if (row.key.startsWith(SETTING_PREFIX)) {
          const field = getField(row.key.slice(SETTING_PREFIX.length))
          if (!field || field.readonly) continue
          field.set(coerceValue(field, value))
          loadedConfig++
        } else {
          const override = value as CommandOverride
          if (Object.keys(override).length == 0) continue
          applyCommandOverride(row.key.slice(COMMAND_PREFIX.length), override)
          loadedCommands++
        }
      } catch (error) {
        logger.warn(`[PAINEL] Configuração inválida ignorada (${row.key}): ${error}`)
      }
    }
    logger.info(`[PAINEL] ${loadedConfig} configurações e ${loadedCommands} comandos personalizados carregados`)
  } catch (error) {
    logger.error(`[PAINEL] Erro ao carregar configurações: ${error}`)
  }
}

export const isSecretSet = (field: ConfigField) => !!field.get()

// Valor para exibir no painel (segredos nunca saem do servidor)
export const publicValue = (field: ConfigField) => {
  if (field.type === 'secret') return ''
  return field.get() ?? (field.type === 'list' || field.type === 'groups' ? [] : '')
}
