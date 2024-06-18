import { checkCommand } from '../utils/validators'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { sendMessage } from '../utils/baileysHelper'
import path from 'path'

// Gets the file name without the .ts extension
const commandName = path.basename(__filename, '.ts')

// Command settings:
export const command: StickerBotCommand = {
    name: commandName,
    aliases: ['jid'],
    desc: 'Informa o JID do chat.',
    example: false,
    needsPrefix: true,
    inMaintenance: false,
    runInPrivate: true,
    runInGroups: true,
    onlyInBotGroup: false,
    onlyBotAdmin: true,
    onlyAdmin: false,
    botMustBeAdmin: false,
    interval: 0,
    limiter: {},// do not touch this
    run: async (message: WAMessageExtended, alias: string) => {
        const check = await checkCommand(message, command)
        if (!check) {
            return false
        }

        console.log(`Sending ${command.name}`)

        // Send chat JID

        const jid = message.key.remoteJid
        return await sendMessage(
            { text: jid ? jid : 'Desconhecido' },
            message,
        )
    }
}
