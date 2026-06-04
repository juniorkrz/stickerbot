import { datetime, int, longtext, mysqlTable, text, tinyint, varchar } from 'drizzle-orm/mysql-core'

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
