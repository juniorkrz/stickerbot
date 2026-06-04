import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'

import { bot } from '../config'
import { banned, usage, vips } from '../db/schema'
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

export const isUserBanned = async (user: string) => {
  const result = await db.select({ count: sql`COUNT(0)` }).from(banned).where(eq(banned.user, user))
  // @ts-ignore
  return Number(result[0].count) > 0
}

export const getAllBannedUsers = async (): Promise<{ user: string }[]> => {
  return await db.select({ user: banned.user }).from(banned)
}
