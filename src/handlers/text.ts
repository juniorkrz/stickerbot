import { GroupMetadata, proto, WAMessage } from '@whiskeysockets/baileys'
import fs from 'fs'
import { normalizeText } from 'normalize-text'
import path from 'path'

import { getClient } from '../bot'
import { CommandActions } from '../types/Command'
import { logAction } from '../utils/baileysHelper'
import { hasValidPrefix } from '../utils/misc'
import { handleSenderParticipation } from './community'
import { handleLimitedSender } from './senderUsage'

// Directory where the commands are
const commandsDir = path.join(__dirname, '../commands')

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Dynamically load exported commands from each file in the 'commands' folder
export const actions: CommandActions = {}

fs.readdirSync(commandsDir).forEach(file => {
  if (file.endsWith(extension)) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const commandModule = require(path.join(commandsDir, file))
    actions[commandModule.command.name.toUpperCase()] = commandModule.command
  }
})

export const getActions = () => {
  return actions
}

export const getTotalCommandsLoaded = () => {
  return Object.keys(actions).length
}

export const handleText = async (
  message: WAMessage,
  sender: string,
  body: string,
  group: GroupMetadata | undefined,
  isBotAdmin: boolean,
  isVip: boolean,
  isGroupAdmin: boolean,
  amAdmin: boolean
): Promise<proto.WebMessageInfo | undefined> => {
  const client = getClient()

  // Mark all messages as read
  await client.readMessages([message.key])

  // Fix remote Jid - will never be empty
  const jid = message.key.remoteJid || ''

  // Get Action from Text
  const { alias, action } = await getTextAction(body)

  if (action && alias) {
    // If sender is rate limited, do nothing
    const isSenderRateLimited = await handleLimitedSender(message, jid, group, sender)
    if (isSenderRateLimited) return

    // If the sender is not a member of the community, do nothing (only if SB_FORCE_COMMUNITY is true)
    const isCmmMember = isVip || await handleSenderParticipation(message, jid, group, sender)
    if (!isCmmMember) return

    // Add to Statistics
    logAction(message, jid, group, action)

    // Run command
    const command = actions[action.toUpperCase()]
    return await command.run(
      jid,
      sender,
      message,
      alias,
      body,
      group,
      isBotAdmin,
      isVip,
      isGroupAdmin,
      amAdmin
    )
  }
}

// Attempt to match a message body with an action
export const getTextAction = async (
  body: string
): Promise<{ alias: string | undefined, action: string | undefined }> => {
  if (body) {
    body = normalizeText(body.toLowerCase()).trim()

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [key, action] of Object.entries(actions)) {
      for (const alias of action.aliases) {
        const normalizedAlias = normalizeText(alias.toLowerCase()).trim()

        const validPrefix = hasValidPrefix(body)

        // Checks whether the message starts with the normalized alias
        if (action.needsPrefix && !validPrefix) {
          continue
        }

        // Extract prefix if present
        const prefix = action.needsPrefix && validPrefix ? body[0] : ''
        const messageWithoutPrefix = body.startsWith(prefix) && action.needsPrefix ? body.slice(1).trim() : body
        // Checks if the message starts with the alias followed by a space or end of string
        if (messageWithoutPrefix === normalizedAlias || messageWithoutPrefix.startsWith(`${normalizedAlias} `)) {
          return {
            alias: alias,
            action: action.name
          }// Returns the corresponding command and chosen alias
        }
      }
    }
  }

  return {
    alias: undefined,
    action: undefined
  }// Returns undefined if no match is found
}
