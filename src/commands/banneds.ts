import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { getClient } from '../bot'
import { getAllBannedUsers } from '../handlers/db'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { getMessageOptions, getPhoneFromJid, react } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { capitalize, getRandomItemFromArray, spintax } from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['banidos'],
  desc: 'Mostra os usuários banidos.',
  example: undefined,
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: true,
  onlyAdmin: false,
  onlyVip: false,
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

    const banneds = await getAllBannedUsers()
    let response = '🚫 *Usuários banidos*\n'

    if (banneds.length == 0) {
      response += '\nNenhum usuário banido'
    } else {
      banneds.forEach((banned, index) => {
        const phone = getPhoneFromJid(banned.user)
        if (phone) {
          response += `\n${index + 1} - ${phone}`
        }
      })
    }

    const client = getClient()
    await react(message, getRandomItemFromArray(emojis.success))
    return await client.sendMessage(
      sender,
      { text: spintax(response) },
      getMessageOptions(message, false)
    )
  }
}
