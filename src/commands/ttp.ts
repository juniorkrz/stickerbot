import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { getLogger } from '../handlers/logger'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { makeSticker, sendLogToAdmins, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { capitalize, spintax } from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

const logger = getLogger()

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['ttp'],
  desc: 'Cria uma figurinha com o texto fornecido.',
  example: 'Olá mundo!',
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
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
    isGroupAdmin: boolean,
    amAdmin: boolean
  ) => {
    const check = await checkCommand(jid, message, alias, group, isBotAdmin, isGroupAdmin, amAdmin, command)
    if (!check) return

    const maxChars = 200
    const text = body.slice(command.needsPrefix ? 1 : 0).replace(alias, '').trim()

    if (!text) {
      return await sendMessage(
        {
          text: spintax(`⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, {para|pra} {utilizar|usar} o comando *${alias}* `+
            '{você|vc|tu} {escrever|digitar} {um texto|algo} {após |depois d}o comando. {🧐|🫠|🥲|🙃|📝}')
        },
        message
      )
    } else if (text.length > maxChars) {
      return await sendMessage(
        { text: spintax(`⚠ O texto deve ter no máximo *${maxChars}* caracteres!`) },
        message
      )
    }

    try {
      const url = `https://ttp.jrkrz.online/ttp?text=${encodeURIComponent(text)}`
      return await makeSticker(message, false, undefined, url, message)// TODO: This isn't cool, let's fix it later
    } catch (error) {
      logger.warn('API: ttp is down!')
      await sendLogToAdmins('*[API]:* ttp is down!')
      const reply = '⚠ Desculpe, este serviço está indisponível no momento. Por favor, tente novamente mais tarde.'
      await sendMessage(
        { text: reply },
        message
      )
    }
  }
}
