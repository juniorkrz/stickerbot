import { GroupMetadata, jidEncode } from '@whiskeysockets/baileys'
import path from 'path'

import { getClient } from '../bot'
import { addVip } from '../handlers/db'
import { getLogger } from '../handlers/logger'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import {
  getMentionedJids,
  getMessageOptions,
  getPhoneFromJid,
  getQuotedMessage,
  isSenderBotMaster,
  react,
  sendLogToAdmins,
  sendMessage
} from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { capitalize, getRandomItemFromArray, spintax } from '../utils/misc'

// Gets the logger
const logger = getLogger()

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['vip'],
  desc: 'Adiciona o usuário mencionado/autor da mensagem citada/número informado aos vips do bot.',
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

    // Getting client
    const client = getClient()

    // Getting jids to add

    // Trying to get by mentions
    let vips = getMentionedJids(message)

    // Trying to get the author of the quoted message
    if (vips?.length == 0) {
      const quotedMsg = getQuotedMessage(message)
      if (quotedMsg) {
        vips = [
          quotedMsg.key.fromMe
            ? quotedMsg.participant!
            : quotedMsg.key.participant!
        ]
      }
    }

    // Trying to get the parameter in the message body
    if (vips?.length == 0) {
      const phone = body
        .slice(command.needsPrefix ? 1 : 0)
        .replace(new RegExp(alias, 'i'), '')
        .replace('perma', '')
        .replace(/\*.*/, '')
        .trim()
        .replace(/\D/g, '')

      if (phone.length > 3) {
        vips = [jidEncode(phone, 's.whatsapp.net')]
      }
    }

    vips = vips?.filter(user => user?.length > 0)// Remove empty entries
    vips = Array.from(new Set(vips))// Remove duplicate entries

    if (vips?.length == 0) {
      return await sendMessage(
        {
          text: spintax(
            '⚠ {Ei|Opa|Eita|Ops}, o número a ser adicionado aos vips não foi encontrado, ' +
            'você pode *mencionar* alguém, *citar* uma mensagem ou *escrever* o número após o comando!'
          )
        },
        message
      )
    }

    const permanent = body.includes('perma')
    const monthsRegex = /\*\s*(\d+)/
    const monthsMatch = body.match(monthsRegex)
    const months = monthsMatch ? parseInt(monthsMatch[1]) : 1

    let logs = ''
    for (const vip of vips) {
      await addVip(vip, months, permanent)

      // period description
      const period = permanent ? 'permanente' : `${months} ${months == 1 ? 'mês' : 'meses'}`

      const currentMsg = `*[VIP]:* Admin @${getPhoneFromJid(sender)} setou o VIP de ${getPhoneFromJid(vip)} ` +
        `para *${period}*!`
      logger.warn(currentMsg.replaceAll('*', ''))
      logs += `${currentMsg}\n`

      let expiration
      if (permanent) {
        expiration = 'Nunca'
      } else {
        const expiresInDateTime = new Date()
        expiresInDateTime.setMonth(expiresInDateTime.getMonth() + months)
        expiration = expiresInDateTime.toLocaleString()
      }

      await client.sendMessage(
        vip,
        {
          text: spintax(
            `Olá! 💜\n\nSeu status *VIP* foi atualizado para *${period}*!\n` +
            'Confira o que você consegue fazer digitando o comando *!vantagens*\n\n' +
            `*Data de expiração:* ${expiration}`
          )
        },
        getMessageOptions(message, false)
      )
    }

    await sendLogToAdmins(logs.slice(0, -1), [sender])

    return await react(message, getRandomItemFromArray(emojis.success))

  }
}
