/* Comando base - StickerBot */

import { checkCommand } from '../utils/commandValidator'
import { bot } from '../config'// Fix: remover importação não utilizada: bot
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { makeSticker, react, sendMessage } from '../utils/baileysHelper'// Fix: remover importação não utilizada: react
import { capitalize, spintax } from '../utils/misc'
import path from 'path'
import { GroupMetadata } from '@whiskeysockets/baileys'

/* Suas importações aqui */

// Faça suas importações aqui, caso você necessite.
// Exemplo:
// import { getClient } from '../bot'

// Esse comando não usa o client diretamente, então vamos manter comentado.

/* Fim das suas importações */


// Obtém o nome do arquivo sem a extensão .ts
const commandName = capitalize(path.basename(__filename, '.ts'))

// Configurações do comando:
export const command: StickerBotCommand = {
    name: commandName,
    aliases: ['attp'],// * Tudo que estiver aqui será aceito como comando, precisa ser um array com no mínimo um comando.
    desc: 'Cria uma figurinha com o texto após o comando.',// * Descrição do comando, será exibido no menu.
    example: '!attp Olá',// Exemplo do comando, deve ser uma string ou false
    needsPrefix: true,// O comando precisa de um prefixo para ser executado?
    inMaintenance: false,// O comando está em manutenção?
    runInPrivate: true,// O comando deve funcionar nos privados?
    runInGroups: true,// O comando deve funcionar em qualquer grupo?
    onlyInBotGroup: false,// O comando deve funcionar apenas nos grupos oficiais do bot?
    onlyBotAdmin: false,// O comando deve funcionar apenas para administradores do bot?
    onlyAdmin: false,// O comando deve funcionar apenas para administradores do grupo?
    botMustBeAdmin: false,// O bot precisa ser administrador do grupo para executar o comando?
    interval: 5,// Intervalo para executar esse comando novamente (em segundos)
    limiter: {},// Não mecha nisso!
    run: async (
        jid: string,// ID do chat
        message: WAMessageExtended,// Mensagem (WAMessage)
        alias: string,// O alias que o usuário escolheu
        // Fix: Esse 'body' aqui que você deve usar abaixo no lugar do getBody.
        body: string,// Corpo da mensagem
        group: GroupMetadata | undefined,// Informações do grupo | Será undefined caso não seja um grupo
        isBotAdmin: boolean,// É um administrador do bot?
        isGroupAdmin: boolean,// É um administrador do grupo?
        amAdmin: boolean// O bot é admin no grupo?
    ) => {
        // Não modifique
        const check = await checkCommand(jid, message, alias, group, isBotAdmin, isGroupAdmin, amAdmin, command)
        if (!check) {
            return;
        }

        // Fix: Remover esses comentários do ping.ts
        // Sinta-se livre para criar seu comando abaixo.
        // retorne um true se ele foi executado com sucesso, false se algo não saiu como esperado.

        // Como importar o client:

        // Remova o comentário do getClient no inicio desse arquivo
        // Use:
        // const client = getClient()

        // Exemplos do Baileys:
        // https://github.com/WhiskeySockets/Baileys
        // https://github.com/WhiskeySockets/Baileys/blob/master/Example/example.ts


        const maxChars = 200;
        // Fix: Substituir getBody(message) por `body`
        const prefix = body.trim()[0];
        // Fix: Apagar a linha 82 e substituir commandAliase por alias nas próximas linhas.
        // (a nova versão recebe por parametro la em cima, então isso aqui se torna desnecessário)

        // Fix: Substituir getBody(message) por `body`
        // ex: const trimmedBody = body.slice(command.needsPrefix ? 1 : 0).replace(alias, '').trim();
        const trimmedBody = body.slice(command.needsPrefix ? 1 : 0).replace(alias, '').trim();

        if (!trimmedBody) {
            // Fix: Utilizar o sendMessage ao invés do sendReply
            // Ex:
            return await sendMessage({ text: spintax(`Nenhum texto fornecido para o comando ${alias}.`) }, message,)
        } else if (trimmedBody.length > maxChars) {
            await sendMessage({text: spintax(`O texto fornecido é muito longo. O máximo permitido é de ${maxChars} caracteres.`)}, message,);
            return;
        }

        try {
            const url = `https://ttp.jrkrz.online/attp?text=${encodeURIComponent(trimmedBody)}`;
            await makeSticker(message, false, undefined, url);
            return;
        } catch (error) {
            console.error('Erro ao acessar o serviço externo:', error);
            await sendMessage({text: spintax('Erro ao acessar o serviço externo.')}, message,);
            return;
        }
    }
};

