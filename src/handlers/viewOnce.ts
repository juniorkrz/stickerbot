import {
  AnyMessageContent,
  downloadMediaMessage,
  extractMessageContent,
  GroupMetadata,
  WAMessage,
  WAMessageContent
} from '@whiskeysockets/baileys'

import { getClient, getStore } from '../bot'
import { getBody, getMessageOptions, logAction } from '../utils/baileysHelper'
import { getLogger } from './logger'

const logger = getLogger()

// Hidden command: reply to a view once message with just this emoji to receive the media privately
const EYES = '👀'

/*
 * WhatsApp no longer delivers view once media to linked devices (like this bot):
 * they arrive as an empty stub with `key.isViewOnce`. The content can still be recovered from
 * `contextInfo.quotedMessage` of a reply sent from a phone, which carries the full media message.
 */

/** Returns the unwrapped content if it is a view once image/video/audio, otherwise undefined */
export const getViewOnceContent = (message: WAMessageContent | null | undefined) => {
  if (!message) return
  const inner = message.ephemeralMessage?.message || message
  const isWrapped = !!(inner.viewOnceMessage || inner.viewOnceMessageV2 || inner.viewOnceMessageV2Extension)
  const content = extractMessageContent(message)
  const media = content?.imageMessage || content?.videoMessage || content?.audioMessage
  if (!content || !media) return
  if (isWrapped || media.viewOnce) return content
}

const getContextInfo = (message: WAMessage) => {
  const content = extractMessageContent(message.message)
  return (
    content?.extendedTextMessage?.contextInfo ||
    content?.imageMessage?.contextInfo ||
    content?.videoMessage?.contextInfo ||
    content?.stickerMessage?.contextInfo ||
    content?.audioMessage?.contextInfo ||
    content?.documentMessage?.contextInfo
  )
}

/** Key and (if available) content of the message quoted by `message` */
export const getQuotedFromContext = (message: WAMessage): WAMessage | undefined => {
  const contextInfo = getContextInfo(message)
  if (!contextInfo?.stanzaId) return
  return {
    key: {
      remoteJid: contextInfo.remoteJid || message.key.remoteJid,
      id: contextInfo.stanzaId,
      participant: contextInfo.participant || undefined,
      fromMe: false
    },
    message: contextInfo.quotedMessage
  }
}

/** Looks for a message by id in every chat of the store (the chat jid may differ between PN and LID) */
const findInStore = (id: string) => {
  const store = getStore()
  for (const chat of Object.values(store.messages)) {
    const found = chat.get(id)
    if (found) return found
  }
}

/** Resolves the view once media from the quote, falling back to the store */
const resolveViewOnceMessage = (candidate: WAMessage) => {
  const quoteContent = getViewOnceContent(candidate.message)
  if (quoteContent) return {
    message: candidate,
    content: quoteContent
  }

  const stored = candidate.key.id ? findInStore(candidate.key.id) : undefined
  const storedContent = getViewOnceContent(stored?.message)
  if (stored && storedContent) return {
    message: stored,
    content: storedContent
  }
}

const downloadMedia = async (message: WAMessage) => {
  const client = getClient()
  try {
    const ctx = {
      reuploadRequest: client.updateMediaMessage,
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      logger: logger as any
    }
    return <Buffer>await downloadMediaMessage(message, 'buffer', {}, ctx)
  } catch (error) {
    logger.warn(`[VIEW ONCE] Failed to download media: ${error}`)
  }
}

const buildRelayContent = (content: WAMessageContent, buffer: Buffer): AnyMessageContent | undefined => {
  if (content.imageMessage) return {
    image: buffer,
    caption: content.imageMessage.caption || undefined
  }
  if (content.videoMessage) return {
    video: buffer,
    caption: content.videoMessage.caption || undefined
  }
  if (content.audioMessage) return {
    audio: buffer,
    ptt: true,
    mimetype: content.audioMessage.mimetype || 'audio/ogg; codecs=opus'
  }
}

/** Resolves, downloads and sends the view once media to `relayTo`. Returns true on success. */
export const relayViewOnce = async (candidate: WAMessage, relayTo: string) => {
  const resolved = resolveViewOnceMessage(candidate)
  if (!resolved) return false

  const buffer = await downloadMedia(resolved.message)
  if (!buffer) return false

  const responseContent = buildRelayContent(resolved.content, buffer)
  if (!responseContent) return false

  logger.info(`[VIEW ONCE] Relaying ${candidate.key.id}`)
  const client = getClient()
  await client.sendMessage(relayTo, responseContent, getMessageOptions(undefined, false))
  return true
}

/**
 * Hidden command: a reply with just 👀 to a view once message sends the media to the sender's private chat.
 * Returns true if the message was handled (so it must not be processed further).
 */
export const handleEyesReply = async (
  message: WAMessage,
  jid: string,
  group: GroupMetadata | undefined,
  sender: string,
  isBotAdmin: boolean,
  isVip: boolean
) => {
  if (getBody(message).trim() !== EYES) return false

  const quoted = getQuotedFromContext(message)
  if (!quoted || !getViewOnceContent(quoted.message)) return false

  // Allow only bot admins or vips
  if (!isBotAdmin && !isVip) return true

  try {
    const relayed = await relayViewOnce(quoted, sender)
    if (relayed) logAction(message, jid, group, 'View Once Message Relay')
  } catch (error) {
    logger.error(`[VIEW ONCE] An error occurred while relaying the view once message: ${error}`)
  }
  return true
}
