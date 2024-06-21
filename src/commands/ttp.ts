import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { getLogger } from '../handlers/logger'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { makeSticker, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { capitalize, spintax } from '../utils/misc'

// Gets the file name without the .ts extension
const commandName = capitalize(path.basename(__filename, '.ts'))

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

    const maxChars = 200
    if (!body) {
      return await sendMessage(
        {
          text: spintax(`⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, {para|pra} {utilizar|usar} o comando *${alias}* `+
            '{você|vc|tu} {escrever|digitar} {um texto|algo} {após |depois d}o comando. {🧐|🫠|🥲|🙃|📝}')
        },
        message
      )
    } else if (body.length > maxChars) {
      return await sendMessage(
        { text: spintax(`⚠ O texto deve ter no máximo *${maxChars}* caracteres!`) },
        message
      )
    }

    try {
      const url = `https://ttp.jrkrz.online/ttp?text=${encodeURIComponent(body)}`
      return await makeSticker(message, false, undefined, url)
    } catch (error) {
      logger.warn('API: ttp is down!')
      const reply = '⚠ Desculpe, este serviço está indisponível no momento. Por favor, tente novamente mais tarde.'
      await sendMessage(
        { text: reply },
        message
      )
    }
  }
}
