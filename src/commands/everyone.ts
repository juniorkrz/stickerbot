import { GroupMetadata, jidNormalizedUser, WAMessage } from '@whiskeysockets/baileys'
import path from 'path'

import { getClient } from '../bot'
import { StickerBotCommand } from '../types/Command'
import { react, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { capitalize, spintax } from '../utils/misc'


// Gets the file name without the .ts extension
const commandName = capitalize(path.basename(__filename, '.ts'))


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
  onlyAdmin: false,
  botMustBeAdmin: false,
  interval: 30,
  limiter: {}, // do not touch this
  run: async (
    jid: string,
    message: WAMessage,
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

    // Mentions all group members except the bot.

    const client = getClient()
    const alert = body.slice(command.needsPrefix ? 1 : 0).replace(alias, '').trim()

    if (!group) {
      await react(message, '❌')
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
