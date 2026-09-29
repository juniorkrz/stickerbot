import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'

import { bot } from '../config'
import { banned, settings, usage, vips } from '../db/schema'
import { getLogger } from './logger'

const logger = getLogger()

export let pool: mysql.Pool
export let db: ReturnType<typeof drizzle>

export const initializeDB = async () => {
  pool = mysql.createPool({
    host: bot.dbHost,
    user: bot.dbUser,
    password: bot.dbPassword,
    database: bot.dbName,
    port: bot.dbPort,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  })

  // @ts-ignore
  db = drizzle(pool) as any

  // Ensure tables exist automatically (matches original SQLite zero-friction behavior)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`Usage\` (
      \`type\` VARCHAR(191) PRIMARY KEY,
      \`count\` INT NOT NULL DEFAULT 0
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`Vips\` (
      \`jid\` VARCHAR(191) PRIMARY KEY,
      \`expires\` DATETIME NOT NULL,
      \`permanent\` TINYINT(1) NOT NULL DEFAULT 0
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`Banned\` (
      \`user\` VARCHAR(191) PRIMARY KEY
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`Ads\` (
      \`id\` INT(11) NOT NULL AUTO_INCREMENT,
      \`content\` TEXT NOT NULL,
      \`imageBase64\` LONGTEXT,
      \`active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`sentCount\` INT(11) NOT NULL DEFAULT 0,
      \`lastSentAt\` DATETIME NULL,
      \`createdAt\` DATETIME NOT NULL,
      \`updatedAt\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`Settings\` (
      \`key\` VARCHAR(191) NOT NULL,
      \`value\` TEXT NOT NULL,
      PRIMARY KEY (\`key\`)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`Lists\` (
      \`id\` INT(11) NOT NULL AUTO_INCREMENT,
      \`groupJid\` VARCHAR(255) NOT NULL,
      \`title\` TEXT NOT NULL,
      \`subtitle\` TEXT,
      \`mainCap\` INT(11) NOT NULL,
      \`gkLabel\` VARCHAR(255),
      \`gkCap\` INT(11) NOT NULL DEFAULT 0,
      \`status\` VARCHAR(20) NOT NULL DEFAULT 'open',
      \`createdBy\` VARCHAR(255),
      \`createdAt\` DATETIME NOT NULL,
      \`updatedAt\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`group_status\` (\`groupJid\`, \`status\`)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`ListEntries\` (
      \`id\` INT(11) NOT NULL AUTO_INCREMENT,
      \`listId\` INT(11) NOT NULL,
      \`section\` VARCHAR(10) NOT NULL,
      \`name\` VARCHAR(255) NOT NULL,
      \`jid\` VARCHAR(255),
      \`addedBy\` VARCHAR(255),
      \`present\` TINYINT(1) NOT NULL DEFAULT 0,
      \`createdAt\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`listId\` (\`listId\`)
    )
  `)

  // ---- Painel de administração ----
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`PanelSessions\` (
      \`tokenHash\` VARCHAR(64) NOT NULL,
      \`phone\` VARCHAR(32) NOT NULL,
      \`userAgent\` VARCHAR(255),
      \`ip\` VARCHAR(64),
      \`createdAt\` DATETIME NOT NULL,
      \`lastSeenAt\` DATETIME NOT NULL,
      \`expiresAt\` DATETIME NOT NULL,
      PRIMARY KEY (\`tokenHash\`)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`PanelChats\` (
      \`jid\` VARCHAR(191) NOT NULL,
      \`name\` VARCHAR(255),
      \`isGroup\` TINYINT(1) NOT NULL DEFAULT 0,
      \`lastMessageAt\` DATETIME(3) NULL,
      \`lastMessage\` TEXT,
      \`lastFromMe\` TINYINT(1) NOT NULL DEFAULT 0,
      \`unread\` INT(11) NOT NULL DEFAULT 0,
      \`status\` VARCHAR(20) NOT NULL DEFAULT 'open',
      \`assignedTo\` VARCHAR(32),
      \`pinned\` TINYINT(1) NOT NULL DEFAULT 0,
      \`archived\` TINYINT(1) NOT NULL DEFAULT 0,
      PRIMARY KEY (\`jid\`),
      KEY \`lastMessageAt\` (\`lastMessageAt\`)
    ) DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`PanelMessages\` (
      \`jid\` VARCHAR(191) NOT NULL,
      \`id\` VARCHAR(128) NOT NULL,
      \`fromMe\` TINYINT(1) NOT NULL DEFAULT 0,
      \`sender\` VARCHAR(191),
      \`senderPhone\` VARCHAR(32),
      \`pushName\` VARCHAR(255),
      \`type\` VARCHAR(32) NOT NULL,
      \`text\` TEXT,
      \`meta\` TEXT,
      \`reactions\` TEXT,
      \`status\` TINYINT NOT NULL DEFAULT 0,
      \`deleted\` TINYINT(1) NOT NULL DEFAULT 0,
      \`edited\` TINYINT(1) NOT NULL DEFAULT 0,
      \`sentBy\` VARCHAR(32),
      \`raw\` LONGTEXT,
      \`timestamp\` DATETIME(3) NOT NULL,
      PRIMARY KEY (\`jid\`, \`id\`),
      KEY \`jid_ts\` (\`jid\`, \`timestamp\`),
      KEY \`ts\` (\`timestamp\`)
    ) DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`PanelContacts\` (
      \`jid\` VARCHAR(191) NOT NULL,
      \`phone\` VARCHAR(32),
      \`name\` VARCHAR(255),
      \`lastSeenAt\` DATETIME NOT NULL,
      PRIMARY KEY (\`jid\`),
      KEY \`phone\` (\`phone\`)
    ) DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`UsageLog\` (
      \`id\` BIGINT NOT NULL AUTO_INCREMENT,
      \`ts\` DATETIME NOT NULL,
      \`command\` VARCHAR(100) NOT NULL,
      \`chatJid\` VARCHAR(191),
      \`sender\` VARCHAR(191),
      \`isGroup\` TINYINT(1) NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`),
      KEY \`ts\` (\`ts\`),
      KEY \`command_ts\` (\`command\`, \`ts\`),
      KEY \`sender\` (\`sender\`)
    )
  `)

  // Idempotent column migrations for tables created before a column existed.
  // Uses information_schema so it works on both MySQL and MariaDB (no ADD COLUMN IF NOT EXISTS).
  await ensureColumn('Ads', 'sentCount', 'INT(11) NOT NULL DEFAULT 0')
  await ensureColumn('Ads', 'lastSentAt', 'DATETIME NULL')
  await ensureColumn('ListEntries', 'present', 'TINYINT(1) NOT NULL DEFAULT 0')
}

/**
 * Adds a column to a table only if it does not already exist.
 * Cross-compatible with MySQL and MariaDB (avoids ADD COLUMN IF NOT EXISTS).
 */
const ensureColumn = async (table: string, column: string, definition: string): Promise<void> => {
  const [rows] = await pool.query(
    `SELECT COUNT(0) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [bot.dbName, table, column]
  )
  // @ts-ignore
  const exists = Number(rows[0].n) > 0
  if (exists) return
  await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`)
  logger.info(`[DB] Migration: added column ${column} to ${table}`)
}

export const getCount = async (type: string) => {
  const result = await db.select().from(usage).where(eq(usage.type, type))
  return result.length > 0 ? result[0].count : 0
}

export const addCount = async (type: string) => {
  await db.insert(usage)
    .values({ type,
      count: 1 })
    .onDuplicateKeyUpdate({ set: { count: sql`${usage.count} + 1` } })
}

export const getSetting = async (key: string): Promise<string | null> => {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1)
  return rows.length > 0 ? rows[0].value : null
}

export const setSetting = async (key: string, value: string): Promise<void> => {
  await db.insert(settings)
    .values({ key,
      value })
    .onDuplicateKeyUpdate({ set: { value } })
}

export const getVips = async (getPermanent: boolean = true) => {
  // Construct dynamic query
  const query = db.select().from(vips).where(
    getPermanent
      ? sql`${vips.expires} >= CURRENT_TIMESTAMP OR ${vips.permanent} = 1`
      : sql`${vips.expires} >= CURRENT_TIMESTAMP`
  ).orderBy(sql`${vips.expires} DESC`)

  const results = await query
  return results.map(row => ({
    jid: row.jid,
    expires: new Date(row.expires).getTime(),
    permanent: !!row.permanent
  }))
}

export const senderIsVip = async (sender: string): Promise<boolean> => {
  try {
    const result = await db.select({ expires: vips.expires })
      .from(vips)
      .where(sql`${vips.jid} = ${sender} AND (${vips.expires} >= CURRENT_TIMESTAMP OR ${vips.permanent} = 1)`)
    
    return result.length > 0
  } catch (error) {
    logger.error(`Error checking if jid is a vip: ${error}`)
    return false
  }
}

export const addVip = async (
  jid: string,
  months: number,
  permanent: boolean = false
) => {
  const now = new Date()
  let baseDate = now

  // Check if already VIP
  const existingVipList = await db.select().from(vips).where(eq(vips.jid, jid))
  const existingVip = existingVipList.length > 0 ? existingVipList[0] : null

  if (existingVip && !existingVip.permanent) {
    const currentExpires = new Date(existingVip.expires)
    if (currentExpires > now) {
      baseDate = currentExpires
    }
  }

  const expires = new Date(baseDate.getTime() + (months * 30 * 24 * 60 * 60 * 1000))
  
  await db.insert(vips)
    .values({
      jid,
      expires,
      permanent: permanent ? 1 : 0
    })
    .onDuplicateKeyUpdate({
      set: {
        expires,
        permanent: permanent ? 1 : 0
      }
    })

  return expires
}

export const removeVip = async (jid: string) => {
  await db.delete(vips).where(eq(vips.jid, jid))
}

export const ban = async (user: string) => {
  // we use standard Drizzle insert to ensure type safety. Ignore duplicate keys manually with MySQL logic if needed,
  // but since it's an API wrapper, doing an ON DUPLICATE update is safer or raw query:
  await pool.query('INSERT IGNORE INTO `Banned` (`user`) VALUES (?)', [user])
}

export const unban = async (user: string) => {
  await db.delete(banned).where(eq(banned.user, user))
}

// Aceita vários identificadores do mesmo usuário: o ban pode ter sido gravado como @lid,
// como <telefone>@s.whatsapp.net ou só com o telefone.
export const isUserBanned = async (user: string | string[]) => {
  const ids = (Array.isArray(user) ? user : [user]).filter(Boolean)
  if (ids.length == 0) return false
  const result = await db.select({ count: sql`COUNT(0)` }).from(banned)
    .where(sql`${banned.user} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`)
  // @ts-ignore
  return Number(result[0].count) > 0
}

export const getAllBannedUsers = async (): Promise<{ user: string }[]> => {
  return await db.select({ user: banned.user }).from(banned)
}
