import { extractMessageContent, GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { getLogger } from '../handlers/logger'
import { makeSticker } from '../handlers/sticker'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import {
  extractCaptionsFromBodyOrCaption,
  getImageMessageFromContent,
  getQuotedMessage,
  getStickerMessageFromContent,
  sendLogToAdmins,
  sendMessage
} from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
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
  aliases: ['rembg', 'bg', 'recortar', 'recorte'],
  desc: 'Cria um sticker removendo a imagem de fundo.',
  example: undefined,
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
  onlyVip: true,
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
    isVip: boolean,
    isGroupAdmin: boolean,
    amAdmin: boolean
  ) => {
    const check = await checkCommand(jid, message, alias, group, isBotAdmin, isVip, isGroupAdmin, amAdmin, command)
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

    // get body without commands
    const bodyWithoutCommand = body
      .slice(command.needsPrefix ? 1 : 0)
      .replace(new RegExp(alias, 'i'), '')
      .trim()
      .toLowerCase()

    // get captions
    const captions = bodyWithoutCommand
      ? extractCaptionsFromBodyOrCaption(bodyWithoutCommand)
      : undefined

    // if the text is too large, send an error
    const maxChars = 200
    if (bodyWithoutCommand.length > maxChars) {
      return await sendMessage(
        { text: spintax(`⚠ O texto deve ter no máximo *${maxChars}* caracteres!`) },
        message
      )
    }

    // make sticker
    const result = await makeSticker(
      message,
      {
        quotedMsg,
        rembg: true,
        captions
      }
    )

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

    // return result
    return result
  }
}
