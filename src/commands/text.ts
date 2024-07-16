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
  aliases: ['texto', 'text'],
  desc: 'Cria uma figurinha com o texto e imagem fornecidos.',
  example: 'frase de cima;frase de baixo',
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

    // if the text is too large or does not exist, send an error
    const maxChars = 200
    if (!captions || captions.length == 0) {
      return await sendMessage(
        {
          text: spintax(`⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, {para|pra} {utilizar|usar} o comando *${alias}* ` +
            '{você|vc|tu} {precisa|deve} {escrever|digitar} {um texto|algo} {após |depois d}o comando. {🧐|🫠|🥲|🙃|📝}')
        },
        message
      )
    } else if (bodyWithoutCommand.length > maxChars) {
      return await sendMessage(
        { text: spintax(`⚠ O texto deve ter no máximo *${maxChars}* caracteres!`) },
        message
      )
    }

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

    // make sticker
    const result = await makeSticker(
      message,
      {
        quotedMsg,
        captions
      }
    )

    // if something goes wrong, notify the user and admins
    if (!result) {
      logger.warn('API: memegen/text error!')
      await sendLogToAdmins('*[API]:* memegen/text error!')
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
