import { downloadMediaMessage, extractMessageContent, GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { gdzConfig, makeGdz } from '../handlers/legacyMemes'
import { getLogger } from '../handlers/logger'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import {
  getQuotedMessage,
  getVideoMessageFromContent,
  react,
  sendMessage
} from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { capitalize, getRandomItemFromArray, spintax } from '../utils/misc'

// Gets the logger
const logger = getLogger()

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['gdz', 'gemidao'],
  desc: 'Coloca um gemidão do zap no vídeo enviado.',
  example: undefined,
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
  onlyVip: false,
  botMustBeAdmin: false,
  interval: 15,
  limiter: {}, // do not touch this
  run: async (
    jid: string,
    sender: string,
    message: WAMessageExtended,
    alias: string,
    body: string,
    group: GroupMetadata | undefined,
    isBotAdmin: boolean,
    isVip: boolean,
    isGroupAdmin: boolean,
    amAdmin: boolean
  ) => {
    const check = await checkCommand(jid, message, alias, group, isBotAdmin, isVip, isGroupAdmin, amAdmin, command)
    if (!check) return

    // get target message (the message itself or the quoted one)
    const quotedMsg = getQuotedMessage(message)
    const targetMessage = quotedMsg ? quotedMsg : message
    const content = extractMessageContent(targetMessage.message)

    const video = content ? getVideoMessageFromContent(content) : undefined
    if (!video) {
      return await sendMessage(
        {
          text: spintax(
            `⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, {para|pra} {utilizar|usar} o comando *${alias}* ` +
            '{você|vc|tu} {deve|precisa} enviar um vídeo com o comando na legenda ou responder a um vídeo.'
          )
        },
        message
      )
    }

    // the video must last until the watermark shows up
    if (video.seconds && video.seconds < gdzConfig.watermarkTime) {
      return await sendMessage(
        {
          text: spintax(
            '⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, o vídeo {deve|precisa} ter no mínimo ' +
            `*${gdzConfig.watermarkTime}* segundos de duração.`
          )
        },
        message
      )
    }

    await react(message, getRandomItemFromArray(emojis.wait))

    try {
      const media = <Buffer>await downloadMediaMessage(targetMessage, 'buffer', {})
      const result = await sendMessage({ video: await makeGdz(media),
        mimetype: 'video/mp4' }, message)
      await react(message, getRandomItemFromArray(emojis.success))
      return result
    } catch (error) {
      logger.error(`Error creating gdz: ${error}`)
      return await react(message, emojis.error)
    }
  }
}
