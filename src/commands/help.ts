import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { getActions } from '../handlers/text'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { capitalize, getRandomItemFromArray, removeValue, spintax } from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['ajuda', 'help'],
  desc: 'Explica como utilizar os comandos do bot.',
  example: 'ping',
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
  onlyVip: false,
  botMustBeAdmin: false,
  interval: 5,
  limiter: {}, // do not touch this
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
    const check = await checkCommand(jid, message, alias, group, isBotAdmin, isVip, isGroupAdmin, amAdmin, command)
    if (!check) return

    const actions = getActions()

    const chosenPrefix = command.needsPrefix ? body.trim()[0] : ''
    const chosenCommand = body
      .slice(command.needsPrefix ? 1 : 0)
      .replace(new RegExp(alias, 'i'), '')
      .trim()
      .toLowerCase()

    if (!chosenCommand) return await sendMessage(
      {
        text: spintax(
          '⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, você precisa digitar o nome do comando ' +
          `que deseja receber ajuda após o comando. Ex: ${chosenPrefix}${command.aliases[0]} ping`
        )
      },
      message
    )

    // adicione a seguinte verificação: Se, action.onlyBotAdmin && !isBotAdmin, continue...
    const actionEntry = Object.entries(actions)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .find(([_, action]) => action.aliases.includes(chosenCommand) && (!action.onlyBotAdmin || isBotAdmin))

    const action = actionEntry ? actionEntry[1] : undefined

    if (!action) return await sendMessage(
      {
        text: spintax(
          '⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, o comando escolhido não existe. ' +
          `Por favor, verifique se digitou corretamente, confira os comandos existentes no ${chosenPrefix}menu.`
        )
      },
      message
    )

    let response = ''

    if (action.desc) {
      response += `O comando *${chosenCommand}* ${action.desc?.charAt(0).toLowerCase() + action.desc.slice(1)}\n\n`
    }

    if (action.example) {
      response += `*Exemplo de uso:* ${action.needsPrefix ? chosenPrefix : ''}` +
        `${chosenCommand} ${action.example}\n\n`
    }

    const tempAliases = action.aliases.slice()
    const aliases = removeValue(tempAliases, chosenCommand)
    if (aliases.length > 0) {
      response += 'Ele possui os seguintes comandos alternativos: \n\n'
      response += aliases.map(a => `${action.needsPrefix ? chosenPrefix : ''}${a}`).join('\n') + '\n\n'
    } else {
      response += 'Ele *não* possui comandos alternativos.\n\n'
    }

    if (action.runInGroups && !action.runInPrivate) {
      response += 'Esse comando funciona apenas em *grupos*!\n\n'
    } else if (!action.runInGroups && action.runInPrivate) {
      response += 'Esse comando funciona apenas no *privado do bot*!\n\n'
    }

    if (!action.needsPrefix) {
      response += 'Esse comando *NÃO* precisa de um prefixo!\n\n'
    }

    if (action.interval > 0) {
      response += `${getRandomItemFromArray(emojis.wait)} ` +
        `Você só consegue usar o comando uma vez a cada ${action.interval.toString()} segundos.\n\n`
    }

    response = response.slice(0, -2)

    return await sendMessage(
      { text: spintax(response) },
      message
    )
  }
}
