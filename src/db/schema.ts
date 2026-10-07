import { bigint, datetime, index, int, longtext, mysqlTable, primaryKey, text, tinyint, varchar } from 'drizzle-orm/mysql-core'

export const usage = mysqlTable('Usage', {
  type: varchar('type', { length: 191 }).primaryKey(),
  count: int('count').default(0).notNull(),
})

export const vips = mysqlTable('Vips', {
  jid: varchar('jid', { length: 191 }).primaryKey(),
  expires: datetime('expires').notNull(),
  permanent: tinyint('permanent').default(0).notNull(),
})

export const banned = mysqlTable('Banned', {
  user: varchar('user', { length: 191 }).primaryKey(),
})

export const ads = mysqlTable('Ads', {
  id: int('id').primaryKey().autoincrement(),
  content: text('content').notNull(),
  imageBase64: longtext('imageBase64'),
  active: tinyint('active').default(1).notNull(),
  sentCount: int('sentCount').default(0).notNull(),
  lastSentAt: datetime('lastSentAt'),
  createdAt: datetime('createdAt').notNull(),
  updatedAt: datetime('updatedAt').notNull(),
})

// Generic runtime key/value config (e.g. ads.every, ads.cooldown, ads.system).
export const settings = mysqlTable('Settings', {
  key: varchar('key', { length: 191 }).primaryKey(),
  value: text('value').notNull(),
})

// Group lists (e.g. pelada): one active (status 'open') list per group.
export const lists = mysqlTable('Lists', {
  id: int('id').primaryKey().autoincrement(),
  groupJid: varchar('groupJid', { length: 255 }).notNull(),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  mainCap: int('mainCap').notNull(),
  gkLabel: varchar('gkLabel', { length: 255 }),
  gkCap: int('gkCap').default(0).notNull(),
  status: varchar('status', { length: 20 }).default('open').notNull(),
  createdBy: varchar('createdBy', { length: 255 }),
  createdAt: datetime('createdAt').notNull(),
  updatedAt: datetime('updatedAt').notNull(),
})

// Entries of a list. Render order = insertion order (id). Reserves = 'main' rows beyond mainCap.
export const listEntries = mysqlTable('ListEntries', {
  id: int('id').primaryKey().autoincrement(),
  listId: int('listId').notNull(),
  section: varchar('section', { length: 10 }).notNull(), // 'main' | 'gk'
  name: varchar('name', { length: 255 }).notNull(),
  jid: varchar('jid', { length: 255 }), // null = guest (added by someone)
  addedBy: varchar('addedBy', { length: 255 }), // display name of who added a guest
  present: tinyint('present').default(0).notNull(),
  createdAt: datetime('createdAt').notNull(),
})

// ---- Painel de administração (/painel) ----

// Sessões de login do painel (token guardado como sha256)
export const panelSessions = mysqlTable('PanelSessions', {
  tokenHash: varchar('tokenHash', { length: 64 }).primaryKey(),
  phone: varchar('phone', { length: 32 }).notNull(),
  userAgent: varchar('userAgent', { length: 255 }),
  ip: varchar('ip', { length: 64 }),
  createdAt: datetime('createdAt').notNull(),
  lastSeenAt: datetime('lastSeenAt').notNull(),
  expiresAt: datetime('expiresAt').notNull(),
})

// Conversas vistas pelo bot (lista estilo WhatsApp Web)
export const panelChats = mysqlTable('PanelChats', {
  jid: varchar('jid', { length: 191 }).primaryKey(),
  name: varchar('name', { length: 255 }),
  isGroup: tinyint('isGroup').default(0).notNull(),
  lastMessageAt: datetime('lastMessageAt', { fsp: 3 }),
  lastMessage: text('lastMessage'),
  lastFromMe: tinyint('lastFromMe').default(0).notNull(),
  unread: int('unread').default(0).notNull(),
  status: varchar('status', { length: 20 }).default('open').notNull(), // 'open' | 'resolved'
  assignedTo: varchar('assignedTo', { length: 32 }),
  pinned: tinyint('pinned').default(0).notNull(),
  archived: tinyint('archived').default(0).notNull(),
}, (t) => [index('lastMessageAt').on(t.lastMessageAt)])

// Mensagens das conversas (raw = WAMessage serializada, só p/ mídia, para baixar sob demanda)
export const panelMessages = mysqlTable('PanelMessages', {
  jid: varchar('jid', { length: 191 }).notNull(),
  id: varchar('id', { length: 128 }).notNull(),
  fromMe: tinyint('fromMe').default(0).notNull(),
  sender: varchar('sender', { length: 191 }),
  senderPhone: varchar('senderPhone', { length: 32 }),
  pushName: varchar('pushName', { length: 255 }),
  type: varchar('type', { length: 32 }).notNull(),
  text: text('text'),
  meta: text('meta'), // JSON: mimetype, fileName, seconds, quoted, etc.
  reactions: text('reactions'), // JSON { senderJid: emoji }
  status: tinyint('status').default(0).notNull(),
  deleted: tinyint('deleted').default(0).notNull(),
  edited: tinyint('edited').default(0).notNull(),
  sentBy: varchar('sentBy', { length: 32 }), // admin do painel que enviou
  raw: longtext('raw'),
  timestamp: datetime('timestamp', { fsp: 3 }).notNull(),
}, (t) => [primaryKey({ columns: [t.jid, t.id] }), index('jid_ts').on(t.jid, t.timestamp), index('ts').on(t.timestamp)])

// Contatos conhecidos (nome do WhatsApp + telefone)
export const panelContacts = mysqlTable('PanelContacts', {
  jid: varchar('jid', { length: 191 }).primaryKey(),
  phone: varchar('phone', { length: 32 }),
  name: varchar('name', { length: 255 }),
  lastSeenAt: datetime('lastSeenAt').notNull(),
}, (t) => [index('phone').on(t.phone)])

// Log de uso (1 linha por comando/figurinha) para as estatísticas
export const usageLog = mysqlTable('UsageLog', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  ts: datetime('ts').notNull(),
  command: varchar('command', { length: 100 }).notNull(),
  chatJid: varchar('chatJid', { length: 191 }),
  sender: varchar('sender', { length: 191 }),
  isGroup: tinyint('isGroup').default(0).notNull(),
}, (t) => [index('ts').on(t.ts), index('command_ts').on(t.command, t.ts), index('sender').on(t.sender)])
