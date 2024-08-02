import { GroupMetadata } from '@whiskeysockets/baileys'
import axios from 'axios'
import path from 'path'

import { bot } from '../config'
import { getLogger } from '../handlers/logger'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { sendLogToAdmins, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { capitalize, spintax } from '../utils/misc'

// Gets the logger
const logger = getLogger()

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['feriado', 'holiday'],
  desc: 'Mostra informações sobre o próximo feriado no Brasil.',
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

    try {
      // Fetching data from BrasilAPI for holidays
      const currentYear = new Date().getFullYear()
      const { data } = await axios.get(`https://brasilapi.com.br/api/feriados/v1/${currentYear}`)

      // Find the next holiday
      const nextHoliday = data.find((holiday: { date: string }) => new Date(holiday.date) >= new Date())

      if (!nextHoliday) {
        throw new Error('Não foi possível encontrar informações sobre o próximo feriado.')
      }

      const { name, date } = nextHoliday

      // Constructing the response message
      const response = `🎉 *Próximo Feriado:* ${name}\n\n` +
        `📅 *Data:* ${new Date(date).toLocaleDateString('pt-BR')}\n` +
        '(DD/MM/AAAA)\n\n' +
        `_Consultado com ${bot.name}. Digite !pix para apoiar o projeto._`

      return await sendMessage(
        { text: spintax(response) },
        message
      )
    } catch (error) {
      logger.warn('API: BrasilAPI/Feriados error!')
      await sendLogToAdmins('*[API]:* BrasilAPI/Feriados error!')
      const reply = '⚠ Desculpe, não consegui obter informações sobre o próximo feriado. ' +
        'Por favor, tente novamente mais tarde.'
      return await sendMessage(
        { text: reply },
        message
      )
    }
  }
}
