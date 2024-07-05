import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'
import { IStickerOptions } from 'wa-sticker-formatter'

import { stickerMeta } from '../config'
import { makeSticker } from '../handlers/sticker'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { getImageMessage, getQuotedMessage, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { capitalize, spintax } from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['renomear', 'roubar', 'rename'],
  desc: 'Renomeia o autor e o pack de uma figurinha.',
  example: 'novo autor | novo pack',
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
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
    isGroupAdmin: boolean,
    amAdmin: boolean
  ) => {
    const check = await checkCommand(jid, message, alias, group, isBotAdmin, isGroupAdmin, amAdmin, command)
    if (!check) return

    const quotedMsg = getQuotedMessage(message)

    const targetMessage = quotedMsg
      ? quotedMsg
      : message

    const allowedMedia = getImageMessage(targetMessage) || targetMessage.message?.stickerMessage

    if (!allowedMedia) return await sendMessage(
      {
        text: spintax(
          `⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, {para|pra} {utilizar|usar} o comando *${alias}* ` +
          '{você|vc|tu} {deve|precisa} responder a um{ sticker|a figurinha} ou imagem com o comando.'
        )
      },
      message
    )

    let author, pack

    const text = body.slice(command.needsPrefix ? 1 : 0).replace(alias, '').trim()
    const splittedText = text.split('|').length > 1
      ? text.split('|')
      : text.split('/').length > 1
        ? text.split('/')
        : false

    if (splittedText && splittedText.length == 2){
      pack = splittedText[0]
      author = splittedText[1]
    } else if (message?.pushName) {
      author = `Feita por ${message.pushName}`
      pack = stickerMeta.pack
    } else {
      return await sendMessage(
        {
          text: spintax(
            `⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, {para|pra} {utilizar|usar} o comando *${alias}* ` +
            '{você|vc|tu} {escrever|digitar} o novo autor e o pack {após |depois d}o comando ' +
            'separados por *|* ou */* {🧐|🫠|🥲|🙃|📝}'
          )
        },
        message
      )
    }

    const meta: IStickerOptions = {
      author,
      pack
    }

    return await makeSticker(
      message,
      {
        meta,
        quotedMsg: targetMessage
      }
    )
  }
}
