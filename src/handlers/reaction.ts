import {
  extractMessageContent,
  GroupMetadata,
  WAMessage
} from '@whiskeysockets/baileys'

import { getStore } from '../bot'
import { logAction, viewOnceMessageRelay } from '../utils/baileysHelper'
import { getLogger } from './logger'

const logger = getLogger()

export const handleReactionMessage = async (
  message: WAMessage,
  jid: string,
  group: GroupMetadata | undefined,
  sender: string,
  isBotAdmin: boolean,
  isVip: boolean
) => {
  if (!message.message?.reactionMessage) return

  try {
    if (message.message.reactionMessage.text == '👀') {
      // Allow only bot admins or vips
      if (isBotAdmin || isVip) {
        const store = getStore()
        const reactedMessageId = message.message?.reactionMessage?.key?.id
        const chatMessages = store.messages[message.key.remoteJid!]
        const reactedMessage = chatMessages?.get(reactedMessageId!)

        if (reactedMessage) {
          const reactedContent = extractMessageContent(reactedMessage.message)
          if (
            reactedContent?.imageMessage?.viewOnce ||
            reactedContent?.videoMessage?.viewOnce ||
            reactedContent?.audioMessage?.viewOnce
          ) {
            logAction(message, jid, group, 'View Once Message Relay')
            return await viewOnceMessageRelay(reactedMessage, reactedContent, sender)
          }
        }
      }
    }
  } catch (error) {
    if (error) {
      logger.error(`An error occurred while processing the reaction message: ${error}`)
    } else {
      logger.error('An error occurred while processing the reaction message: An unexpected error occurred')
    }
  }
}
