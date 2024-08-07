import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { getStore } from '../bot'
import { bot } from '../config'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { getBody, getBodyWithoutCommand, getQuotedMessage, react, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { capitalize, getRandomItemFromArray } from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['reply'],
  desc: 'Envia resposta ao feedback.',
  example: 'obrigado pelo seu feedback!',
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: true,
  onlyAdmin: false,
  onlyVip: false,
  botMustBeAdmin: false,
  interval: 0,
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

    // If there is no group of logs, do nothing
    if (!bot.logsGroup) return

    // If it's not the log group, don't do anything
    if (jid != bot.logsGroup) return

    // Get the quoted message
    const quotedMsg = getQuotedMessage(message)
    if (!quotedMsg) return await react(message, emojis.error)

    try {
      // Extract feedback JID and stanza ID from the quoted message
      const quotedBody = getBody(quotedMsg)
      const splittedQB = quotedBody.split(' ')
      const feedbackJid = splittedQB[0].split('_')[0]
      const stanzaId = splittedQB[0].split('_')[1].split('\n')[0]

      // Retrieve the feedback message from the store
      const store = getStore()
      const chatMessages = store.messages[feedbackJid]
      const feedbackMsg = chatMessages?.get(stanzaId)

      if (!feedbackMsg) return await react(message, emojis.error)

      // Prepare the response message
      let response = getBodyWithoutCommand(body, command.needsPrefix, alias)
      response += `\n\n_Mensagem enviada pelo administrador ${message.pushName}._`

      // Send the response message
      await sendMessage({ text: response }, feedbackMsg)

      // React to the message with a success emoji
      return await react(message, getRandomItemFromArray(emojis.success))
    } catch {
      return await react(message, emojis.error)
    }
  }
}
