import { isJidGroup } from '@whiskeysockets/baileys'

import { usageLog } from '../db/schema'
import { db } from '../handlers/db'
import { getLogger } from '../handlers/logger'
import { getPhoneFromJid } from '../utils/baileysHelper'
import { rememberContact } from './messageStore'

const logger = getLogger()

type UsageRow = typeof usageLog.$inferInsert

// Buffer em memória, gravado em lote a cada poucos segundos (evita 1 INSERT por figurinha)
let pending: UsageRow[] = []

/**
 * Registra um uso (comando/figurinha) para as estatísticas do painel.
 * Fire-and-forget: nunca lança erro para quem chamou.
 */
export const recordUsage = (command: string, chatJid: string, senderJid: string, pushName?: string | null) => {
  const ts = new Date()
  void (async () => {
    try {
      const phone = await getPhoneFromJid(senderJid)
      pending.push({
        ts,
        command: command.slice(0, 100),
        chatJid,
        sender: phone || senderJid,
        isGroup: isJidGroup(chatJid) ? 1 : 0
      })
      if (pushName) rememberContact(senderJid, phone, pushName)
    } catch (error) {
      logger.error(`[PAINEL] Erro ao registrar uso: ${error}`)
    }
  })()
}

const flush = async () => {
  if (pending.length == 0 || !db) return
  const rows = pending
  pending = []
  try {
    await db.insert(usageLog).values(rows)
  } catch (error) {
    logger.error(`[PAINEL] Erro ao gravar log de uso (${rows.length} linhas): ${error}`)
  }
}

setInterval(() => void flush(), 5_000)
