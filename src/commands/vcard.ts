import { GroupMetadata, jidNormalizedUser } from '@whiskeysockets/baileys'
import path from 'path'

import { getClient } from '../bot'
import { bot } from '../config'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { getPhoneFromJid, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { capitalize } from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['contato', 'vcard'],
  desc: 'Envia o contato do bot.',
  example: undefined,
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
  onlyVip: false,
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
    isVip: boolean,
    isGroupAdmin: boolean,
    amAdmin: boolean
  ) => {
    const check = await checkCommand(jid, message, alias, group, isBotAdmin, isVip, isGroupAdmin, amAdmin, command)
    if (!check) return

    // get the client
    const client = getClient()

    // get the bot jid
    const clientJid = jidNormalizedUser(client.user?.id)

    // get the bot phone
    const phone = getPhoneFromJid(clientJid)

    // send a contact!
    const vcard = 'BEGIN:VCARD\n' // metadata of the contact card
      + 'VERSION:3.0\n'
      + `FN:${bot.name} 🤖\n` // full name
      + `TEL;type=CELL;type=VOICE;waid=${phone}:+${phone}\n` // WhatsApp ID + phone number
      + 'END:VCARD'

    return await sendMessage(
      {
        contacts: {
          displayName: `${bot.name} 🤖`,
          contacts: [{ vcard }]
        }
      },
      message
    )
  }
}
