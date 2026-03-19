import { GroupMetadata, jidEncode } from '@whiskeysockets/baileys'
import path from 'path'

import { getClient } from '../bot'
import { bot } from '../config'
import { unban } from '../handlers/db'
import { getLogger } from '../handlers/logger'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import {
  compareJids,
  getMentionedJids,
  getPhoneFromJid,
  getQuotedMessage,
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
  aliases: ['unban'],
  desc: 'Desbane o usuário mencionado/autor da mensagem citada/número informado.',
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

    // Getting jids to unban

    // Trying to get by mentions
    let unbannedUsers = getMentionedJids(message)

    // Trying to get the author of the quoted message
    if (unbannedUsers?.length == 0) {
      const quotedMsg = getQuotedMessage(message)
      if (quotedMsg) {
        unbannedUsers = [
          quotedMsg.key.fromMe
            ? quotedMsg.participant!
            : quotedMsg.key.participant!
        ]
      }
    }

    // Trying to get the parameter in the message body
    if (unbannedUsers?.length == 0) {
      const phone = body.slice(command.needsPrefix
        ? 1
        : 0)
        .replace(new RegExp(alias, 'i'), '')
        .trim()

      if (phone.length > 3) {
        unbannedUsers = [jidEncode(phone, 's.whatsapp.net')]
      }
    }

    unbannedUsers = unbannedUsers?.filter(user => user.length > 0)// Remove empty entries
    unbannedUsers = Array.from(new Set(unbannedUsers))// Remove duplicate entries

    if (unbannedUsers?.length == 0) {
      return await sendMessage(
        {
          text: spintax(
            '⚠ {Ei|Opa|Eita|Ops}, o número a ser desbanido não foi encontrado, ' +
            'você pode *mencionar* alguém, *citar* uma mensagem ou *escrever* o número após o comando!'
          )
        },
        message
      )
    }

    let logs = ''
    const client = getClient()

    for (const user of unbannedUsers) {
      // Is the user being unbanned the bot?
      const isMe = await compareJids(user, client.user?.id)
      // Is the user to be unbanned the sender himself?
      const hisSelf = await compareJids(user, sender)
      // Is the user to be unbanned an admin of the bot?
      const userPhone = await getPhoneFromJid(user)
      const userIsBotAdmin = userPhone ? bot.admins.includes(userPhone) : false

      if (isMe || hisSelf) {
        return await sendMessage(
          {
            text: spintax(
              `⚠ {Você|Tu|Vc} não pode ${isMe ? 'me' : 'se'} desbanir {bobinho(a)|besta}! ` +
              '{`¯\\_(ツ)_/¯`|🧐|🫠|😉|😌|🤓|🤪|🤔|🫤}'
            )
          },
          message
        )
      }

      if (userIsBotAdmin) {
        return await sendMessage(
          {
            text: spintax(
              '⚠ {Você|Tu|Vc} não pode desbanir esse número {bobinho(a)|besta}! {`¯\\_(ツ)_/¯`|🧐|🫠|😉|😌|🤓|🤪|🤔|🫤}'
            )
          },
          message
        )
      }

      // Save to database
      unban(user)

      // Log unbans
      const currentMsg = `*[BANS]:* Admin @${await getPhoneFromJid(sender)} desbaniu ${await getPhoneFromJid(user)}`
      logger.warn(currentMsg.replaceAll('*', ''))
      logs += `${currentMsg}\n`

      // Unblock user
      await client.updateBlockStatus(user, 'unblock')
    }

    // If there is an admin group set, send log
    await sendLogToAdmins(logs.slice(0, -1), [sender])

    return await react(message, getRandomItemFromArray(emojis.success))
  }
}
