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
  aliases: ['feriados', 'holidays'],
  desc: 'Lista todos os feriados no Brasil, destacando o próximo.',
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
      const now = new Date()
      let nextHolidayIndex = -1

      for (let i = 0; i < data.length; i++) {
        if (new Date(data[i].date) >= now) {
          nextHolidayIndex = i
          break
        }
      }

      // Constructing the response message
      let response = '🎉 *Lista de Feriados no Brasil:* \n\n'

      response += '(DD/MM/AAAA)\n\n'

      for (let i = 0; i < data.length; i++) {
        const { name, date } = data[i]
        const holidayDate = new Date(date).toLocaleDateString('pt-BR')

        if (i === nextHolidayIndex) {
          response += `*🔸 ${name}* - ${holidayDate}\n`
        } else {
          response += `- ${name} - ${holidayDate}\n`
        }
      }

      response += `\n_Consultado com ${bot.name}. Digite !pix para apoiar o projeto._`

      return await sendMessage(
        { text: spintax(response) },
        message
      )
    } catch (error) {
      logger.warn('API: BrasilAPI/Feriados error!')
      await sendLogToAdmins('*[API]:* BrasilAPI/Feriados error!')
      const reply = '⚠ Desculpe, não consegui obter informações sobre os feriados. ' +
        'Por favor, tente novamente mais tarde.'
      return await sendMessage(
        { text: reply },
        message
      )
    }
  }
}
