import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { getClient } from '../bot'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { react } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { capitalize } from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['fechar', 'close'],
  desc: 'Fecha o grupo para que apenas os administradores possam mandar mensagens.',
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
    isVip: boolean,
    isGroupAdmin: boolean,
    amAdmin: boolean
  ) => {
    const check = await checkCommand(
      jid,
      message,
      alias,
      group,
      isBotAdmin,
      isVip,
      isGroupAdmin,
      amAdmin,
      command
    )
    if (!check) return

    // get the client
    const client = getClient()

    // close the group
    await client.groupSettingUpdate(jid, 'announcement')

    // react success
    return await react(message, emojis.close)
  }
}
