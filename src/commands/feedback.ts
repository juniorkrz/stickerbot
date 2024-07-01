import { GroupMetadata, jidDecode } from '@whiskeysockets/baileys'
import path from 'path'

import { getLogger } from '../handlers/logger'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { react, sendLogToAdmins } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { capitalize } from '../utils/misc'

// Gets the logger
const logger = getLogger()

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['feedback'],
  desc: 'Envia feedback ao criador do bot.',
  example: false,
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
    if (!check) {
      return
    }

    const msg = body.slice(command.needsPrefix ? 1 : 0).replace(alias, '').trim()

    const senderName = message.pushName || 'Desconhecido'
    const groupName = group ? group.subject : 'Desconhecido'
    const identifier = group
      ? `${senderName} (${jidDecode(sender)?.user}) em ${groupName} (${jidDecode(jid)?.user})`
      : `${senderName} (${jidDecode(jid)?.user})`

    const feedback = `${jid}_${message.key.id}\n\n${identifier}:\n${msg}`
    logger.warn('New feedback received!')
    console.log(feedback)
    sendLogToAdmins(feedback)
    return await react(message, '🙏')
  }
}
