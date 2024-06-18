/* Comando base - StickerBot */

import { checkCommand } from "../utils/validators";
import { bot } from "../config";
import { StickerBotCommand } from "../types/Command";
import { WAMessageExtended } from "../types/Message";
import { react, sendMessage } from "../utils/baileysHelper"
import { spinText } from "../utils/misc";
import path from "path"

/* Suas importações aqui */

// Faça suas importações aqui, caso você necessite.
// Exemplo:
// import { getClient } from "../bot"

// Esse comando não usa o client diretamente, então vamos manter comentado.

/* Fim das suas importações */


// Obtém o nome do arquivo sem a extensão .ts
const commandName = path.basename(__filename, '.ts');

// Configurações do comando:
export const command: StickerBotCommand = {
    name: commandName,
    aliases: ["ping"],// * Tudo que estiver aqui será aceito como comando, precisa ser um array com no mínimo um comando.
    desc: "Verifica o tempo de resposta do bot.",// * Descrição do comando, será exibido no menu.
    example: false,// Exemplo do comando, deve ser uma string ou false
    needsPrefix: true,// O comando precisa de um prefixo para ser executado?
    inMaintenance: false,// O comando está em manutenção?
    runInPrivate: true,// O comando deve funcionar nos privados?
    runInGroups: true,// O comando deve funcionar em qualquer grupo?
    onlyInBotGroup: false,// O comando deve funcionar apenas nos grupos oficiais do bot?
    onlyBotAdmin: false,// O comando deve funcionar apenas para administradores do bot?
    onlyAdmin: false,// O comando deve funcionar apenas para administradores do grupo?
    botMustBeAdmin: false,// O bot precisa ser administrador do grupo para executar o comando?
    interval: 5,// Intervalo para executar esse comando novamente (em segundos)
    limiter: {}, // Não mecha nisso!
    run: async (message: WAMessageExtended, alias: string) => {
        // Não modifique
        const check = await checkCommand(message, command);
        if (!check) {
            return false;
        }

        console.log(`Sending ${command.name}`);

        // Sinta-se livre para criar seu comando abaixo.
        // retorne um true se ele foi executado com sucesso, false se algo não saiu como esperado.

        // Como importar o client

        // Remova o comentário do getClient no inicio desse arquivo
        // Use:
        // const client = getClient()

        // Exemplos do Baileys:
        // https://github.com/WhiskeySockets/Baileys/blob/master/Example/example.ts


        // Responde 'Pong' e reage a mensagem:

        const time = <number>message.messageLocalTimestamp
        const ms = Date.now() - time

        await sendMessage(
            { text: spinText(`Pong! 🏓\n\n⏱ Tempo de resposta do {${bot.name}|bot} foi de *${ms}ms*.`) },
            message,
        );

        return await react(message, '🏓');
    }
};
