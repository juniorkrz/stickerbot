import { GroupMetadata, WAMessage } from "@whiskeysockets/baileys";
import { getClient } from "../bot";
import { addCount } from "./db";
import { sendMessage } from "../utils/baileysHelper";
import fs from 'fs';
import path from 'path';
import normalizeText from 'normalize-text';

// Diretório onde estão os comandos
const commandsDir = path.join(__dirname, '../commands');

// Carrega dinamicamente os comandos exportados de cada arquivo na pasta 'commands'
const actions: { [key: string]: any } = {}; // Defina o tipo apropriado para suas ações

fs.readdirSync(commandsDir).forEach(file => {
    if (file.endsWith('.ts')) {
        const commandModule = require(path.join(commandsDir, file));
        actions[commandModule.command.name.toUpperCase()] = commandModule.command;
    }
});



export const handleText = async (
    message: WAMessage,
    body: string,
    group: GroupMetadata | undefined,
    isOwner: boolean,
    isAdmin: boolean,
    amAdmin: boolean
): Promise<void> => {
    const client = getClient()
    // Mark all messages as read
    await client.readMessages([message.key])

    // Fix remote Jid - will never be empty
    const jid = message.key.remoteJid || ''

    // Get Action from Text
    const { alias, action } = await getTextAction(body)

    if (action) {
        // Add to Statistics
        addCount(action);

        // Run command
        const command = actions[action.toUpperCase()];
        if (command) {
            await command.run(message, alias);
        }
    }
}

// Attempt to match a message body with an action
export const getTextAction = async (message: string): Promise<{ alias: string | undefined, action: string | undefined }> => {
    if (message) {
        message = normalizeText(message.toLowerCase())

        for (const [key, action] of Object.entries(actions)) {
            if (action.inMaintenance) continue

            for (const alias of action.aliases) {
                const normalizedAlias = normalizeText(alias.toLowerCase())

                // Verifica se a mensagem contém o alias normalizado
                if (message.includes(normalizedAlias)) {
                    return { alias: alias, action: key } // Retorna a chave da ação correspondente
                }
            }
        }
    }

    return { alias: undefined, action: undefined } // Retorna undefined se nenhuma correspondência for encontrada
}
