import { Router } from 'express'

import { getClient } from '../../bot'
import { pool } from '../../handlers/db'
import { getCachedGroupFetchAllParticipating } from '../../utils/baileysHelper'
import { h } from './util'

export const statsRouter = Router()

// Ações que geram figurinha (bot.ts + comandos de figurinha)
const STICKER_ACTIONS = ['Static Sticker', 'Animated Sticker', 'Doc as Sticker', 'Sticker with Caption']
const stickerList = STICKER_ACTIONS.map(s => `'${s}'`).join(',')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const q = async <T = any>(sql: string, params: unknown[] = []): Promise<T[]> => {
  const [rows] = await pool.query(sql, params)
  return rows as T[]
}

const daysParam = (value: unknown, def = 30) => Math.min(Math.max(parseInt(String(value || def)) || def, 1), 365)

const since = (days: number) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (days - 1))
  return d
}

const groupNames = async (): Promise<Record<string, string>> => {
  try {
    if (!getClient()) return {}
    const groups = await getCachedGroupFetchAllParticipating()
    const names: Record<string, string> = {}
    for (const [jid, g] of Object.entries(groups)) names[jid] = g.subject
    return names
  } catch {
    return {}
  }
}

statsRouter.get('/overview', h(async (_req, res) => {
  const today = since(1)
  const d7 = since(7)
  const d14 = since(14)
  const [allTime] = await q('SELECT COALESCE(SUM(`count`),0) total, ' +
    `COALESCE(SUM(IF(\`type\` IN (${stickerList}), \`count\`, 0)),0) stickers FROM \`Usage\``)
  const [periods] = await q(
    `SELECT
      SUM(ts >= ?) today,
      SUM(ts >= ? AND command IN (${stickerList})) stickersToday,
      SUM(ts >= ?) last7,
      SUM(ts >= ? AND ts < ?) prev7,
      COUNT(DISTINCT IF(ts >= ?, sender, NULL)) users7,
      COUNT(DISTINCT IF(ts >= ?, chatJid, NULL)) chats7
     FROM UsageLog WHERE ts >= ?`,
    [today, today, d7, d14, d7, d7, d7, d14]
  )
  const [vips] = await q('SELECT COUNT(*) n FROM Vips WHERE expires >= NOW() OR permanent = 1')
  const [bans] = await q('SELECT COUNT(*) n FROM Banned')
  const [ads] = await q('SELECT COALESCE(SUM(sentCount),0) sent, SUM(active=1) active FROM Ads')
  const [chats] = await q('SELECT COUNT(*) n, COALESCE(SUM(unread),0) unread, SUM(isGroup=0 AND status=\'open\' AND unread>0) waiting FROM PanelChats')
  const [firstLog] = await q('SELECT MIN(ts) first FROM UsageLog')
  let groups = 0
  try {
    if (getClient()) groups = Object.keys(await getCachedGroupFetchAllParticipating()).length
  } catch {
    groups = 0
  }
  res.json({
    allTime: { total: Number(allTime.total),
      stickers: Number(allTime.stickers) },
    today: Number(periods.today || 0),
    stickersToday: Number(periods.stickersToday || 0),
    last7: Number(periods.last7 || 0),
    prev7: Number(periods.prev7 || 0),
    users7: Number(periods.users7 || 0),
    chats7: Number(periods.chats7 || 0),
    vips: Number(vips.n),
    bans: Number(bans.n),
    adsSent: Number(ads.sent),
    adsActive: Number(ads.active || 0),
    groups,
    chats: Number(chats.n),
    unread: Number(chats.unread),
    waiting: Number(chats.waiting || 0),
    trackingSince: firstLog.first ? new Date(firstLog.first).getTime() : null
  })
}))

statsRouter.get('/timeseries', h(async (req, res) => {
  const days = daysParam(req.query.days)
  const rows = await q(
    `SELECT DATE_FORMAT(ts, '%Y-%m-%d') d, COUNT(*) total, SUM(command IN (${stickerList})) stickers,
      COUNT(DISTINCT sender) users
     FROM UsageLog WHERE ts >= ? GROUP BY d ORDER BY d`,
    [since(days)]
  )
  const byDay = new Map(rows.map(r => [r.d, r]))
  const result = []
  const cursor = since(days)
  for (let i = 0; i < days; i++) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    const r = byDay.get(key)
    result.push({
      date: key,
      total: Number(r?.total || 0),
      stickers: Number(r?.stickers || 0),
      commands: Number(r?.total || 0) - Number(r?.stickers || 0),
      users: Number(r?.users || 0)
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  res.json(result)
}))

statsRouter.get('/commands', h(async (req, res) => {
  const days = daysParam(req.query.days)
  const period = await q('SELECT command, COUNT(*) n FROM UsageLog WHERE ts >= ? GROUP BY command ORDER BY n DESC',
    [since(days)])
  const allTime = await q('SELECT `type` command, `count` n FROM `Usage` ORDER BY `count` DESC')
  res.json({
    period: period.map(r => ({ command: r.command,
      count: Number(r.n) })),
    allTime: allTime.map(r => ({ command: r.command,
      count: Number(r.n) }))
  })
}))

statsRouter.get('/top-groups', h(async (req, res) => {
  const days = daysParam(req.query.days)
  const rows = await q(
    `SELECT chatJid jid, COUNT(*) n, COUNT(DISTINCT sender) users FROM UsageLog
     WHERE ts >= ? AND isGroup = 1 GROUP BY chatJid ORDER BY n DESC LIMIT 15`,
    [since(days)]
  )
  const names = await groupNames()
  res.json(rows.map(r => ({ jid: r.jid,
    name: names[r.jid] || r.jid,
    count: Number(r.n),
    users: Number(r.users) })))
}))

statsRouter.get('/top-users', h(async (req, res) => {
  const days = daysParam(req.query.days)
  const rows = await q(
    `SELECT u.sender, COUNT(*) n, MAX(ts) last,
      (SELECT c.name FROM PanelContacts c WHERE c.phone = u.sender OR c.jid = u.sender ORDER BY c.lastSeenAt DESC LIMIT 1) name
     FROM UsageLog u WHERE ts >= ? GROUP BY u.sender ORDER BY n DESC LIMIT 15`,
    [since(days)]
  )
  res.json(rows.map(r => ({ sender: r.sender,
    name: r.name,
    count: Number(r.n),
    last: new Date(r.last).getTime() })))
}))

statsRouter.get('/heatmap', h(async (req, res) => {
  const days = daysParam(req.query.days)
  const rows = await q(
    'SELECT DAYOFWEEK(ts) - 1 dow, HOUR(ts) hour, COUNT(*) n FROM UsageLog WHERE ts >= ? GROUP BY dow, hour',
    [since(days)]
  )
  res.json(rows.map(r => ({ dow: Number(r.dow),
    hour: Number(r.hour),
    count: Number(r.n) })))
}))
