import { areJidsSameUser, GroupMetadata, jidEncode } from '@whiskeysockets/baileys'
import path from 'path'

import { getClient } from '../bot'
import { bot } from '../config'
import { ban } from '../handlers/db'
import { getLogger } from '../handlers/logger'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import {
  getAllGroupsFromCommunity,
  getMentionedJids,
  getMessageOptions,
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
  aliases: ['ban'],
  desc: 'Bane o usuário mencionado/autor da mensagem citada/número informado.',
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

    // Getting jids to ban

    // Trying to get by mentions
    let bannedUsers = getMentionedJids(message)

    // Trying to get the author of the quoted message
    if (bannedUsers?.length == 0) {
      const quotedMsg = getQuotedMessage(message)
      if (quotedMsg) {
        bannedUsers = [
          quotedMsg.key.fromMe
            ? quotedMsg.participant!
            : quotedMsg.key.participant!
        ]
      }
    }

    // Trying to get the parameter in the message body
    if (bannedUsers?.length == 0) {
      const phone = body.slice(command.needsPrefix
        ? 1
        : 0)
        .replace(new RegExp(alias, 'i'), '')
        .trim()
        .replace(/\D/g, '')

      if (phone.length > 3) {
        bannedUsers = [jidEncode(phone, 's.whatsapp.net')]
      }
    }

    bannedUsers = bannedUsers?.filter(user => user.length > 0)// Remove empty entries
    bannedUsers = Array.from(new Set(bannedUsers))// Remove duplicate entries

    if (bannedUsers?.length == 0) {
      return await sendMessage(
        {
          text: spintax(
            '⚠ {Ei|Opa|Eita|Ops}, o número a ser banido não foi encontrado, ' +
            'você pode *mencionar* alguém, *citar* uma mensagem ou *escrever* o número após o comando!'
          )
        },
        message
      )
    }

    let logs = ''
    const client = getClient()

    const allCommunityGroups = bot.community
      ? await getAllGroupsFromCommunity(bot.community)
      : undefined

    for (const user of bannedUsers) {
      // Is the user being banned the bot?
      const isMe = areJidsSameUser(user, client.user?.id)
      // Is the user to be banned the sender himself?
      const hisSelf = areJidsSameUser(user, sender)
      // Is the user to be banned an admin of the bot?
      const userIsBotAdmin = bot.admins.includes(getPhoneFromJid(user))

      if (isMe || hisSelf) {
        return await sendMessage(
          {
            text: spintax(
              `⚠ {Você|Tu|Vc} não pode ${isMe ? 'me' : 'se'} banir {bobinho(a)|besta}! {\`¯\\_(ツ)_/¯\`|🧐|🫠|😉|😌|🤓|🤪|🤔|🫤}`
            )
          },
          message
        )
      }

      if (userIsBotAdmin) {
        return await sendMessage(
          {
            text: spintax(
              '⚠ {Você|Tu|Vc} não pode banir esse número {bobinho(a)|besta}! {`¯\\_(ツ)_/¯`|🧐|🫠|😉|😌|🤓|🤪|🤔|🫤}'
            )
          },
          message
        )
      }

      // Save to database
      ban(user)

      // Log bans
      const currentMsg = `*[BANS]:* Admin @${getPhoneFromJid(sender)} baniu ${getPhoneFromJid(user)}`
      logger.warn(currentMsg.replaceAll('*', ''))
      logs += `${currentMsg}\n`


      // If there is a set community, kick the user from all groups in the community
      if (bot.community && allCommunityGroups) {
        for (const group of allCommunityGroups) {
          // Is the user an member of this group?
          const isMember = group.participants.find(p => areJidsSameUser(p.id, user))

          // If not, skip
          if (!isMember) continue

          // Is the bot an admin of this group?
          const amGroupAdmin = group.participants
            .find(p => areJidsSameUser(p.id, client.user?.id))
            ?.admin
            ?.endsWith('admin') !== undefined

          // If you are not an admin, send an alert from the respective group
          if (!amGroupAdmin) {
            await client.sendMessage(
              group.id,
              { text: '⚠ Eu preciso ser *um administrador* do grupo!' },
              getMessageOptions(message, false)
            )
            continue
          }

          // if all right, finally, kick!
          await client.groupParticipantsUpdate(group.id, [user], 'remove')
        }
      }

      // Block user
      await client.updateBlockStatus(user, 'block')
    }

    // If there is an admin group set, send log
    await sendLogToAdmins(logs.slice(0, -1), [sender])

    return await react(message, getRandomItemFromArray(emojis.success))
  }
}
