/* Comando base - StickerBot */

import { checkCommand } from '../utils/commandValidator';
import { StickerBotCommand } from '../types/Command';
import { WAMessageExtended } from '../types/Message';
import { makeSticker, sendMessage } from '../utils/baileysHelper';
import { capitalize, spintax } from '../utils/misc';
import path from 'path';
import { GroupMetadata } from '@whiskeysockets/baileys';

// Obtém o nome do arquivo sem a extensão .ts
const commandName = capitalize(path.basename(__filename, '.ts'));

// Configurações do comando:
export const command: StickerBotCommand = {
    name: commandName,
    aliases: ['ttp'], // * Comando alias para a função de sticker sem animação
    desc: 'Cria uma figurinha com o texto fornecido.', // * Descrição do comando
    example: '!ttp olá', // Exemplo de como usar o comando
    needsPrefix: true,
    inMaintenance: false,
    runInPrivate: true,
    runInGroups: true,
    onlyInBotGroup: false,
    onlyBotAdmin: false,
    onlyAdmin: false,
    botMustBeAdmin: false,
    interval: 5,
    limiter: {},
    run: async (
        jid: string,
        message: WAMessageExtended,
        alias: string,
        body: string,
        group: GroupMetadata | undefined,
        isBotAdmin: boolean,
        isGroupAdmin: boolean,
        amAdmin: boolean
    ) => {
        // Não modifique
        const check = await checkCommand(jid, message, alias, group, isBotAdmin, isGroupAdmin, amAdmin, command);
        if (!check) {
            return;
        }

        const maxChars = 200;
        const trimmedBody = body.slice(command.needsPrefix ? 1 : 0).replace(alias, '').trim();

        if (!trimmedBody) {
            return await sendMessage({ text: spintax(`Nenhum texto fornecido para o comando ${alias}.`) }, message);
        } else if (trimmedBody.length > maxChars) {
            return await sendMessage({ text: spintax(`O texto fornecido é muito longo. O máximo permitido é de ${maxChars} caracteres.`) }, message);
        }

        try {
            const url = `https://ttp.jrkrz.online/ttp?text=${encodeURIComponent(trimmedBody)}`; 
            return await makeSticker(message, false, undefined, url);
        } catch (error) {
            console.error('Erro ao acessar o serviço externo:', error);
            return await sendMessage({ text: spintax('Erro ao acessar o serviço externo.') }, message);
        }
    }
};
