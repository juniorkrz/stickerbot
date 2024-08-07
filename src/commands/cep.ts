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
  aliases: ['cep'],
  desc: 'Mostra informações do CEP enviado.',
  example: '89010025',
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

    const cep = getBodyWithoutCommand(body, command.needsPrefix, alias).replace(/\D/g, '')

    // Validate the CEP input
    if (!/^\d{8}$/.test(cep)) {
      const errorMessage = '⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, o CEP fornecido é inválido. ' +
        'Por favor, insira um CEP válido de *8 dígitos* e tente novamente.'
      return await sendMessage(
        { text: spintax(errorMessage) },
        message
      )
    }

    try {
      // Fetching data from the BrasilAPI
      const { data } = await axios.get(`https://brasilapi.com.br/api/cep/v1/${cep}`)

      const { state, city, neighborhood, street, service } = data

      // Constructing the response message
      const response = `📍 *Informações do CEP ${cep}:*\n\n` +
        `🗺️ *Estado:* ${state ? state : 'Não encontrado'}\n` +
        `🏙️ *Cidade:* ${city ? city : 'Não encontrada'}\n` +
        `🏘️ *Bairro:* ${neighborhood ? neighborhood : 'Não encontrado'}\n` +
        `🛣️ *Rua:* ${street ? street : 'Não encontrada'}\n` +
        `ℹ️ *Serviço:* ${service}\n\n` +
        `_Consultado com ${bot.name}. Digite !pix para apoiar o projeto._`

      return await sendMessage(
        { text: spintax(response) },
        message
      )
    } catch (error) {
      logger.warn('API: BrasilAPI/CEP error!')
      await sendLogToAdmins('*[API]:* BrasilAPI/CEP está offline!')
      const reply = '⚠ Desculpe, não consegui obter informações para o CEP fornecido. ' +
        'Por favor, verifique se está correto e tente novamente.'
      return await sendMessage(
        { text: reply },
        message
      )
    }
  }
}
