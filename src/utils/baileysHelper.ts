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

import { getClient, getStore } from '../bot'
import { bot, stickerMeta } from '../config'
import { getCache } from '../handlers/cache'
import { addCount } from '../handlers/db'
import { addTextOnImage } from '../handlers/image'
import { getLogger } from '../handlers/logger'
import { colors } from './colors'
import { emojis } from './emojis'
import { getProjectLocalVersion, getRandomItemFromArray } from './misc'

const logger = getLogger()

export const getCachedGroupFetchAllParticipating = async (): Promise<{
  [_: string]: GroupMetadata
}> => {
  const cache = getCache()
  const data = cache.get('AllParticipating')
  if (data) {
    return data as {
      [_: string]: GroupMetadata
    }
  }

  const client = getClient()
  const groups = await client.groupFetchAllParticipating()
  cache.set('AllParticipating', groups, 30)
  return groups
}

export const groupFetchAllParticipatingJids = async (): Promise<{
  [_: string]: string;
}> => {
  const result: { [_: string]: string; } = {}
  const groups = await getCachedGroupFetchAllParticipating()
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

export const getMessageExpiration = (message: WAMessage | undefined) => {
  if (!message) return
  return getMessage(message)?.contextInfo?.expiration
}

export const getMessageOptions = (message: WAMessage | undefined, quote: boolean): MiscMessageGenerationOptions => {
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
  url: string | undefined = undefined,
  quotedMsg: WAMessage
) => {
  if (isAnimated) {
    await react(message, getRandomItemFromArray(emojis.wait))
  }

  let data = url ? url
    : <Buffer>await downloadMediaMessage(quotedMsg, 'buffer', {})

  if (!url) {
    const mimeType = getMediaMessage(quotedMsg)?.mimetype
    if (phrases && !isAnimated) {
      data = await addTextOnImage(data as Buffer, mimeType!, phrases)
      if (!data) {
        logger.warn('API: textOnImage is down!')
        await sendLogToAdmins('*[API]:* textOnImage is down!')
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
    await react(message, getRandomItemFromArray(emojis.success))
  }

  return result
}

export const unmakeSticker = async (message: WAMessage) => {
  // Send sticker as image
  try {
    const image = (await downloadMediaMessage(
      message,
      'buffer',
      {}
    )) as Buffer

    await sendMessage(
      { image },
      message
    )
  } catch (error) {
    // TODO: Error: EBUSY: resource busy or locked (on Windows)
    logger.error(`An error occurred when converting the sticker to image: ${error}`)
  }
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

export const logAction = (
  message: WAMessage,
  jid: string,
  group: GroupMetadata | undefined,
  action: string,
  addToStatistics: boolean = true
) => {
  const requester = message.pushName || `${colors.red}Desconhecido${colors.reset}`
  const groupName = group ? group.subject : `${colors.red}Desconhecido${colors.reset}`

  const identifier = group
    ? `${groupName} (${colors.green}${jidDecode(jid)?.user}${colors.reset}) for ${requester}`
    : `${requester} (${colors.green}${jidDecode(jid)?.user}${colors.reset})`

  logger.info(`Sending ${colors.blue}${action}${colors.reset} @ ${identifier}`)

  if (addToStatistics) addCount(action)
}

export const extractPhrasesFromBodyOrCaption = (source: string) => {
  const client = getClient()
  const botMention = '@' + getPhoneFromJid(client.user?.id)
  const phrases = source.replaceAll(botMention, '')// Removes the bot mention
    .replaceAll('\n', '')
    .split(';')// Line splitter. ex: `Top text;Bottom text`
    .map(phrase => phrase.trim())
    .filter(phrase => phrase.length > 0)// Removes empty strings
    .slice(0, 2)
  return phrases
}

export const getPhoneFromJid = (jid: string | undefined) => {
  return jidNormalizedUser(jid).replace(/\D/g, '')
}

export const getMentionedJids = (message: WAMessage) => {
  return getMessage(message)?.contextInfo?.mentionedJid
}

export const isMentioned = (message: WAMessage, jid: string | undefined) => {
  if (!jid) return false
  const mentionedJids = getMentionedJids(message)
  return mentionedJids?.includes(jidNormalizedUser(jid))
}

export const getQuotedMessage = (message: WAMessage) => {
  const store = getStore()
  const quotedMsgId = message.message?.extendedTextMessage?.contextInfo?.stanzaId ||
  message.message?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo?.stanzaId
  const chatMessages = store.messages[message.key.remoteJid!]
  return chatMessages?.get(quotedMsgId!)
}

export const deleteMessage = async (message: WAMessage) => {
  await sendMessage(
    { delete: message.key },
    message,
    false
  )
}

export const getAllGroupsFromCommunity = async (communityId: string) => {
  const allGroups = await getCachedGroupFetchAllParticipating()
  return Object.values(allGroups)
    .filter(group => group.linkedParent == communityId)
}

export const sendLogToAdmins = async (text: string, mentions: string[] | undefined = undefined) => {
  if (!bot.logsGroup) return

  const client = getClient()
  return await client.sendMessage(
    bot.logsGroup,
    {
      text: text,
      mentions: mentions
    },
    getMessageOptions(undefined, false)
  )
}

export const setupBot = async () => {
  if (!bot.setup) {
    return
  }

  logger.info(`${colors.green}[WA]${colors.reset} Setting up...`)
  const client = getClient()

  const status = await client.fetchStatus(jidNormalizedUser(client?.user?.id))
  const botStatus = `${bot.status} | v${getProjectLocalVersion()}`
  if (status?.status != botStatus) {
    logger.info(`${colors.green}[WA]${colors.reset} Setting profile status`)
    await client.updateProfileStatus(botStatus)
  }

  const privacySettings = await client.fetchPrivacySettings(true)

  // Profile Name
  if (client.user?.name != bot.name) {
    logger.info(`${colors.green}[WA]${colors.reset} Setting profile name`)
    await client.updateProfileName(bot.name)
  }

  // Last seen Privacy
  if (privacySettings.last != bot.lastSeenPrivacy) {
    logger.info(`${colors.green}[WA]${colors.reset} Setting last seen privacy`)
    await client.updateLastSeenPrivacy(bot.lastSeenPrivacy)
  }

  // Online Privacy
  if (privacySettings.online != bot.onlinePrivacy) {
    logger.info(`${colors.green}[WA]${colors.reset} Setting online privacy`)
    await client.updateOnlinePrivacy(bot.onlinePrivacy)
  }

  // Profile Pic Privacy
  if (privacySettings.profile != bot.profilePicPrivacy) {
    logger.info(`${colors.green}[WA]${colors.reset} Setting profile pic privacy`)
    await client.updateProfilePicturePrivacy(bot.profilePicPrivacy)
  }

  // Status Privacy
  if (privacySettings.status != bot.statusPrivacyValue) {
    logger.info(`${colors.green}[WA]${colors.reset} Setting status privacy value`)
    await client.updateStatusPrivacy(bot.statusPrivacyValue)
  }

  // Read Receipts Privacy
  if (privacySettings.readreceipts != bot.readReceiptsPrivacy) {
    logger.info(`${colors.green}[WA]${colors.reset} Setting read receipts privacy`)
    await client.updateReadReceiptsPrivacy(bot.readReceiptsPrivacy)
  }

  // Groups Add Privacy
  if (privacySettings.groupadd != bot.groupsAddPrivacy) {
    logger.info(`${colors.green}[WA]${colors.reset} Setting groups add privacy`)
    await client.updateGroupsAddPrivacy(bot.groupsAddPrivacy)
  }

  // Default Disappearing Mode
  if (WA_DEFAULT_EPHEMERAL != bot.defaultDisappearingMode) {
    logger.info(`${colors.green}[WA]${colors.reset} Setting default disappearing mode`)
    await client.updateDefaultDisappearingMode(bot.defaultDisappearingMode)
  }
}

export const checkBotAdminStatus = async () => {
  if (!bot.community) return true
  logger.info('[MOD] Checking admin status in the community...')

  const groups = await getAllGroupsFromCommunity(bot.community)
  const community = await getFullCachedGroupMetadata(bot.community)

  if (community) groups.push(community)

  let logs = ''
  for (const group of groups) {
    const amAdmin = amAdminOfGroup(group)
    if (!amAdmin) {
      const log = `*[MOD]* ${bot.name} is not a admin of ${group.subject} (${group.id})`
      logger.warn(log.replaceAll('*', ''))
      logs += `${log}\n`
    }
  }

  if (logs) {
    logger.info('[MOD] Sending logs')
    sendLogToAdmins(logs.slice(0, -1))
  }

  logger.info('[MOD] Check complete!')
}
