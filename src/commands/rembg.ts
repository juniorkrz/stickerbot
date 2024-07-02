import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { getLogger } from '../handlers/logger'
import { makeRembgSticker } from '../handlers/sticker'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { getImageMessage, getQuotedMessage, react, sendLogToAdmins, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { capitalize, getRandomItemFromArray } from '../utils/misc'

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

    const quotedMsg = getQuotedMessage(message)

    const targetMessage = quotedMsg
      ? quotedMsg
      : message

    const imageMessage = getImageMessage(targetMessage)

    if (!imageMessage) return await react(message, emojis.error)

    await react(message, getRandomItemFromArray(emojis.wait))

    const result = await makeRembgSticker(message, targetMessage)

    if (!result) {
      logger.warn('API: rembg is down!')
      await sendLogToAdmins('*[API]:* rembg is down!')
      const reply = '⚠ Desculpe, este serviço está indisponível no momento. Por favor, tente novamente mais tarde.'
      return await sendMessage(
        { text: reply },
        message
      )
    }

    return await react(message, getRandomItemFromArray(emojis.success))
  }
}
