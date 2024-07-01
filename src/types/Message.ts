import { WAMessage } from '@whiskeysockets/baileys'

export interface WAMessageExtended extends WAMessage {
  /** WAMessageExtended messageLocalTimestamp */
  messageLocalTimestamp?: (number | null)
}
