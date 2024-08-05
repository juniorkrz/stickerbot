import { GroupMetadata, jidNormalizedUser, WAMessage } from '@whiskeysockets/baileys'
import path from 'path'

import { getClient } from '../bot'
import { StickerBotCommand } from '../types/Command'
import { getBodyWithoutCommand, react, sendMessage } from '../utils/baileysHelper'
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
  aliases: ['todos', 'todas', 'tds', 'all', 'everyone'],
  desc: 'Menciona todos os membros do grupo.',
  example: 'olhem isso aqui!',
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: false,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: true,
  onlyVip: false,
  botMustBeAdmin: false,
  interval: 30,
  limiter: {}, // do not touch this
  run: async (
    jid: string,
    sender: string,
    message: WAMessage,
    alias: string,
    body: string,
    group: GroupMetadata | undefined,
    isVip: boolean,
    isBotAdmin: boolean,
    isGroupAdmin: boolean,
    amAdmin: boolean
  ) => {
    const check = await checkCommand(jid, message, alias, group, isBotAdmin, isVip, isGroupAdmin, amAdmin, command)
    if (!check) return

    // Mentions all group members except the bot.

    const client = getClient()
    const alert = getBodyWithoutCommand(body, command.needsPrefix, alias)

    if (!group) {
      await react(message, emojis.error)
      return
    }

    const botJid = jidNormalizedUser(client.user?.id)
    const participants = group.participants.filter(
      participant => participant.id !== botJid)
      .map(({ id }) => id)

    const phrase = alert ?
      `{📢|📣|⚠|❗|‼️} - ${alert}` :
      '{📢|📣|⚠|❗|‼️} - {Atenção|Olhem isso|Prestem atenção|Ei}!'

    return await sendMessage(
      {
        text: spintax(phrase),
        mentions: participants
      },
      message
    )
  }
}
