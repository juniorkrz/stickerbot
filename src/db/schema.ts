import { datetime, int, mysqlTable, tinyint, varchar } from 'drizzle-orm/mysql-core'

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
