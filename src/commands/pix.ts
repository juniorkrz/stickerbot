import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

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
  aliases: ['pix', 'donate'],
  desc: `Chave Pix para colaborar com o ${bot.name}.`,
  example: false,
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

    const response = `{{Apoie|Ajude|Colabore com} o *${bot.name}* 💜\n\n` +
    '{Qualquer valor é super bem-vindo|Qualquer quantia é super bem-vinda} ' +
    'e vai nos ajudar a {cobrir|manter} os {custos|gastos} de desenvolvimento e manutenção.\n\n' +
    `{Utilize|Use} a chave pix: ${bot.donationLink}|🤖 *{Colabore com qualquer valor! 💜|` +
    `Envie o que seu 💜 mandar!}*\n\nChave Pix: ${bot.donationLink}}`

    return await sendMessage(
      { text: spintax(response) },
      message
    )
  }
}
