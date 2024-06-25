import {
  AnyMessageContent,
  areJidsSameUser,
  downloadMediaMessage,
  GroupMetadata,
  GroupMetadataParticipants,
  isJidGroup,
  jidDecode,
  jidNormalizedUser,
  MiscMessageGenerationOptions,
  WA_DEFAULT_EPHEMERAL,
  WAMessage
} from '@whiskeysockets/baileys'
import { Sticker } from 'wa-sticker-formatter'

import { getClient } from '../bot'
import { stickerMeta } from '../config'
import { getCache } from '../handlers/cache'
import { addTextOnImage } from '../handlers/image'
import { getLogger } from '../handlers/logger'
import { spintax } from './misc'

const logger = getLogger()

export const groupFetchAllParticipatingJids = async (): Promise<{
  [_: string]: string;
}> => {
  const client = getClient()
  const result: { [_: string]: string; } = {}
  const groups = await client.groupFetchAllParticipating()
  for (const group in groups) {
    result[group] = groups[group].subject
  }
  return result
}

export const getCachedGroupMetadata = async (
  jid: string,
): Promise<GroupMetadataParticipants | undefined> => {
  if (!isJidGroup(jid)) {
    return undefined
  }

  const client = getClient()

  let metadata: GroupMetadata
  const cache = getCache()
  const data = cache.get(jid)

  if (data) {
    metadata = data as GroupMetadata
    return {
      participants: metadata.participants,
    } as GroupMetadataParticipants
  }

  try {
    metadata = await client.groupMetadata(jid)
  } catch {
    return undefined
  }

  cache.set(jid, metadata, 30)

  return {
    participants: metadata?.participants,
  } as GroupMetadataParticipants
}

export const getFullCachedGroupMetadata = async (
  jid: string,
): Promise<GroupMetadata | undefined> => {
  if (!isJidGroup(jid)) {
    return undefined
  }

  const client = getClient()

  let metadata: GroupMetadata
  const cache = getCache()
  const data = cache.get(jid)

  if (data) {
    metadata = data as GroupMetadata
    return metadata
  }

  try {
    metadata = await client.groupMetadata(jid)
  } catch {
    return undefined
  }

  cache.set(jid, metadata, 30)

  return metadata
}

export const amAdminOfGroup = (group: GroupMetadata | undefined) => {
  const client = getClient()
  return group ? group.participants
    .find((p) => areJidsSameUser(p.id, client.user?.id))
    ?.admin?.endsWith('admin') !== undefined
    : false
}

export const getBody = (message: WAMessage) => {
  return (
    message.message?.extendedTextMessage?.text ||
    message.message?.conversation ||
    message.message?.ephemeralMessage?.message?.extendedTextMessage?.text ||
    message.message?.ephemeralMessage?.message?.conversation ||
    ''
  )
}

export const getCaption = (message: WAMessage) => {
  return getMediaMessage(message)?.caption
}

export const getMessage = (message: WAMessage) => {
  return (
    message?.message?.extendedTextMessage ||// text
    message?.message?.ephemeralMessage?.message?.extendedTextMessage ||// ephemeral text
    message?.message?.imageMessage ||// image
    message?.message?.videoMessage ||// video
    message?.message?.ephemeralMessage?.message?.imageMessage ||// ephemeral image
    message?.message?.ephemeralMessage?.message?.videoMessage ||// ephemeral video
    message?.message?.viewOnceMessage?.message?.imageMessage ||// viewonce image
    message?.message?.viewOnceMessage?.message?.videoMessage ||// viewonce video
    message?.message?.viewOnceMessageV2?.message?.imageMessage ||// viewonce v2 image
    message?.message?.viewOnceMessageV2?.message?.videoMessage)// viewonce v2 video
}


export const getMediaMessage = (message: WAMessage) => {
  return (
    message?.message?.imageMessage ||// image
    message?.message?.videoMessage ||// video
    message?.message?.ephemeralMessage?.message?.imageMessage ||// ephemeral image
    message?.message?.ephemeralMessage?.message?.videoMessage ||// ephemeral video
    message?.message?.viewOnceMessage?.message?.imageMessage ||// viewonce image
    message?.message?.viewOnceMessage?.message?.videoMessage ||// viewonce video
    message?.message?.viewOnceMessageV2?.message?.imageMessage ||// viewonce v2 image
    message?.message?.viewOnceMessageV2?.message?.videoMessage)// viewonce v2 video
}

export const getImageMessage = (message: WAMessage) => {
  return (
    message.message?.imageMessage ||
    message.message?.ephemeralMessage?.message?.imageMessage ||
    message.message?.viewOnceMessage?.message?.imageMessage ||
    message.message?.viewOnceMessageV2?.message?.imageMessage
  )
}

export const getVideoMessage = (message: WAMessage) => {
  return (
    message.message?.videoMessage ||
    message.message?.ephemeralMessage?.message?.videoMessage ||
    message.message?.viewOnceMessage?.message?.videoMessage ||
    message.message?.viewOnceMessageV2?.message?.videoMessage
  )
}

export const getMessageExpiration = (message: WAMessage) => {
  return getMessage(message)?.contextInfo?.expiration
}

export const getMessageOptions = (message: WAMessage, quote: boolean): MiscMessageGenerationOptions => {
  return {
    cachedGroupMetadata: getCachedGroupMetadata,
    quoted: quote ? message : undefined,
    ephemeralExpiration: getMessageExpiration(message) || WA_DEFAULT_EPHEMERAL
  }
}

export const sendMessage = async (
  content: AnyMessageContent,
  message: WAMessage,
  quote: boolean = true
) => {
  if (!message.key.remoteJid) return
  const client = getClient()
  return await client.sendMessage(
    message.key.remoteJid,
    content,
    getMessageOptions(message, quote)
  )
}

export const react = async (message: WAMessage, emoji: string) => {
  return await sendMessage(
    {
      react: {
        text: emoji,
        key: message.key
      }
    },
    message,
    false
  )
}

export const makeSticker = async (
  message: WAMessage,
  isAnimated: boolean,
  phrases: string[] | undefined = undefined,
  url: string | undefined = undefined
) => {
  if (isAnimated) {
    await react(message, spintax('{⏱|⏳|🕓|⏰}'))
  }

  let data = url ? url
    : <Buffer>await downloadMediaMessage(message, 'buffer', {})

  if (!url) {
    const mimeType = getMediaMessage(message)?.mimetype
    if (phrases) {
      data = await addTextOnImage(data as Buffer, mimeType!, phrases)
      if (!data) {
        logger.warn('API: textOnImage is down!')
        // TODO: Load texts from JSON
        const reply = '⚠ Desculpe, o serviço de "Textos em Sticker" está indisponível no momento. ' +
          'Por favor, tente novamente mais tarde.'
        await sendMessage(
          { text: reply },
          message
        )
        return
      }
    }
  }

  const sticker = new Sticker(data, stickerMeta)
  const result = await sendMessage(await sticker.toMessage(), message, true)

  if (isAnimated) {
    await react(message, spintax('{🤖|✅}'))
  }

  return result
}

export async function sendAudio(message: WAMessage, path: string) {
  // TODO: [BUG] Error playing audio on iOS/WA (Windows) devices #768
  // https://github.com/WhiskeySockets/Baileys/issues/768
  return await sendMessage(
    {
      audio: { url: path },
      ptt: true,
      mimetype: 'audio/mpeg'
    },
    message
  )
}

export const logCommandExecution = (
  message: WAMessage,
  jid: string,
  group: GroupMetadata | undefined,
  commandName: string
) => {
  const requester = message.pushName || 'Desconhecido'
  const groupName = group ? group.subject : 'Desconhecido'
  const identifier = group ? `${groupName} (${jidDecode(jid)?.user}) for ${requester}`
    : `${requester} (${jidDecode(jid)?.user})`
  logger.info(`Sending ${commandName} @ ${identifier}`)
}

export const extractPhrasesFromCaption = (caption: string) => {
  const client = getClient()
  const botMention = '@' + getPhoneFromJid(client.user?.id)
  const phrases = caption.replaceAll(botMention, '')// Removes the bot mention
    .split(';')
    .filter(
      phrase => phrase.trim()
    )
    .slice(0, 2)
  return phrases
}

export const getPhoneFromJid = (jid: string | undefined) => {
  return jidNormalizedUser(jid).split('@')[0]
}

export const getMentionedJids = (message: WAMessage) => {
  return getMessage(message)?.contextInfo?.mentionedJid
}

export const isMentioned = (message: WAMessage, jid: string | undefined) => {
  if (!jid) return false
  const mentionedJids = getMentionedJids(message)
  return mentionedJids?.includes(jidNormalizedUser(jid))
}
