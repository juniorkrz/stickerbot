import { extractMessageContent, GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import {
  getQuotedMessage,
  sendMessage,
  viewOnceMessageRelay
} from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { capitalize, spintax } from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['visualizar', 'view'],
  desc: 'Mostra a imagem/vídeo/áudio mais uma vez.',
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
  interval: 5,
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

    // if you can't find the content, send an error message
    if (!quotedMsg || !content) return await sendMessage(
      {
        text: spintax(
          '⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, não foi possível encontrar o conteúdo da mensagem,' +
          ' {você|vc} deve citar uma mensagem de *visualização única*!'
        )
      },
      message
    )

    // If media type is not allowed, send an error message
    if (
      !content?.imageMessage?.viewOnce &&
      !content?.videoMessage?.viewOnce &&
      !content?.audioMessage?.viewOnce
    ) return await sendMessage(
      {
        text: spintax(
          `⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, {para|pra} {utilizar|usar} o comando *${alias}* ` +
          '{você|vc|tu} {deve|precisa} responder a uma imagem/vídeo/áudio de *visualização única* com o comando.'
        )
      },
      message
    )

    // send message
    const result = await viewOnceMessageRelay(quotedMsg, content, jid)

    // if something wrong, return an error message
    if (!result) return await sendMessage(
      {
        text: spintax(
          '⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, algo deu errado ao enviar a mensagem.'
        )
      },
      message
    )
  }
}
