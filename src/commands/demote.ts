import { GroupMetadata, jidNormalizedUser } from '@whiskeysockets/baileys'
import path from 'path'

import { getClient } from '../bot'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { compareJids, getMentionedJids, isJidInParticipantList, react, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { capitalize, spintax } from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['rebaixar', 'demote'],
  desc: 'Rebaixa o participante mencionado para membro do grupo.',
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

    const mentionedJids = getMentionedJids(message)

    if (!mentionedJids || mentionedJids.length < 1) {
      return await sendMessage(
        {
          text: spintax('⚠ {Ei|Opa|Eita|Ops}, o número a ser rebaixado não foi encontrado, *mencione* alguém!')
        },
        message
      )
    }

    // get the client
    const client = getClient()

    if (!group) return await react(message, emojis.error)

    const clientJid = jidNormalizedUser(client.user?.id)
    for (const mentionedJid of mentionedJids) {
      // Is the user an member of this group?
      const isMember = await isJidInParticipantList(mentionedJid, group.participants)
      // Is the user being kicked the bot?
      const isMe = await compareJids(mentionedJid, clientJid)
      // Is the user to be kicked the sender himself?
      const hisSelf = await compareJids(mentionedJid, sender)

      if (isMe || hisSelf) {
        return await sendMessage(
          {
            text: spintax(
              `⚠ {Você|Tu|Vc} não pode ${isMe ? 'me' : 'se'} rebaixar {bobinho(a)|besta}! ` +
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
              '⚠ {Ei|Opa|Eita|Ops}, o número a ser rebaixado não {está|tá}{ aqui|} no grupo!'
            )
          },
          message
        )
      }
    }

    try {
      const response = await client.groupParticipantsUpdate(jid, mentionedJids.slice(0, 5), 'demote')
      const status = response[0].status

      if (status === '200') {
        return react(message, emojis.demote)
      } else {
        return react(message, emojis.error)
      }
    } catch (error) {
      return react(message, emojis.error)
    }
  }
}
