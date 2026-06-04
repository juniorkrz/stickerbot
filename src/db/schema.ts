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
