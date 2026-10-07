import { downloadMediaMessage, extractMessageContent, GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { makeNdz } from '../handlers/legacyMemes'
import { getLogger } from '../handlers/logger'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import {
  getImageMessageFromContent,
  getQuotedMessage,
  getStickerMessageFromContent,
  react,
  sendMessage
} from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { capitalize, spintax } from '../utils/misc'

// Gets the logger
const logger = getLogger()

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['ndz', 'negaodozap', 'negao'],
  desc: 'Coloca a imagem enviada no "Negão do zap".',
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
  interval: 10,
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

    // only images and static stickers
    const sticker = content ? getStickerMessageFromContent(content) : undefined
    if (!content || !(getImageMessageFromContent(content) || (sticker && !sticker.isAnimated))) {
      return await sendMessage(
        {
          text: spintax(
            `⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, {para|pra} {utilizar|usar} o comando *${alias}* ` +
            '{você|vc|tu} {deve|precisa} enviar uma imagem com o comando na legenda ou responder a uma imagem.'
          )
        },
        message
      )
    }

    try {
      const media = <Buffer>await downloadMediaMessage(targetMessage, 'buffer', {})
      const image = await makeNdz(media)
      return await sendMessage({ image }, message)
    } catch (error) {
      logger.error(`Error creating ndz: ${error}`)
      return await react(message, emojis.error)
    }
  }
}
