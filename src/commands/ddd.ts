import { GroupMetadata } from '@whiskeysockets/baileys'
import axios from 'axios'
import path from 'path'

import { bot } from '../config'
import { getLogger } from '../handlers/logger'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { getBodyWithoutCommand, sendLogToAdmins, sendMessage } from '../utils/baileysHelper'
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
  aliases: ['ddd'],
  desc: 'Mostra informações do DDD enviado.',
  example: '11',
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

    const ddd = getBodyWithoutCommand(body, command.needsPrefix, alias).replace(/\D/g, '')

    // Validate the DDD input
    if (!/^\d{2}$/.test(ddd)) {
      const errorMessage = '⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, o DDD fornecido é inválido. ' +
        'Por favor, insira um DDD válido de *2 dígitos* e tente novamente.'
      return await sendMessage(
        { text: spintax(errorMessage) },
        message
      )
    }

    try {
      // Fetching data from the BrasilAPI
      const { data } = await axios.get(`https://brasilapi.com.br/api/ddd/v1/${ddd}`)

      const { state, cities } = data

      // Constructing the response message
      const response = `📞 *Informações do DDD ${ddd}:*\n\n` +
        `🗺️ *Estado:* ${state}\n` +
        `🏙️ *Cidades:*\n${cities.reverse().map((city: string) => `- ${city}`).join('\n')}\n\n` +
        `_Consultado com ${bot.name}. Digite !pix para apoiar o projeto._`

      return await sendMessage(
        { text: spintax(response) },
        message
      )
    } catch (error) {
      logger.warn('API: BrasilAPI/DDD error!')
      await sendLogToAdmins('*[API]:* BrasilAPI/DDD error!')
      const reply = '⚠ Desculpe, não consegui obter informações para o DDD fornecido. ' +
        'Por favor, verifique se está correto e tente novamente.'
      return await sendMessage(
        { text: reply },
        message
      )
    }
  }
}
