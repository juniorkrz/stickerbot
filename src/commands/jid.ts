import { GroupMetadata, WAMessage } from '@whiskeysockets/baileys'
import { StickerBotCommand } from '../types/Command'
import { capitalize } from '../utils/misc'
import { checkCommand } from '../utils/commandValidator'
import path from 'path'
import { sendMessage } from '../utils/baileysHelper'

// Gets the file name without the .ts extension
const commandName = capitalize(path.basename(__filename, '.ts'))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['jid'],
  desc: 'Informa o JID do chat.',
  example: false,
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: true,
  onlyAdmin: false,
  botMustBeAdmin: false,
  interval: 0,
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
      return false
    }

    // Send chat JID

    return await sendMessage(
      { text: jid ? jid : 'Desconhecido' },
      message,
    )
  }
}
