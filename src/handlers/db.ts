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
  await db.run(
    'CREATE TABLE IF NOT EXISTS Vips (jid TEXT, last_donation TEXT, permanent INTEGER DEFAULT 0)'
  )
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
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoString = thirtyDaysAgo.toISOString()

  const vips: {
    jid: string,
    lastDonation: string,
    permanent: boolean
  }[] = []
  await db.each(
    getPermanent
      ? 'SELECT * FROM Vips WHERE (last_donation >= ? OR permanent = 1) ORDER BY last_donation DESC'
      : 'SELECT * FROM Vips WHERE last_donation >= ? ORDER BY last_donation DESC',
    [thirtyDaysAgoString],
    (err, row) => {
      if (err) {
        logger.error(err)
        return
      }
      vips.push({
        jid: row.jid,
        lastDonation: row.last_donation,
        permanent: !!row.permanent
      })
    }
  )
  return vips
}

export const senderIsVip = async (sender: string): Promise<boolean> => {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoString = thirtyDaysAgo.toISOString()

    const vip = await db.get(
      'SELECT 1 FROM Vips WHERE jid = ? AND (last_donation >= ? OR permanent = 1)',
      sender,
      thirtyDaysAgoString
    )
    return vip !== undefined
  } catch (error) {
    logger.error(`Error checking if jid is a vip: ${error}`)
    return false
  }
}

export const addVip = async (jid: string, permanent: boolean = false) => {
  const timestamp = new Date().toISOString()
  await db.run(
    'INSERT INTO Vips (jid, last_donation, permanent) VALUES (?, ?, ?)',
    jid,
    timestamp,
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
