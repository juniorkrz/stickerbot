import { Boom } from '@hapi/boom'
import makeWASocket, {
  areJidsSameUser,
  delay,
  DisconnectReason,
  downloadMediaMessage,
  isJidGroup,
  makeInMemoryStore,
  useMultiFileAuthState
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
  extractPhrasesFromCaption,
  getBody,
  getCaption,
  getFullCachedGroupMetadata,
  getVideoMessage,
  groupFetchAllParticipatingJids,
  logCommandExecution,
  makeSticker,
  sendMessage
} from './utils/baileysHelper'
import {
  checkForUpdates,
  createDirectoryIfNotExists,
  getLocalVersion
} from './utils/misc'

const logger = getLogger()

// the moment the bot started
export const startedAt: moment.Moment = moment()

// create express webserver
const app = express()
app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

const directories = {
  creds: `/data/${bot.sessionId}/creds`,
  store: `/data/${bot.sessionId}/store`
}

Object.values(directories).forEach(dir => {
  createDirectoryIfNotExists(dir)
})

let client: ReturnType<typeof makeWASocket>
let store: ReturnType<typeof makeInMemoryStore>
let qr: string | undefined
let pairingCode: string | undefined

export const getClient = (): ReturnType<typeof makeWASocket> => {
  return client
}

export const getStore = (): ReturnType<typeof makeInMemoryStore> => {
  return store
}

const connectToWhatsApp = async () => {
  /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
  store = makeInMemoryStore({ logger: Pino({ level: 'silent' }) as any })
  store.readFromFile(`${directories.creds}/baileys.json`)

  setInterval(async () => {
    store.writeToFile(`${directories.store}/baileys.json`)
  }, 10_000)

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

  store?.bind(client.ev)

  client.ev.on('connection.update', (state) => (qr = state.qr))
  client.ev.on('creds.update', saveCreds)
  client.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'close') {
      const isLogout =
        (lastDisconnect?.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut
      if (isLogout) {
        connectToWhatsApp()
      }
    } else if (connection === 'open') {
      logger.info('Opened WhatsApp connection')
      //setupBot()
    }
  })

  // Receive and process messages
  client.ev.on('messages.upsert', async (event) => {
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
          handleText(message, body, group, isBotAdmin, isGroupAdmin, amAdmin)
            .catch((error: Error) => {
              logger.error(`An error occurred while processing the message: ${error.message}`)
            })
          continue
        }
      }

      // Handle audio message
      /* if (message.message.audioMessage) {
                await handleAudio(message)
                continue
            } */

      // Handle Image / GIF / Video message
      if (
        message.message.imageMessage ||
        message.message.videoMessage ||
        message.message.ephemeralMessage?.message?.imageMessage ||
        message.message.ephemeralMessage?.message?.videoMessage ||
        message.message.viewOnceMessage?.message?.imageMessage ||
        message.message.viewOnceMessage?.message?.videoMessage ||
        message.message.viewOnceMessageV2?.message?.imageMessage ||
        message.message.viewOnceMessageV2?.message?.videoMessage
      ) {
        const isAnimated = getVideoMessage(message) ? true : false
        const commandName = isAnimated ? 'Animated Sticker' : 'Static Sticker'
        logCommandExecution(message, message.key.remoteJid, group, commandName)
        const caption = getCaption(message)
        if (caption) {
          const phrases = extractPhrasesFromCaption(caption)
          await makeSticker(message, isAnimated, phrases)
        } else {
          await makeSticker(message, isAnimated)
        }
      }

      // Handle sticker message
      if (message.message.stickerMessage) {
        // send sticker as image
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

  const port = 3000
  app.listen(port, () => logger.info(`Web Server Started on port ${port}`))
}

stickerBot()
