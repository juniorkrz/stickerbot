import { GroupMetadata, jidNormalizedUser } from '@whiskeysockets/baileys'
import path from 'path'

import { getClient } from '../bot'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { compareJids, getMentionedJids, getQuotedMessageAuthor, isJidInParticipantList, react, sendMessage } from '../utils/baileysHelper'
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
  aliases: ['remover', 'kick'],
  desc: 'Remove o participante mencionado do grupo.',
  example: undefined,
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: false,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: true,
  onlyVip: false,
  botMustBeAdmin: true,
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

    // Getting jids to kick

    // Trying to get by mentions or quoted message author
    const mentionedJids = getMentionedJids(message)

    let kickedUsers: string[] = []
    if (mentionedJids && mentionedJids.length >= 1) {
      kickedUsers = mentionedJids
    } else {
      const quotedAuthor = getQuotedMessageAuthor(message)
      if (quotedAuthor) kickedUsers = [quotedAuthor]
    }

    if (!kickedUsers || kickedUsers.length < 1) {
      return await sendMessage(
        {
          text: spintax(
            '⚠ {Ei|Opa|Eita|Ops}, o número a ser removido não foi encontrado, *mencione* alguém ou cite uma mensagem!'
          )
        },
        message
      )
    }

    // get the client
    const client = getClient()

    if (!group) return await react(message, emojis.error)

    const clientJid = jidNormalizedUser(client.user?.id)
    for (const user of kickedUsers) {
      // Is the user an member of this group?
      const isMember = await isJidInParticipantList(user, group.participants)
      // Is the user being kicked the bot?
      const isMe = await compareJids(user, clientJid)
      // Is the user to be kicked the sender himself?
      const hisSelf = await compareJids(user, sender)

      if (isMe || hisSelf) {
        return await sendMessage(
          {
            text: spintax(
              `⚠ {Você|Tu|Vc} não pode ${isMe ? 'me' : 'se'} remover {bobinho(a)|besta}! ` +
              '{`¯\\_(ツ)_/¯`|🧐|🫠|😉|😌|🤓|🤪|🤔|🫤}'
            )
          },
          message
        )
      }

      if (!isMember) {
        return await sendMessage(
          {
            text: spintax(
              '⚠ {Ei|Opa|Eita|Ops}, o número a ser removido não {está|tá}{ aqui|} no grupo!'
            )
          },
          message
        )
      }
    }

    try {
      const response = await client.groupParticipantsUpdate(jid, kickedUsers.slice(0, 5), 'remove')
      const status = response[0].status

      if (status === '200') {
        return react(message, getRandomItemFromArray(emojis.success))
      } else {
        return react(message, emojis.error)
      }
    } catch (error) {
      return react(message, emojis.error)
    }
  }
}
