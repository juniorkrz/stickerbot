import { GroupMetadata } from '@whiskeysockets/baileys'
import moment from 'moment'
import path from 'path'

import { startedAt } from '../bot'
import { bot } from '../config'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { capitalize, spintax } from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['uptime'],
  desc: 'Mostra a quanto tempo o bot está ligado.',
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

    const currentTime = moment()
    const uptimeDuration = moment.duration(currentTime.diff(startedAt))

    const days = uptimeDuration.days()
    const hours = uptimeDuration.hours()
    const minutes = uptimeDuration.minutes()
    const seconds = uptimeDuration.seconds()

    const timeStrings = []
    if (days > 0) {
      timeStrings.push(`${days} dia${days > 1 ? 's' : ''}`)
    }

    if (hours > 0) {
      timeStrings.push(`${hours} hora${hours > 1 ? 's' : ''}`)
    }

    if (minutes > 0) {
      timeStrings.push(`${minutes} minuto${minutes > 1 ? 's' : ''}`)
    }

    if (seconds > 0) {
      timeStrings.push(`${seconds} segundo${seconds > 1 ? 's' : ''}`)
    }

    const timeStr = timeStrings.join(', ')

    return await sendMessage(
      { text: spintax(`{⏱|⏳|🕓|⏰} {Eu estou|O ${bot.name} está} {online|ligado} há ${timeStr}.`) },
      message
    )
  }
}
