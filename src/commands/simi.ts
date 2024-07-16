import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { getSimSimiResponse } from '../handlers/simSimi'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { getMentionedJids, getPhoneFromJid, react, sendLogToAdmins, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { capitalize, getRandomItemFromArray, spintax } from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['simi', 'bot'],
  desc: 'Responde mensagens usando a API SimSimi.',
  example: 'salve mano, como você tá?',
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
  onlyVip: true,
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

    let query = body.slice(command.needsPrefix ? 1 : 0).replace(new RegExp(alias, 'i'), '')

    // Remove all mentions from the message
    // TODO - improvement: Replace mentioned numbers with pushname?
    const mentionedJids = getMentionedJids(message)
    if (mentionedJids) {
      mentionedJids.forEach(mentionedJid => {
        const phone = getPhoneFromJid(mentionedJid)
        const mentionPattern = new RegExp('@' + phone, 'g')
        query = query.replace(mentionPattern, '')
      })
    }

    // Remove extra spaces
    query = query.replace(/\s{2,}/g, ' ').trim()

    if (!query) {
      return await sendMessage(
        {
          text: spintax(`⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, {para|pra} {utilizar|usar} o comando *${alias}* ` +
            '{você|vc|tu} {precisa|deve} {escrever|digitar} {um texto|algo} {após |depois d}o comando. {🧐|🫠|🥲|🙃|📝}')
        },
        message
      )
    }

    await react(message, getRandomItemFromArray(emojis.wait))

    const response = await getSimSimiResponse(query)

    if (!response) {
      await sendLogToAdmins('*[API]:* SimSimi error!')
      const reply = '⚠ Desculpe, este serviço está indisponível no momento. Por favor, tente novamente mais tarde.'
      return await sendMessage(
        { text: reply },
        message
      )
    }

    await sendMessage(
      { text: '*Simi:* ' + response },
      message
    )

    return await react(message, getRandomItemFromArray(emojis.simi))
  }
}
