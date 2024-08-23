import {
  AnyMessageContent,
  areJidsSameUser,
  downloadMediaMessage,
  extractMessageContent,
  GroupMetadata,
  GroupMetadataParticipants,
  isJidGroup,
  jidDecode,
  jidEncode,
  jidNormalizedUser,
  MiscMessageGenerationOptions,
  WA_DEFAULT_EPHEMERAL,
  WAMessage,
  WAMessageContent
} from '@whiskeysockets/baileys'
import path from 'path'

import { getClient, getStore } from '../bot'
import { bot } from '../config'
import { getCache } from '../handlers/cache'
import { addCount } from '../handlers/db'
import { getLogger } from '../handlers/logger'
import { colors } from './colors'
import { getProjectLocalVersion, getRandomFile } from './misc'

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
  const media = getMediaMessage(message)
  if (media && 'caption' in media) return media.caption
}

export const getMessage = (message: WAMessage) => {
  const content = extractMessageContent(message.message)
  return (
    content?.extendedTextMessage ||
    content?.imageMessage ||
    content?.videoMessage ||
    content?.stickerMessage ||
    content?.documentMessage
  )
}

export const getMediaMessage = (message: WAMessage) => {
  const content = extractMessageContent(message.message)
  return (
    content?.imageMessage ||
    content?.videoMessage ||
    content?.stickerMessage
  )
}

export const getImageMessageFromContent = (content: WAMessageContent) => {
  return content?.imageMessage
}

export const getVideoMessageFromContent = (content: WAMessageContent) => {
  return content?.videoMessage
}

export const getDocumentMessageFromContent = (content: WAMessageContent) => {
  return (
    content?.documentMessage
  )
}

export const getStickerMessageFromContent = (content: WAMessageContent) => {
  return content?.stickerMessage
}

export const getAudioMessageFromContent = (content: WAMessageContent) => {
  return content?.audioMessage
}

export const getMessageExpiration = (message: WAMessage | undefined) => {
  if (!message) return
  return getMessage(message)?.contextInfo?.expiration
}

export const getMessageOptions = (message: WAMessage | undefined, quote: boolean): MiscMessageGenerationOptions => {
  return {
    // TODO: Fix this
    //cachedGroupMetadata: getCachedGroupMetadata,
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

export const sendAudio = async (message: WAMessage, path: string) => {
  return await sendMessage(
    {
      audio: { url: path },
      //ptt: true, // false prevents automatic audio download
      mimetype: 'audio/aac'
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

export const extractCaptionsFromBodyOrCaption = (source: string) => {
  const client = getClient()
  const botMention = '@' + getPhoneFromJid(client.user?.id)
  const caption = source.replaceAll(botMention, '')// Removes the bot mention
    .replaceAll('\n', '')
    .split(';')// Line splitter. ex: `Top text;Bottom text`
    .map(phrase => phrase.trim())
    .filter(phrase => phrase.length > 0)// Removes empty strings
    .slice(0, 2)
  return caption
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

  // Profile Pic
  if (bot.setProfilePic) {
    logger.info(`${colors.green}[WA]${colors.reset} Setting profile pic`)
    const imgDir = path.resolve(__dirname, '../../src/img/profilePic')
    const randomImage = getRandomFile(imgDir)
    const botJid = client.user?.id
    if (botJid) await client.updateProfilePicture(botJid, { url: randomImage })
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
      const log = `*[MOD]* ${bot.name} não é um admin do ${group.subject} (${group.id})`
      logger.warn(log.replaceAll('*', ''))
      logs += `${log}\n`
    }
  }

  if (logs) {
    logger.info('[MOD] Sending logs')
    await sendLogToAdmins(logs.slice(0, -1))
  }

  logger.info('[MOD] Check complete!')
}

export const getMessageAuthor = (message: WAMessage) => {
  return message.key.fromMe
    ? message.participant!
    : message.key.participant!
}

export const getQuotedMessageAuthor = (message: WAMessage) => {
  const quotedMsg = getQuotedMessage(message)
  if (quotedMsg) return getMessageAuthor(quotedMsg)
}

export const isSenderBotMaster = (jid: string) => {
  const botMaster = bot.admins[0]
  return areJidsSameUser(jid, jidEncode(botMaster, 's.whatsapp.net'))
}

export const getBodyWithoutCommand = (body: string, needsPrefix: boolean, alias: string) => {
  return body.slice(needsPrefix ? 1 : 0)
    .replace(new RegExp(alias, 'i'), '')
    .trim()
}

export const viewOnceMessageRelay = async (
  viewOnceMessage: WAMessage,
  content: WAMessageContent,
  relayTo: string
) => {
  const client = getClient()
  // Check for media type
  const mediaType = getImageMessageFromContent(content)
    ? 'image'
    : getVideoMessageFromContent(content)
      ? 'video'
      : getAudioMessageFromContent(content)
        ? 'audio'
        : undefined

  // download media
  const buffer = <Buffer>await downloadMediaMessage(viewOnceMessage, 'buffer', {})

  // generate message content
  let responseContent
  if (mediaType == 'image') {
    responseContent = { image: buffer }
  } else if (mediaType == 'video') {
    responseContent = { video: buffer }
  } else if (mediaType == 'audio') {
    responseContent = {
      audio: buffer,
      ptt: true
    }
  }

  if (buffer && responseContent) {
    // send message
    return await client.sendMessage(
      relayTo,
      responseContent as AnyMessageContent,
      getMessageOptions(undefined, false)
    )
  }
}
