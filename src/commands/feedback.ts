import { GroupMetadata, jidDecode } from '@whiskeysockets/baileys'
import path from 'path'

import { getLogger } from '../handlers/logger'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { getBodyWithoutCommand, react, sendLogToAdmins, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
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
  aliases: ['feedback'],
  desc: 'Envia feedback ao criador do bot.',
  example: 'Sua mensagem',
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

    const msg = getBodyWithoutCommand(body, command.needsPrefix, alias)

    if (!msg) return await sendMessage(
      {
        text: spintax(`⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, {para|pra} {utilizar|usar} o comando *${alias}* ` +
          '{você|vc|tu} {precisa|deve} {escrever|digitar} {um texto|algo} {após |depois d}o comando. {🧐|🫠|🥲|🙃|📝}')
      },
      message
    )

    const senderName = message.pushName || 'Desconhecido'
    const groupName = group ? group.subject : 'Desconhecido'
    const identifier = group
      ? `${senderName} (${jidDecode(sender)?.user}) em ${groupName} (${jidDecode(jid)?.user})`
      : `${senderName} (${jidDecode(jid)?.user})`

    const feedback = `${jid}_${message.key.id}\n\n*[FEEDBACK]*\n${identifier}:\n${msg}`
    logger.warn('New feedback received!')
    console.log(feedback)
    await sendLogToAdmins(feedback)
    return await react(message, emojis.pray)
  }
}
