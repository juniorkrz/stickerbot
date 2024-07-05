import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { bot } from '../config'
import { getCount } from '../handlers/db'
import { getActions } from '../handlers/text'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { react, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { capitalize, rPad, spintax } from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['estatisticas', 'stats', 'status'],
  desc: 'Mostra as estatísticas de uso do bot.',
  example: false,
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
  botMustBeAdmin: false,
  interval: 30,
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

    await react(message, '🤖')

    // Build stats text
    let stats = `📊 *Estatísticas do ${bot.name}*\n\n`

    stats += '```'
    const actions = getActions()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [key, action] of Object.entries(actions)) {
      if (action.onlyBotAdmin && (group || !isBotAdmin)) continue
      const total = await getCount(action.name)
      stats += rPad(`${action.aliases[0]}`, 29 - total.toString().length)
      stats += total
      stats += '\n'
    }

    stats = stats.slice(0, -1)

    stats += '```'

    if (bot.donationLink) {
      stats += '\n\nDoações:\n'
      stats += bot.donationLink
    }

    return await sendMessage(
      { text: spintax(stats) },
      message
    )
  }
}
