import { Boom } from '@hapi/boom'
import P from 'pino'
import express from 'express'
import makeWASocket, { DisconnectReason, WA_DEFAULT_EPHEMERAL, areJidsSameUser, delay, downloadMediaMessage, isJidGroup, makeInMemoryStore, useMultiFileAuthState } from '@whiskeysockets/baileys'
import { baileys, bot } from './config'
import { createDirectoryIfNotExists, getLocalVersion } from './utils/misc'
import moment from 'moment'
import { imageSync } from 'qr-image'
import { amAdminOfGroup, getBody, getFullCachedGroupMetadata, groupFetchAllParticipating } from './utils/baileysHelper'
import { WAMessageExtended } from './types/Message'
import { handleText } from './handlers/text'

// the moment the bot started
export const startedAt: moment.Moment = moment()

// create express webserver
const app = express()
app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

const directories = {
    base: `/data/${bot.sessionId}`,
    creds: `/data/${bot.sessionId}/creds`,
    store: `/data/${bot.sessionId}/store`
}

Object.values(directories).forEach(dir => {
    createDirectoryIfNotExists(dir)
})

let client: ReturnType<typeof makeWASocket>
let store: ReturnType<typeof makeInMemoryStore>
let qr: string | undefined

export const getClient = (): ReturnType<typeof makeWASocket> => {
    return client
}

export const getStore = (): ReturnType<typeof makeInMemoryStore> => {
    return store
}

const connectToWhatsApp = async () => {
    store = makeInMemoryStore({ logger: P({ level: 'silent' }) })
    store.readFromFile(`${directories.creds}/baileys.json`)

    setInterval(async () => {
        store.writeToFile(`${directories.store}/baileys.json`)
    }, 10_000)

    const { state, saveCreds } = await useMultiFileAuthState(directories.creds)

    client = makeWASocket({
        auth: state,
        printQRInTerminal: baileys.useQrCode,
        logger: P({ level: 'silent' })
    })

    if (!baileys.useQrCode && !client.authState.creds.registered && baileys.phoneNumber) {
        await delay(2000)
        const code = await client.requestPairingCode(baileys.phoneNumber.replaceAll(/[^0-9]/g, ''))
        console.log(`Pairing code: ${code}`)
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
            console.log('Opened connection')
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
            const isOwner = bot.admins.includes(sender.split('@')[0])
            // Is this a Group?
            const isGroup = isJidGroup(message.key.remoteJid)
            // If so, get the group
            const group = isGroup
                ? await getFullCachedGroupMetadata(message.key.remoteJid)
                : undefined
            // Is the sender an admin of the group?
            const isAdmin = group
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
                    handleText(message, body, group, isOwner, isAdmin, amAdmin)
                        .catch((error: Error) => {
                            console.error('An error occurred while processing the message:', error.message)
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
                //await makeSticker(message)
                continue
            }

            // Handle sticker message
            if (message.message.stickerMessage) {
                const sticker = (await downloadMediaMessage(
                    message,
                    'buffer',
                    {}
                )) as Buffer
                await client.sendMessage(
                    message.key.remoteJid,
                    { image: sticker },
                    {
                        quoted: message,
                        ephemeralExpiration: WA_DEFAULT_EPHEMERAL
                    }
                )
                continue
            }
        }
    })
}

connectToWhatsApp()

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

app.get('/api/groups', async (req, res) => {
    res.json({
        status: 'ok',
        data: await groupFetchAllParticipating()
    })
})

app.post('/api/webhook', (req, res) => {
    console.log(req.body)
    res.json({
        status: 'ok',
        data: req.body
    })
})

app.listen(3000, () => console.log('Web Server Started'))