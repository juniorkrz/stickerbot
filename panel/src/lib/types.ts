export interface PanelUser {
  phone: string
  name: string
  isOwner: boolean
}

export type ConnectionStatus = 'connecting' | 'open' | 'close'

export interface SystemStatus {
  connection: { status: ConnectionStatus, since: number, hasQr: boolean }
  me: { id: string, name: string, phone: string } | null
  bot: { name: string, version: string, commands: number }
  startedAt: number
  process: { memoryMb: number, heapMb: number, node: string }
  host: { loadavg: number[], totalMemMb: number, freeMemMb: number, uptime: number }
  onlineAdmins: string[]
}

export interface Chat {
  jid: string
  name: string | null
  phone?: string
  isGroup: boolean
  lastMessageAt: number | null
  lastMessage: string | null
  lastFromMe: boolean
  unread: number
  status: 'open' | 'resolved'
  assignedTo: string | null
  assignedName: string | null
  pinned: boolean
  archived: boolean
}

export interface ChatDetail extends Chat {
  group?: {
    subject: string
    desc?: string
    size: number
    announce: boolean
    restrict: boolean
    amAdmin: boolean
    official: boolean
    muted: boolean
    isLogs: boolean
    ephemeral: number
  } | null
  contact?: {
    pushName: string | null
    isAdmin: boolean
    isBanned: boolean
    vip: { jid: string, expires: number, permanent: boolean, active: boolean } | null
    usage30d: number
    groups: { jid: string, subject: string }[]
  }
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
  quoted?: { id?: string, participant?: string, type?: string, text?: string }
  mentions?: string[]
  latitude?: number
  longitude?: number
  name?: string
  options?: string[]
}

export interface Message {
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
  pending?: boolean
}

export interface MessagesPage {
  messages: Message[]
  names: Record<string, string>
  admins: Record<string, string>
  hasMore: boolean
}

export interface GroupSummary {
  jid: string
  subject: string
  desc?: string
  size: number
  admins: number
  creation: number | null
  isCommunity: boolean
  isCommunityAnnounce: boolean
  linkedParent: string | null
  announce: boolean
  restrict: boolean
  ephemeral: number
  amAdmin: boolean
  official: boolean
  muted: boolean
  isLogs: boolean
  isBotCommunity: boolean
}

export interface Participant {
  jid: string
  phone: string | null
  name: string | null
  admin: 'admin' | 'superadmin' | null
  isMe: boolean
  isBotAdmin: boolean
  isVip: boolean
  isBanned: boolean
}

export interface GroupDetail extends GroupSummary {
  participants: Participant[]
}

export interface Member {
  jid: string
  phone: string | null
  name: string | null
  lastSeenAt: number
  isVip: boolean
  isBanned: boolean
  isAdmin: boolean
  usage30d: number
}

export interface Vip {
  jid: string
  phone: string | null
  name: string | null
  expires: number
  permanent: boolean
  active: boolean
}

export interface Ban {
  user: string
  phone: string | null
  name: string | null
}

export interface Admin {
  phone: string
  name: string | null
  whatsappName: string | null
  isOwner: boolean
}

export interface Ad {
  id: number
  content: string
  hasImage: boolean
  active: boolean
  sentCount: number
  lastSentAt: number | null
  createdAt: number
  updatedAt: number
}

export interface AdsConfig {
  every: number
  cooldown: number
  system: boolean
}

export interface CommandFields {
  aliases: string[]
  desc: string
  example?: string
  needsPrefix: boolean
  inMaintenance: boolean
  runInPrivate: boolean
  runInGroups: boolean
  onlyInBotGroup: boolean
  onlyBotAdmin: boolean
  onlyAdmin: boolean
  onlyVip: boolean
  botMustBeAdmin: boolean
  interval: number
  skipAds?: boolean
  disabled?: boolean
}

export interface Command extends CommandFields {
  key: string
  name: string
  defaults: CommandFields
  overridden: string[]
  usageAllTime: number
  usage30d: number
}

export interface ConfigField {
  key: string
  label: string
  help?: string
  section: string
  type: 'string' | 'text' | 'number' | 'boolean' | 'select' | 'list' | 'secret' | 'group' | 'groups'
  options?: { value: string | number, label: string }[]
  min?: number
  max?: number
  restart: boolean
  readonly: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any
  isSet?: boolean
}

export interface Profile {
  connected: boolean
  jid?: string
  phone?: string
  name: string
  status: string
  privacy?: Record<string, string>
}

export interface Overview {
  allTime: { total: number, stickers: number }
  today: number
  stickersToday: number
  last7: number
  prev7: number
  users7: number
  chats7: number
  vips: number
  bans: number
  adsSent: number
  adsActive: number
  groups: number
  chats: number
  unread: number
  waiting: number
  trackingSince: number | null
}

export interface DayPoint {
  date: string
  total: number
  stickers: number
  commands: number
  users: number
}

export interface LogEntry {
  id: number
  ts: number
  level: string
  message: string
}
