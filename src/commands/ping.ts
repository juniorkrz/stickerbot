/* Comando base - StickerBot */
import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { bot } from '../config'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { react, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { capitalize, spintax } from '../utils/misc'
//import { getClient } from '../bot'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Configurações do comando:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['ping'], // * Tudo que estiver aqui será aceito como comando, precisa ser um array com no mínimo um comando.
  desc: 'Verifica o tempo de resposta do bot.', // * Descrição do comando, será exibido no menu.
  example: false, // Exemplo do comando, deve ser uma string ou false
  needsPrefix: true, // O comando precisa de um prefixo para ser executado?
  inMaintenance: false, // O comando está em manutenção?
  runInPrivate: true, // O comando deve funcionar nos privados?
  runInGroups: true, // O comando deve funcionar em qualquer grupo?
  onlyInBotGroup: false, // O comando deve funcionar apenas nos grupos oficiais do bot?
  onlyBotAdmin: false, // O comando deve funcionar apenas para administradores do bot?
  onlyAdmin: false, // O comando deve funcionar apenas para administradores do grupo?
  botMustBeAdmin: false, // O bot precisa ser administrador do grupo para executar o comando?
  interval: 5, // Intervalo para executar esse comando novamente (em segundos)
  limiter: {}, // Não mecha nisso!
  run: async (
    jid: string, // ID do chat
    sender: string,// JID do sender
    message: WAMessageExtended, // Mensagem (WAMessage)
    alias: string, // O alias que o usuário escolheu
    body: string, // Corpo da mensagem
    group: GroupMetadata | undefined, // Informações do grupo | Será undefined caso não seja um grupo
    isBotAdmin: boolean, // É um administrador do bot?
    isGroupAdmin: boolean, // É um administrador do grupo?
    amAdmin: boolean// O bot é admin no grupo?
  ) => {
    // Não modifique
    const check = await checkCommand(jid, message, alias, group, isBotAdmin, isGroupAdmin, amAdmin, command)
    if (!check) {
      return
    }

    // Sinta-se livre para criar seu comando abaixo.
    // Tipo de retorno: Promise<proto.WebMessageInfo | undefined

    // Como importar o client:

    // Remova o comentário do getClient no inicio desse arquivo
    // Use:
    // const client = getClient()

    // Exemplos do Baileys:
    // https://github.com/WhiskeySockets/Baileys
    // https://github.com/WhiskeySockets/Baileys/blob/master/Example/example.ts


    // Responde 'Pong' e reage a mensagem:

    const time = <number>message.messageLocalTimestamp
    const ms = Date.now() - time

    // Mensagem a ser enviada
    const responseMsg = `Pong! 🏓\n\n⏱ Tempo de resposta do {${bot.name}|bot} foi de *${ms}ms*.`

    const quote = true// true: envia a mensagem como resposta | false: envia a mensagem normal

    await sendMessage(
      { text: spintax(responseMsg) },
      message,
      quote
    )

    return await react(message, '🏓')
  }
}
