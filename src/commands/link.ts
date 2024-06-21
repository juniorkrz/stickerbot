import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { getClient } from '../bot'
import { bot } from '../config'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { capitalize, spintax } from '../utils/misc'

// Gets the file name without the .ts extension
const commandName = capitalize(path.basename(__filename, '.ts'))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['link'],
  desc: 'Envia o link da comunidade do bot.',
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
    message: WAMessageExtended,
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

    const client = getClient()

    if (bot.community){
      const cmmCode = await client.groupInviteCode(bot.community)
      if (cmmCode) {
        return await sendMessage(
          { text: spintax(`{Participe da|Entre na|Tire suas dúvidas na} comunidade oficial do *${bot.name}*! ` +
            `💜\n\nhttps://chat.whatsapp.com/${cmmCode}`) },
          message
        )
      }
    }

    return await sendMessage(
      { text: spintax('⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, o link da comunidade está indisponível no momento!') },
      message
    )
  }
}
