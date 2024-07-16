import { extractMessageContent, GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { sendStickerAsImage } from '../handlers/sticker'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import {
  getQuotedMessage,
  getStickerMessageFromContent,
  react,
  sendMessage
} from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { capitalize, spintax } from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['img'],
  desc: 'Transforma um sticker em imagem.',
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
  interval: 3,
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

    // get quoted message
    const quotedMsg = getQuotedMessage(message)

    // get message content
    const content = extractMessageContent(quotedMsg?.message)

    // error response
    const errorResponse = `⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, {para|pra} {utilizar|usar} o comando *${alias}* ` +
      '{você|vc|tu} {deve|precisa} responder a um{ sticker|a figurinha} com o comando.'

    // if you can't find the content, send an error message
    if (!quotedMsg || !content) return await sendMessage(
      { text: spintax(errorResponse) },
      message
    )

    // is the content allowed?
    const isContentAllowed = (
      getStickerMessageFromContent(content)
    )

    // if not, send an error message
    if (!isContentAllowed) return await sendMessage(
      { text: spintax(errorResponse) },
      message
    )

    // send sticker as image
    const result = await sendStickerAsImage(quotedMsg)

    // if something wrong, react error
    if (!result) return await react(message, emojis.error)

    return result
  }
}
