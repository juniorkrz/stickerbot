import { Boom } from '@hapi/boom'
import makeWASocket, {
  areJidsSameUser,
  delay,
  DisconnectReason,
  extractMessageContent,
  isJidGroup,
  makeInMemoryStore,
  useMultiFileAuthState,
  WACallEvent,
  WACallUpdateType
} from '@whiskeysockets/baileys'
import express from 'express'
import moment from 'moment'
import Pino from 'pino'
import { imageSync } from 'qr-image'

import { baileys, bot } from './config'
import { handleSenderParticipation } from './handlers/community'
import { getAllBannedUsers, getVips, isUserBanned, senderIsVip } from './handlers/db'
import { getLogger } from './handlers/logger'
import { handleReactionMessage } from './handlers/reaction'
import { handleLimitedSender } from './handlers/senderUsage'
import {
  makeSticker
} from './handlers/sticker'
import { getTotalCommandsLoaded, handleText } from './handlers/text'
import { WAMessageExtended } from './types/Message'
import { drawHeader } from './utils/art'
import {
  amAdminOfGroup,
  checkBotAdminStatus,
  deleteMessage,
  extractCaptionsFromBodyOrCaption,
  getBody,
  getCaption,
  getDocumentMessageFromContent,
  getFullCachedGroupMetadata,
  getImageMessageFromContent,
  getPhoneFromJid,
  getQuotedMessage,
  getStickerMessageFromContent,
  getVideoMessageFromContent,
  groupFetchAllParticipatingJids,
  isMentioned,
  logAction,
  sendLogToAdmins,
  setupBot,
} from './utils/baileysHelper'
import { colors } from './utils/colors'
import {
  checkForUpdates,
  createDirectoryIfNotExists,
  deleteStoreIfFileIsTooLarge,
  getExtensionFromMimetype,
  getProjectHomepage,
  getProjectLocalVersion
} from './utils/misc'

// get the logger
const logger = getLogger()

// create express webserver
const app = express()
app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

// directories to be created
const directories = {
  creds: `/data/${bot.sessionId}/creds`,
  store: `/data/${bot.sessionId}/store`,
  resources: `/data/${bot.sessionId}/resources`
}

// create directories
Object.values(directories).forEach(async dir => {
  await createDirectoryIfNotExists(dir)
})

// to do something before starting
let inWarmup = true

let client: ReturnType<typeof makeWASocket>
let qr: string | undefined
let pairingCode: string | undefined

// store filepath
const storeFilepath = `${directories.store}/baileys.json`
// delete store file if it's too large
if (baileys.storeAutoDelete) deleteStoreIfFileIsTooLarge(storeFilepath)
// the store maintains the data of the WA connection in memory
const store = makeInMemoryStore({})
// read from a file
store.readFromFile(storeFilepath)
// saves the state to a file every 10s
setInterval(() => {
  store.writeToFile(storeFilepath)
}, 10_000)

// to skip unread messages by environment variable or args
const skipUnreadMessages = baileys.skipUnreadMessages || process.argv.includes('--skip-unread')

// is the bot running in development?
export const dev = process.argv.includes('--dev')

// the moment the bot started
export const startedAt: moment.Moment = moment()

// exportable client
export const getClient = (): ReturnType<typeof makeWASocket> => {
  return client
}

// exportable store
export const getStore = (): ReturnType<typeof makeInMemoryStore> => {
  return store
}

// exportable botStartedAt
export const botStartedAt = (): moment.Moment => {
  return startedAt
}

const connectToWhatsApp = async () => {
  const { state, saveCreds } = await useMultiFileAuthState(directories.creds)

  client = makeWASocket({
    auth: state,
    printQRInTerminal: baileys.useQrCode,
    /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
    logger: Pino({ level: 'silent' }) as any
  })

  if (!baileys.useQrCode && !client.authState.creds.registered && baileys.phoneNumber) {
    await delay(2000)
    pairingCode = await client.requestPairingCode(baileys.phoneNumber.replaceAll(/[^0-9]/g, ''))
    logger.info(`Pairing code: ${pairingCode}`)
  }

  // will listen from this client
  store.bind(client.ev)

  client.ev.on('connection.update', (state) => (qr = state.qr))
  client.ev.on('creds.update', saveCreds)
  client.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'close') {
      logger.warn(`${colors.green}[WA]${colors.yellow} Lost connection`)
      const isLogout =
        (lastDisconnect?.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut
      if (isLogout) {
        logger.info(`${colors.green}[WA]${colors.reset} Reconnecting...`)
        connectToWhatsApp()
      }
    } else if (connection === 'open') {
      logger.info(`${colors.green}[WA]${colors.reset} Opened connection`)
      if (!dev) await setupBot()
      logger.info(`${bot.name} is ${colors.green}ready${colors.reset}!`)
      if (dev) logger.warn('Development mode is active!')
      if (!dev) sendLogToAdmins(`*[STATUS]*: ${bot.name} está online!`)
      if (!dev) checkBotAdminStatus()
    }
  })

  /* client.ev.on('group-participants.update', async (event) => {}) */

  // Refuse calls
  client.ev.on('call', async (call: WACallEvent[]) => {
    if (bot.refuseCalls) {
      const callFrom: string = call[0].chatId
      const callStatus: WACallUpdateType = call[0].status
      if (callStatus === 'offer') {
        logger.info(`Refusing call from ${colors.green}${callFrom}${colors.reset}`)
        await client.rejectCall(call[0].id, call[0].from).catch(error => {
          logger.error(`Error refusing call: ${error}`)
        })
      }
    }
  })

  // Receive and process messages
  client.ev.on('messages.upsert', async (event) => {
    // Skip messages received while offline, if specified
    if (
      inWarmup &&
      skipUnreadMessages &&
      event.type == 'append'
    ) {
      const totalSkippedMessages = event.messages.length
      if (totalSkippedMessages > 0) {
        logger.warn(`Skipped ${totalSkippedMessages} message${totalSkippedMessages > 1 ? 's' : ''} ` +
          'received while offline')
      }
      inWarmup = false
      return
    }

    for (const message of event.messages as WAMessageExtended[]) {
      // This is where the fun begins!

      // Do nothing if self, if no message, no remoteJid, Broadcast, Reaction
      if (
        message.key.fromMe ||
        !message.message ||
        !message.key.remoteJid ||
        message.key.remoteJid === 'status@broadcast'
      )
        continue

      // Get the jid of the chat
      const jid = message.key.remoteJid
      // Get the sender of the message
      const sender = message.key.participant
        ? message.key.participant
        : jid
      // Is this a Group?
      const isGroup = isJidGroup(jid)
      // If so, get the group
      const group = isGroup
        ? await getFullCachedGroupMetadata(jid)
        : undefined
      // Get the sender phone
      const phone = getPhoneFromJid(sender)
      // Is the sender an bot admin?
      const isBotAdmin = bot.admins.includes(phone)
      // Is the sender an admin of the group?
      const isGroupAdmin = group
        ? group.participants
          .find((p) => areJidsSameUser(p.id, sender))
          ?.admin?.endsWith('admin') !== undefined
        : false
      // Is the Bot an admin of the group?
      const amAdmin = amAdminOfGroup(group)
      // Is sender banned?
      const isBanned = phone
        ? await isUserBanned(phone)
        : false
      // Is sender VIP?
      const isVip = await senderIsVip(sender)

      // Message local timestamp
      message.messageLocalTimestamp = Date.now()

      // Skips personal chats unless specified
      if (!isGroup) {
        if (bot.groupsOnly) {
          continue
        }
      } else {
        // Skips non-administered groups unless specified
        if (bot.groupAdminOnly && !amAdmin) {
          continue
        }
      }

      // Delete messages of banned users, except Owner
      if (!isBotAdmin && isBanned) {
        await deleteMessage(message)
        continue
      }

      // Handle reaction message
      if (message.message.reactionMessage) {
        await handleReactionMessage(message, jid, group, sender, isBotAdmin, isVip)
        continue
      }

      // Handle simple text message
      // Body of message is different whether it's individual or group
      const text = getBody(message) || getCaption(message)
      if (text) {
        try {
          const result = await handleText(message, sender, text, group, isBotAdmin, isVip, isGroupAdmin, amAdmin)
          if (result) continue
        } catch (error) {
          if (error) {
            logger.error(`An error occurred while processing the message: ${error}`)
          } else {
            logger.error('An error occurred while processing the message: An unexpected error occurred')
          }
          continue
        }
      }

      // Was the bot mentioned?
      const botMentioned = isGroup ? isMentioned(message, client.user?.id) : false

      if (isGroup) {
        // Is it an official bot group?
        const isBotGroup = bot.groups.includes(jid)
        // If the bot was not mentioned and it's not an official group, skip.
        if (!(botMentioned || isBotGroup)) continue
      }

      // get quoted message
      const quotedMsg = getQuotedMessage(message)

      // get target message
      const targetMessage = botMentioned && quotedMsg
        ? quotedMsg
        : message

      // Extract message content
      const content = extractMessageContent(targetMessage.message)
      if (!content) continue

      // Handle audio message
      /* if (getAudioMessageFromContent(content)) {
                await handleAudio(message)
                continue
            } */

      // Handle Image / GIF / Video message

      if (
        getImageMessageFromContent(content) ||
        getVideoMessageFromContent(content)
      ) {
        // If sender is rate limited, do nothing
        const isSenderRateLimited = await handleLimitedSender(message, jid, group, sender)
        if (isSenderRateLimited) return

        // If the sender is not a member of the community, do nothing (only if SB_FORCE_COMMUNITY is true)
        const isCmmMember = isVip || await handleSenderParticipation(message, jid, group, sender)
        if (!isCmmMember) return

        const isAnimated = content.videoMessage?.seconds ? true : false
        const commandName = isAnimated ? 'Animated Sticker' : 'Static Sticker'
        logAction(message, jid, group, commandName)

        const source = quotedMsg ? getBody(message) : getCaption(message)
        const captions = source ? extractCaptionsFromBodyOrCaption(source) : undefined

        await makeSticker(message, {
          captions,
          quotedMsg: quotedMsg,
          animated: isAnimated
        })
        continue
      }

      // Handle document message

      const documentMessage = getDocumentMessageFromContent(content)
      if (
        documentMessage
      ) {
        // If sender is rate limited, do nothing
        const isSenderRateLimited = await handleLimitedSender(message, jid, group, sender)
        if (isSenderRateLimited) return

        // If the sender is not a member of the community, do nothing (only if SB_FORCE_COMMUNITY is true)
        const isCmmMember = isVip || await handleSenderParticipation(message, jid, group, sender)
        if (!isCmmMember) return

        // get mimetype
        const mimetype = documentMessage.mimetype
        // get the file extension
        const fileExtension = getExtensionFromMimetype(mimetype!)

        if (fileExtension) {
          const commandName = 'Doc as Sticker'
          logAction(message, jid, group, commandName)

          const source = quotedMsg ? getBody(message) : getCaption(message)
          const captions = source ? extractCaptionsFromBodyOrCaption(source) : undefined

          await makeSticker(message, {
            captions,
            quotedMsg: quotedMsg
          })
        }
        continue
      }

      // Handle sticker message
      if (getStickerMessageFromContent(content)) {
        // If sender is rate limited, do nothing
        const isSenderRateLimited = await handleLimitedSender(message, jid, group, sender)
        if (isSenderRateLimited) return

        // If the sender is not a member of the community, do nothing (only if SB_FORCE_COMMUNITY is true)
        const isCmmMember = isVip || await handleSenderParticipation(message, jid, group, sender)
        if (!isCmmMember) return

        const source = quotedMsg ? getBody(message) : getCaption(message)
        const captions = source ? extractCaptionsFromBodyOrCaption(source) : undefined
        if (source && captions && captions.length > 0) {
          // Send sticker with caption
          const isAnimated = content.stickerMessage?.isAnimated || content.videoMessage?.seconds
            ? true
            : false

          logAction(message, jid, group, 'Sticker with Caption')

          await makeSticker(message, {
            captions,
            quotedMsg: quotedMsg,
            animated: isAnimated
          })
        }
        continue
      }
    }
  })
}

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    session: bot.sessionId,
    git: getProjectHomepage(),
    version: getProjectLocalVersion()
  })
})

app.get('/qr', (_req, res) => {
  if (qr) res.end(imageSync(qr))
  else res.end(client.authState.creds.me?.id)
})

app.get('/code', (_req, res) => {
  res.json({
    status: 'ok',
    pairingCode: pairingCode ? pairingCode : false
  })
})

app.get('/api/groups', async (req, res) => {
  res.json({
    status: 'ok',
    data: await groupFetchAllParticipatingJids()
  })
})

app.post('/api/webhook', (req, res) => {
  logger.info(req.body)
  res.json({
    status: 'ok',
    data: req.body
  })
})

const stickerBot = async () => {
  drawHeader()

  await checkForUpdates()

  connectToWhatsApp()

  const totalCommandsLoaded = getTotalCommandsLoaded()
  if (totalCommandsLoaded == 0) {
    logger.warn(`${colors.purpleLight}[COMMANDS]${colors.reset} No commands loaded`)
  } else {
    logger.info(`${colors.purpleLight}[COMMANDS]${colors.reset} ` +
      `${totalCommandsLoaded} command${totalCommandsLoaded > 1 ? 's' : ''} have been loaded!`)
  }

  const totalAdmins = bot.admins.length
  if (totalAdmins == 0) {
    logger.warn(`${colors.yellow}[ADMINS]${colors.reset} No admins were loaded!`)
  } else {
    logger.info(`${colors.yellow}[ADMINS]${colors.reset} ${totalAdmins} admin${totalAdmins > 1 ? 's' : ''} loaded!`)
  }

  if (bot.vipSystem) {
    const vips = await getVips()
    const totalVips = vips.length
    logger.info(`${colors.yellow}[VIPS]${colors.reset} ${colors.green}Enabled${colors.reset} - ${totalVips} VIPs!`)
  } else {
    logger.info(`${colors.yellow}[VIPS]${colors.reset} ${colors.red}Disabled${colors.reset}!`)
  }

  const totalGroups = bot.groups.length
  if (totalGroups == 0) {
    logger.warn(`${colors.blue}[GROUPS]${colors.reset} No groups have been set!`)
  } else {
    logger.info(`${colors.blue}[GROUPS]${colors.reset} ${totalGroups} ` +
      `group${totalGroups > 1 ? 's' : ''} have been set!`)
  }

  const banneds = await getAllBannedUsers()
  const totalBanned = banneds.length
  if (totalBanned == 0) {
    logger.warn(`${colors.red}[BANS]${colors.reset} No users banned!`)
  } else {
    logger.info(`${colors.red}[BANS]${colors.reset} ${totalBanned} user${totalBanned > 1 ? 's' : ''} banned!`)
  }

  if (bot.refuseCalls) {
    logger.info(`${colors.green}[CALLS]${colors.reset} Refuse calls is ${colors.green}active${colors.reset}, ` +
      'the bot will reject all calls automatically!')
  } else {
    logger.info(`${colors.green}[CALLS]${colors.reset} Refuse calls ${colors.red}disabled${colors.reset}, ` +
      'the bot does not reject calls.')
  }

  const port = 3000
  app.listen(port, () => logger.info(`${colors.blue}[WS]${colors.reset} ` +
    `Started on port ${colors.green}${port}${colors.reset}`))
}

stickerBot()
