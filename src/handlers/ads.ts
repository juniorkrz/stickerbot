import { eq, sql } from 'drizzle-orm'

import { getClient } from '../bot'
import { bot } from '../config'
import { ads } from '../db/schema'
import { spintax } from '../utils/misc'
import { db, getSetting, setSetting } from './db'
import { getLogger } from './logger'

const logger = getLogger()

type AdRow = typeof ads.$inferSelect

// Global counter of stickers created since the last ad was sent.
// In-memory on purpose: resetting on restart is harmless for ads.
let stickerCounter = 0
// Timestamp (ms) of the last ad sent per chat, to enforce a cooldown.
const lastAdByChat = new Map<string, number>()
// In-flight guard: a single synchronous flag that stops a burst of concurrent stickers
// from each crossing the counter threshold and dispatching duplicate ads.
let dispatching = false

// Effective runtime config, seeded from ENV and overridable via commands (persisted in the
// Settings table). Cached in memory so maybeSendAd never touches the DB to read config.
let adsEvery = bot.adsEvery
let adsCooldown = bot.adsChatCooldown
let adsSystemOn = bot.adsSystem

const SETTING_EVERY = 'ads.every'
const SETTING_COOLDOWN = 'ads.cooldown'
const SETTING_SYSTEM = 'ads.system'

// Loads persisted ads config from the DB into the in-memory cache. Called once at boot.
// Missing keys keep their ENV-seeded defaults (ENV acts as the fallback).
export const loadAdsConfig = async (): Promise<void> => {
  try {
    const every = await getSetting(SETTING_EVERY)
    const cooldown = await getSetting(SETTING_COOLDOWN)
    const system = await getSetting(SETTING_SYSTEM)
    if (every !== null) {
      const n = parseInt(every)
      if (!isNaN(n) && n > 0) adsEvery = n
    }
    if (cooldown !== null) {
      const n = parseInt(cooldown)
      if (!isNaN(n) && n >= 0) adsCooldown = n
    }
    if (system !== null) adsSystemOn = system === 'true'
    logger.info(`[ADS] Config: every=${adsEvery} cooldown=${adsCooldown}s system=${adsSystemOn}`)
  } catch (error) {
    logger.error(`[ADS] Failed to load config, using ENV defaults: ${error}`)
  }
}

// Current effective config, for display by the !ads command.
export const getAdsConfig = () => ({
  every: adsEvery,
  cooldown: adsCooldown,
  system: adsSystemOn
})

export const setAdsEvery = async (n: number): Promise<void> => {
  adsEvery = n
  await setSetting(SETTING_EVERY, String(n))
}

export const setAdsCooldown = async (seconds: number): Promise<void> => {
  adsCooldown = seconds
  await setSetting(SETTING_COOLDOWN, String(seconds))
}

export const setAdsSystem = async (on: boolean): Promise<void> => {
  adsSystemOn = on
  await setSetting(SETTING_SYSTEM, on ? 'true' : 'false')
}

export const getAllAds = async (): Promise<AdRow[]> => {
  return await db.select().from(ads).orderBy(ads.id)
}

export const getRandomActiveAd = async (): Promise<AdRow | null> => {
  const rows = await db.select()
    .from(ads)
    .where(eq(ads.active, 1))
    .orderBy(sql`RAND()`)
    .limit(1)
  return rows.length > 0 ? rows[0] : null
}

export const getAdById = async (id: number): Promise<AdRow | null> => {
  const rows = await db.select().from(ads).where(eq(ads.id, id)).limit(1)
  return rows.length > 0 ? rows[0] : null
}

export const addAd = async (content: string, imageBase64?: string | null): Promise<void> => {
  const now = new Date()
  await db.insert(ads).values({
    content,
    imageBase64: imageBase64 ?? null,
    active: 1,
    createdAt: now,
    updatedAt: now
  })
}

export const removeAd = async (id: number): Promise<void> => {
  await db.delete(ads).where(eq(ads.id, id))
}

export const setAdActive = async (id: number, active: boolean): Promise<void> => {
  await db.update(ads)
    .set({
      active: active ? 1 : 0,
      updatedAt: new Date()
    })
    .where(eq(ads.id, id))
}

// Records one real dispatch: bumps the counter and stores the timestamp.
// Test previews (!ads test) intentionally do NOT call this.
export const incrementSentCount = async (id: number): Promise<void> => {
  await db.update(ads)
    .set({
      sentCount: sql`${ads.sentCount} + 1`,
      lastSentAt: new Date()
    })
    .where(eq(ads.id, id))
}

// Sends a given ad to a chat. Returns true if it was actually sent.
const dispatchAd = async (jid: string, ad: AdRow): Promise<boolean> => {
  const client = getClient()
  if (!client) return false

  const text = spintax(ad.content)

  if (ad.imageBase64) {
    const base64Data = ad.imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const imageBuffer = Buffer.from(base64Data, 'base64')
    await client.sendMessage(jid, {
      image: imageBuffer,
      caption: text
    })
  } else {
    await client.sendMessage(jid, { text })
  }

  return true
}

/**
 * Sends a random active ad to a chat, ignoring counter and cooldown.
 * Used by the !ads test command. Returns the sent ad id, or null if none.
 */
export const sendAdPreview = async (jid: string): Promise<number | null> => {
  const ad = await getRandomActiveAd()
  if (!ad) return null
  const sent = await dispatchAd(jid, ad)
  return sent ? ad.id : null
}

/**
 * Called after each successful sticker creation. Sends an ad to the same chat
 * once every `adsEvery` stickers, respecting a per-chat cooldown.
 * Never throws: an ad failure must not break sticker creation.
 */
export const maybeSendAd = async (jid: string | null | undefined): Promise<void> => {
  try {
    if (!adsSystemOn || !jid) return

    stickerCounter++
    if (stickerCounter < adsEvery) return

    // An ad is already being dispatched. Bail WITHOUT resetting the counter: this stops a
    // burst of concurrent stickers from each crossing the threshold and sending duplicates.
    if (dispatching) return

    // If this chat got an ad recently, hold off WITHOUT resetting the counter, so the
    // pending ad flows to the next sticker from an eligible chat.
    const cooldownMs = adsCooldown * 1000
    const lastAd = lastAdByChat.get(jid)
    if (lastAd && Date.now() - lastAd < cooldownMs) return

    // Claim the slot synchronously: there is no `await` between stickerCounter++ above and
    // this assignment, so JS runs that whole block atomically (no interleaving possible).
    dispatching = true
    try {
      const ad = await getRandomActiveAd()
      if (!ad) return

      const sent = await dispatchAd(jid, ad)
      if (!sent) return

      // Consume the credit only on a real send: reset the counter and start this chat's
      // cooldown. On failure/no-ad the counter is left intact so the credit isn't lost.
      stickerCounter = 0
      lastAdByChat.set(jid, Date.now())
      logger.info(`[ADS] Sent ad ID ${ad.id} to ${jid}`)
      await incrementSentCount(ad.id)
    } finally {
      dispatching = false
    }
  } catch (error) {
    logger.error(`[ADS] Error sending ad: ${error}`)
  }
}
