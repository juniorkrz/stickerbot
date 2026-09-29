import { GroupMetadata, proto, WAMessage } from '@whiskeysockets/baileys'
import fs from 'fs'
import { normalizeText } from 'normalize-text'
import path from 'path'

import { getClient } from '../bot'
import { CommandActions, StickerBotCommand } from '../types/Command'
import { logAction } from '../utils/baileysHelper'
import { hasValidPrefix } from '../utils/misc'
import { handleSenderParticipation } from './community'
import { handleLimitedSender } from './senderUsage'

// Directory where the commands are
const commandsDir = path.join(__dirname, '../commands')

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Dynamically load exported commands from each file in the 'commands' folder
// allCommands keeps every command (even disabled ones) so the panel can enable them at runtime;
// actions only holds the enabled ones and is what the bot matches against.
export const actions: CommandActions = {}
export const allCommands: CommandActions = {}

// Fields of a command that the panel can override (persisted in the Settings table as cmd.<NAME>)
export const editableCommandFields = [
  'aliases', 'desc', 'example', 'needsPrefix', 'inMaintenance', 'runInPrivate', 'runInGroups',
  'onlyInBotGroup', 'onlyBotAdmin', 'onlyAdmin', 'onlyVip', 'botMustBeAdmin', 'interval', 'skipAds', 'disabled'
] as const
export type EditableCommandField = typeof editableCommandFields[number]
export type CommandOverride = Partial<Pick<StickerBotCommand, EditableCommandField>>

// Defaults as written in the code, to allow resetting an override
const commandDefaults: { [name: string]: CommandOverride } = {}

fs.readdirSync(commandsDir).forEach(file => {
  if (file.endsWith(extension)) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const commandModule = require(path.join(commandsDir, file))
    const command: StickerBotCommand = commandModule.command
    const key = command.name.toUpperCase()
    allCommands[key] = command
    const defaults: CommandOverride = {}
    for (const field of editableCommandFields) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (defaults as any)[field] = Array.isArray(command[field]) ? [...(command[field] as string[])] : command[field]
    }
    defaults.disabled = !!command.disabled
    commandDefaults[key] = defaults
  }
})

// Rebuilds the enabled commands map, keeping the same object reference
const rebuildActions = () => {
  for (const key of Object.keys(actions)) delete actions[key]
  for (const [key, command] of Object.entries(allCommands)) {
    if (!command.disabled) actions[key] = command
  }
}
rebuildActions()

export const getCommandDefaults = (name: string): CommandOverride | undefined => commandDefaults[name.toUpperCase()]

// Applies an override on top of the code defaults (undefined override = back to defaults)
export const applyCommandOverride = (name: string, override: CommandOverride | undefined) => {
  const key = name.toUpperCase()
  const command = allCommands[key]
  if (!command) return
  const merged = { ...commandDefaults[key],
    ...(override || {}) }
  Object.assign(command, merged)
  rebuildActions()
}

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
): Promise<WAMessage | undefined> => {
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
