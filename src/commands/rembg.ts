import { extractMessageContent, GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { getLogger } from '../handlers/logger'
import { makeRembgSticker } from '../handlers/sticker'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import {
  getImageMessageFromContent,
  getQuotedMessage,
  getStickerMessageFromContent,
  react,
  sendLogToAdmins,
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
  aliases: ['rembg', 'bg', 'recortar', 'recorte'],
  desc: 'Cria um sticker removendo a imagem de fundo.',
  example: false,
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
  botMustBeAdmin: false,
  interval: 0,
  limiter: {}, // do not touch this
  run: async (
    jid: string,
    sender: string,
    message: WAMessageExtended,
    alias: string,
    body: string,
    group: GroupMetadata | undefined,
    isBotAdmin: boolean,
    isGroupAdmin: boolean,
    amAdmin: boolean
  ) => {
    const check = await checkCommand(jid, message, alias, group, isBotAdmin, isGroupAdmin, amAdmin, command)
    if (!check) return

    // get quoted message
    const quotedMsg = getQuotedMessage(message)

    // get target message
    const targetMessage = quotedMsg
      ? quotedMsg
      : message

    // get message content
    const content = extractMessageContent(targetMessage.message)

    // if you can't find the content, send an error message
    if (!content) return await sendMessage(
      {
        text: spintax(
          '⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, não foi possível encontrar o conteúdo da mensagem.'
        )
      },
      message
    )

    // is the content allowed?
    const isContentAllowed = (
      getImageMessageFromContent(content) ||
      getStickerMessageFromContent(content)
    )

    // if not, send an error message
    if (!isContentAllowed) return await sendMessage(
      {
        text: spintax(
          `⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, {para|pra} {utilizar|usar} o comando *${alias}* ` +
          '{você|vc|tu} {deve|precisa} responder a um{ sticker|a figurinha} ou imagem com o comando.'
        )
      },
      message
    )

    // react wait
    await react(message, getRandomItemFromArray(emojis.wait))

    // make sticker
    const result = await makeRembgSticker(message, targetMessage)

    // if something goes wrong, notify the user and admins
    if (!result) {
      logger.warn('API: rembg is down!')
      await sendLogToAdmins('*[API]:* rembg está offline!')
      const reply = '⚠ Desculpe, este serviço está indisponível no momento. Por favor, tente novamente mais tarde.'
      return await sendMessage(
        { text: reply },
        message
      )
    }

    // react success
    return await react(message, getRandomItemFromArray(emojis.success))
  }
}
