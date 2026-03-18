---
name: create_command
description: Creates a new command for the StickerBot WhatsApp bot.
---

# Instruction: Creating a new StickerBot Command

When asked to create a new command for StickerBot, follow these steps strictly to ensure the command is correctly hooked into the command processor (`src/handlers/text.ts`) and follows project standards.

## 1. File Location & Naming
- Commands must be placed inside the `src/commands/` directory.
- The file must be named according to the primary command alias (e.g., `ping.ts`, `sticker.ts`, `ban.ts`).
- It must export a `command` constant of type `StickerBotCommand`.

## 2. Command Structure (`StickerBotCommand`)
Your new file must match the following template exactly, pulling types from `src/types/Command.ts` and `src/types/Message.ts`.

```typescript
import path from 'path'
import { GroupMetadata } from '@whiskeysockets/baileys'

import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { checkCommand } from '../utils/commandValidator'
import { getLogger } from '../handlers/logger'
import { sendMessage, react } from '../utils/baileysHelper'
import { capitalize } from '../utils/misc'
import { emojis } from '../utils/emojis'

// Gets the logger
const logger = getLogger()

// Dynamic import resolution
const extension = __filename.endsWith('.js') ? '.js' : '.ts'
const commandName = capitalize(path.basename(__filename, extension))

export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['mycommand', 'alias2'], // All aliases the user can type to invoke the command
  desc: 'Describe what the command does here.',
  example: 'mycommand [param]', // Show how to use it, or undefined if no params
  needsPrefix: true, // Requires !, /, etc.
  inMaintenance: false, // Set to true to disable temporarily 
  runInPrivate: true, // Can run in private chats?
  runInGroups: true, // Can run in group chats?
  onlyInBotGroup: false, // Only in official bot groups?
  onlyBotAdmin: false, // Only for bot admins?
  onlyAdmin: false, // Only for group admins?
  onlyVip: false, // Only for VIPs?
  botMustBeAdmin: false, // Does the bot need group admin rights to perform this?
  interval: 5, // Cooldown in seconds
  limiter: {}, // DO NOT TOUCH
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
    // ALWAYS run the checkCommand first
    const check = await checkCommand(jid, message, alias, group, isBotAdmin, isVip, isGroupAdmin, amAdmin, command)
    if (!check) return

    // --- YOUR COMMAND LOGIC GOES HERE ---
    
    try {
      // 1. Process body parameters (all text after the command prefix and alias)
      const params = body.slice(command.needsPrefix ? 1 : 0).replace(new RegExp(`^${alias}\\s*`, 'i'), '').trim()

      // 2. Do something...
      await react(message, emojis.wait) // Example: react with a loading emoji

      // 3. Send response
      return await sendMessage({ text: 'Command executed successfully!' }, message)
      
    } catch (error) {
      logger.error(`Error in ${commandName}:`, error)
      return await react(message, emojis.error)
    }
  }
}
```

## 3. Important Utilities
Use the existing helper functions in `src/utils/baileysHelper.ts` instead of reinventing the wheel. Most useful helpers:
- `sendMessage(content, messageContext)`: Safely sends a text, image, format, etc.
- `react(message, emojiString)`: Adds a reaction directly to the sender's message.
- `getMentionedJids(message)`: Extracts mentioned tags for commands that target others.
- `getQuotedMessage(message)`: Returns the message that the user is quoting/replying to.
- `getPhoneFromJid(jid)`: Resolves proper phone strings, avoiding Baileys v7 LID/DDI formatting bugs.

## 4. Error Handling
- Do not let the bot crash on unexpected user input.
- Always wrap logic that could fail (like network requests to external APIs) in `try/catch` and log it using `logger.error()`.
- Return an error reaction (`emojis.error`) or an error message to the user when something goes wrong.

## 5. Verification
After creating the file, advise the user to:
1. Ensure `npx tsc --noEmit` runs completely clean with no type issues.
2. The dynamic file import in `src/handlers/text.ts` will automatically load any `.ts`/`.js` file inside `src/commands/`. The user just needs to start the bot.
