import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { getClient } from '../bot'
import { bot } from '../config'
import { getVips } from '../handlers/db'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { getMessageOptions, getPhoneFromJid, isSenderBotMaster, react, sendMessage } from '../utils/baileysHelper'
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
  aliases: ['vips'],
  desc: 'Mostra os VIPs do bot.',
  example: undefined,
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: true,
  onlyAdmin: false,
  onlyVip: false,
  botMustBeAdmin: false,
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

    if (!isSenderBotMaster(sender)) return await sendMessage(
      {
        text: spintax(
          '⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, você não tem acesso a esse comando.'
        )
      },
      message
    )

    const vips = await getVips()
    let response = `👑 *VIPs do ${bot.name}*\n`

    const permanentVips = vips.filter(vip => vip.permanent)
    const nonPermanentVips = vips.filter(vip => !vip.permanent)

    if (permanentVips.length == 0 && nonPermanentVips.length == 0) {
      response += '\nNenhum VIP encontrado! :('
    } else {
      permanentVips.forEach((vip, index) => {
        const phone = getPhoneFromJid(vip.jid)
        if (phone) {
          response += `\n${index + 1} - ${phone} - Permanente`
        }
      })

      nonPermanentVips.forEach((vip, index) => {
        const phone = getPhoneFromJid(vip.jid)
        if (phone) {
          // convert vip.expires to datetime
          const expires = new Date(vip.expires)

          response += `\n${index + permanentVips.length + 1} - ${phone} - ${expires.toLocaleString()}`
        }
      })

      response += '\n\nTelefone - Data de expiração'
    }

    const client = getClient()
    await react(message, getRandomItemFromArray(emojis.success))
    return await client.sendMessage(
      sender,
      { text: spintax(response) },
      getMessageOptions(message, false)
    )
  }
}
