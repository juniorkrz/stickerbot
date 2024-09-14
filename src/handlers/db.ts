import { Database, open } from 'sqlite'
import sqlite3 from 'sqlite3'

import { bot } from '../config'
import { createDirectoryIfNotExists } from '../utils/misc'
import { getLogger } from './logger'

const logger = getLogger()

let db: Database<sqlite3.Database, sqlite3.Statement>

(async () => {
  const databaseDir = `/data/${bot.sessionId}/db`
  await createDirectoryIfNotExists(databaseDir)
  // open the database
  db = await open({
    filename: `${databaseDir}/database.sqlite`,
    driver: sqlite3.Database
  })

  await db.run('CREATE TABLE IF NOT EXISTS Usage (type TEXT, count NUM)')
  await db.run('CREATE TABLE IF NOT EXISTS Vips (jid TEXT PRIMARY KEY, expires DATETIME, permanent INTEGER)')
  await db.run('CREATE TABLE IF NOT EXISTS Banned (user TEXT)')
})()

export const getCount = async (type: string) => {
  return (
    (await db.get('SELECT count FROM Usage WHERE type = ?', type))?.count || 0
  )
}

export const addCount = async (type: string) => {
  const row = await db.get('SELECT * FROM Usage WHERE type = ?', type)
  if (row) {
    db.run('UPDATE Usage SET count = count + 1 WHERE type = ?', type)
  } else {
    db.run('INSERT INTO Usage VALUES (?, 1)', type)
  }
}

export const getVips = async (getPermanent: boolean = true) => {
  let query = 'SELECT * FROM Vips WHERE expires >= CURRENT_TIMESTAMP'
  query += getPermanent ? ' OR permanent = 1' : ''
  query += ' ORDER BY expires DESC'

  const vips: {
    jid: string,
    expires: number,
    permanent: boolean
  }[] = []
  await db.each(query, (err, row) => {
    if (err) {
      logger.error(err)
      return
    }
    vips.push({
      jid: row.jid,
      expires: row.expires,
      permanent: !!row.permanent
    })
  })
  return vips
}

export const senderIsVip = async (sender: string): Promise<boolean> => {
  try {
    const vip = await db.get(
      'SELECT 1, expires FROM Vips WHERE jid = ? AND (expires >= CURRENT_TIMESTAMP OR permanent = 1)',
      sender
    )

    return vip !== undefined
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
  const expires = new Date(now.getTime() + (months * 30 * 24 * 60 * 60 * 1000))
  await db.run(
    'INSERT OR REPLACE INTO Vips (jid, expires, permanent) VALUES (?, ?, ?)',
    jid,
    expires.toISOString(),
    permanent ? 1 : 0
  )
}

export const removeVip = async (jid: string) => {
  await db.run('DELETE FROM Vips WHERE jid = ?', jid)
}

export const ban = (user: string) => {
  db.run('INSERT INTO Banned VALUES (?)', user)
}

export const unban = (user: string) => {
  db.run('DELETE FROM Banned WHERE user = ?', user)
}

export const isUserBanned = async (user: string) => {
  return (
    (await db.get('SELECT COUNT(0) ct FROM Banned WHERE user = ?', user)).ct > 0
  )
}

export const getAllBannedUsers = async (): Promise<{ user: string }[]> => {
  return await db.all('SELECT user FROM Banned')
}
