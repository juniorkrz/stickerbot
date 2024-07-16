import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { react, sendMessage } from '../utils/baileysHelper'
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
  aliases: ['regras', 'rules', 'rtfm'],
  desc: 'Envia as regras do grupo.',
  example: undefined,
  needsPrefix: false,
  inMaintenance: false,
  runInPrivate: false,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
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

    let response

    if (group) {
      await react(message, getRandomItemFromArray(emojis.success))
      response = group.desc || '¯\\_(ツ)_/¯'
    } else {
      response = '¯\\_(ツ)_/¯'
    }

    return await sendMessage(
      { text: spintax(response) },
      message
    )
  }
}
