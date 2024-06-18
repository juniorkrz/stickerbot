import { GroupMetadata, WAMessage } from '@whiskeysockets/baileys'
import { getClient } from '../bot'
import { addCount } from './db'
import fs from 'fs'
import path from 'path'
import normalizeText from 'normalize-text'
import { hasValidPrefix } from '../utils/misc'
import { CommandActions } from '../types/Command'

// Directory where the commands are
const commandsDir = path.join(__dirname, '../commands')

// Dynamically load exported commands from each file in the 'commands' folder
const actions: CommandActions = {}

fs.readdirSync(commandsDir).forEach(file => {
    if (file.endsWith('.ts')) {
        const commandModule = require(path.join(commandsDir, file))
        actions[commandModule.command.name.toUpperCase()] = commandModule.command
    }
})

export const handleText = async (
    message: WAMessage,
    body: string,
    group: GroupMetadata | undefined,
    isBotAdmin: boolean,
    isGroupAdmin: boolean,
    amAdmin: boolean
): Promise<void> => {
    const client = getClient()

    // Mark all messages as read
    await client.readMessages([message.key])

    // Fix remote Jid - will never be empty
    const jid = message.key.remoteJid || ''

    // Get Action from Text
    const { alias, action } = await getTextAction(body)

    if (action && alias) {
        // Add to Statistics
        addCount(action)

        // Run command
        const command = actions[action.toUpperCase()]
        if (command) {
            console.log(`Sending ${command.name}`)
            await command.run(
                jid,
                message,
                alias,
                body,
                group,
                isBotAdmin,
                isGroupAdmin,
                amAdmin
            )
        }
    }
}

// Attempt to match a message body with an action
export const getTextAction = async (body: string): Promise<{ alias: string | undefined, action: string | undefined }> => {
    if (body) {
        body = normalizeText(body.toLowerCase()).trim()

        for (const [key, action] of Object.entries(actions)) {
            if (action.inMaintenance) continue

            for (const alias of action.aliases) {
                const normalizedAlias = normalizeText(alias.toLowerCase()).trim()

                const validPrefix = hasValidPrefix(body)

                // Checks whether the message starts with the normalized alias
                if (action.needsPrefix && !validPrefix) {
                    continue
                }

                // Extract prefix if present
                const prefix = action.needsPrefix && validPrefix ? body[0] : ''
                const messageWithoutPrefix = body.startsWith(prefix) ? body.slice(1).trim() : body

                // Checks if the message starts with the alias followed by a space or end of string
                if (messageWithoutPrefix === normalizedAlias || messageWithoutPrefix.startsWith(`${normalizedAlias} `)) {
                    return { alias: alias, action: action.name }// Returns the corresponding command and chosen alias
                }
            }
        }
    }

    return { alias: undefined, action: undefined }// Returns undefined if no match is found
}
