import { Boom } from '@hapi/boom'
import makeWASocket, {
  areJidsSameUser,
  delay,
  DisconnectReason,
  downloadMediaMessage,
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
import { getLogger } from './handlers/logger'
import { handleText, printTotalLoadedCommands } from './handlers/text'
import { WAMessageExtended } from './types/Message'
import { drawArt } from './utils/art'
import {
  amAdminOfGroup,
  extractPhrasesFromBodyOrCaption,
  getBody,
  getCaption,
  getFullCachedGroupMetadata,
  getQuotedMessage,
  getVideoMessage,
  groupFetchAllParticipatingJids,
  isMentioned,
  logCommandExecution,
  makeSticker,
  sendMessage
} from './utils/baileysHelper'
import { colors } from './utils/colors'
import {
  checkForUpdates,
  createDirectoryIfNotExists,
  getLocalVersion
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
  store: `/data/${bot.sessionId}/store`
}

// create directories
Object.values(directories).forEach(dir => {
  createDirectoryIfNotExists(dir)
})

// to do something before starting
let inWarmup = true

let client: ReturnType<typeof makeWASocket>
let qr: string | undefined
let pairingCode: string | undefined

// the store maintains the data of the WA connection in memory
const store = makeInMemoryStore({ })
// read from a file
store.readFromFile(`${directories.creds}/baileys.json`)
// saves the state to a file every 10s
setInterval(() => {
  store.writeToFile(`${directories.creds}/baileys.json`)
}, 10_000)

// to skip unread messages by environment variable or args
const skipUnreadMessages = baileys.skipUnreadMessages || process.argv.includes('--skip-unread')

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
  client.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'close') {
      logger.warn(`Lost ${colors.green}WhatsApp${colors.reset} connection`)
      const isLogout =
      (lastDisconnect?.error as Boom)?.output?.statusCode !==
      DisconnectReason.loggedOut
      if (isLogout) {
        logger.info(`Reconnecting to ${colors.green}WhatsApp${colors.reset}...`)
        connectToWhatsApp()
      }
    } else if (connection === 'open') {
      logger.info(`Opened ${colors.green}WhatsApp${colors.reset} connection`)
      //setupBot()
    }
  })

  /* client.ev.on('group-participants.update', async (event) => {
  }) */

  // Refuse calls
  client.ev.on('call', async (call: WACallEvent[]) => {
    if (bot.refuseCalls) {
      const callFrom: string = call[0].chatId
      const callStatus: WACallUpdateType = call[0].status
      if (callStatus === 'offer') {
        logger.info(`Refusing call from ${callFrom}`)
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
        message.key.remoteJid === 'status@broadcast' ||
        message.message.reactionMessage
      )
        continue

      // Get the sender of the message
      const sender = message.key.participant
        ? message.key.participant
        : message.key.remoteJid
      // Is the sender the Bot owner?
      const isBotAdmin = bot.admins.includes(sender.split('@')[0])
      // Is this a Group?
      const isGroup = isJidGroup(message.key.remoteJid)
      // If so, get the group
      const group = isGroup
        ? await getFullCachedGroupMetadata(message.key.remoteJid)
        : undefined
      // Is the sender an admin of the group?
      const isGroupAdmin = group
        ? group.participants
          .find((p) => areJidsSameUser(p.id, sender))
          ?.admin?.endsWith('admin') !== undefined
        : false
      // Is the Bot an admin of the group?
      const amAdmin = amAdminOfGroup(group)

      // Message local timestamp
      message.messageLocalTimestamp = Date.now()

      // Handle simple text message
      if (
        message.message.extendedTextMessage ||
        message.message.conversation ||
        message.message.ephemeralMessage
      ) {
        // Body of message is different whether it's individual or group
        const body = getBody(message)

        if (body) {
          try {
            const result = await handleText(message, body, group, isBotAdmin, isGroupAdmin, amAdmin)
            if (result) continue
          } catch (error: unknown) {
            if (error instanceof Error) {
              logger.error(`An error occurred while processing the message: ${error.message}`)
            } else {
              logger.error('An error occurred while processing the message: An unexpected error occurred')
            }
            continue
          }
        }
      }

      // Is it a group?
      if (isGroup) {
        // Was the bot mentioned?
        const botMentioned = isMentioned(message, client.user?.id)
        // Is it an official bot group?
        const isBotGroup = bot.groups.includes(message.key.remoteJid)
        // If the bot was not mentioned and it's not an official group, skip.
        if (!(botMentioned || isBotGroup))
          continue
      }

      // Handle audio message
      /* if (message.message.audioMessage) {
                await handleAudio(message)
                continue
            } */

      // Handle Image / GIF / Video message

      const quotedMsg = getQuotedMessage(message)

      const msg = quotedMsg ? quotedMsg : message

      if (!msg) continue

      if (
        msg.message?.imageMessage ||
        msg.message?.videoMessage ||
        msg.message?.ephemeralMessage?.message?.imageMessage ||
        msg.message?.ephemeralMessage?.message?.videoMessage ||
        msg.message?.viewOnceMessage?.message?.imageMessage ||
        msg.message?.viewOnceMessage?.message?.videoMessage ||
        msg.message?.viewOnceMessageV2?.message?.imageMessage ||
        msg.message?.viewOnceMessageV2?.message?.videoMessage
      ) {
        const isAnimated = getVideoMessage(msg) ? true : false
        const commandName = isAnimated ? 'Animated Sticker' : 'Static Sticker'
        logCommandExecution(msg, message.key.remoteJid, group, commandName)
        const source = quotedMsg ? getBody(message) : getCaption(message)
        if (source) {
          const phrases = extractPhrasesFromBodyOrCaption(source)
          await makeSticker(message, isAnimated, phrases, undefined, msg)// TODO: This isn't cool, let's fix it later
        } else {
          await makeSticker(message, isAnimated, undefined, undefined, msg)// TODO: This isn't cool, let's fix it later
        }
      }

      // Handle sticker message
      if (message.message.stickerMessage) {
        // Send sticker as image
        try {
          logCommandExecution(message, message.key.remoteJid, group, 'Sticker as Image')
          const image = (await downloadMediaMessage(
            message,
            'buffer',
            {}
          )) as Buffer

          await sendMessage(
            { image },
            message
          )
          continue
        } catch (error) {
          // TODO: Error: EBUSY: resource busy or locked (on Windows)
          logger.error(`An error occurred when converting the sticker to image: ${error}`)
        }
      }
    }
  })
}

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    session: bot.sessionId,
    version: getLocalVersion()
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
  drawArt()
  await checkForUpdates()
  printTotalLoadedCommands()
  await connectToWhatsApp()

  const totalAdmins = bot.admins.length
  if (totalAdmins == 0) {
    logger.warn('No admins were loaded!')
  } else {
    logger.info(`${totalAdmins} admin${totalAdmins > 1 ? 's' : ''} loaded!`)
  }

  const totalGroups = bot.groups.length
  if (totalGroups == 0) {
    logger.warn('No groups have been set!')
  } else {
    logger.info(`${totalGroups} group${totalGroups > 1 ? 's' : ''} have been set!`)
  }

  if (bot.refuseCalls) {
    logger.info(`Refuse calls is ${colors.green}active${colors.reset}, the bot will reject all calls automatically!`)
  } else {
    logger.info(`Refuse calls ${colors.red}disabled${colors.reset}, the bot does not reject calls.`)
  }

  const port = 3000
  app.listen(port, () => logger.info(`Web Server Started on port ${port}`))
}

stickerBot()
