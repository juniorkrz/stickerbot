import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { bot } from '../config'
import { getActions } from '../handlers/text'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { capitalize, getRandomFile, getRandomItemFromArray, spintax } from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['vantagens', 'vantagem'],
  desc: 'Mostra as vantagens de ser um apoiador do bot.',
  example: undefined,
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
  onlyVip: false,
  botMustBeAdmin: false,
  interval: 30,
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

    const chosenPrefix = body.trim()[0]

    let menu = `*Vantagens exclusivas para apoiadores do ${bot.name}* 🤖\n\n`
    menu += `Digite *${chosenPrefix}pix* para saber como se tornar um apoiador.\n\n`
    menu += '* Limite de solicitações dobrado 🚀\n'
    menu += `* Tempo de espera reduzido pela metade ${getRandomItemFromArray(emojis.wait)}\n`
    menu += '* Adicionar o bot em um grupo (funciona apenas p/ apoiadores) 💥\n'
    menu += '* *{totalCommands}* comandos exclusivos. 👑\n\n'
    menu += `*${chosenPrefix}comando* - _Descrição_ (intervalo)\n\n`

    let totalCommands = 0
    const actions = getActions()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [key, action] of Object.entries(actions)) {
      if (!action.onlyVip) continue

      const prefix = action.needsPrefix ? chosenPrefix : ''
      const aliases = action.aliases
      const inMaintenance = action.inMaintenance ? ' - *(EM MANUTENÇÃO)*' : ''

      let line = ''
      line += `*${prefix}${aliases[0]}*${inMaintenance} - _${action.desc}_`
      const interval = (action.interval / 2)
      line += interval > 0
        ? ` (${interval.toString()}s)`
        : ''
      line += '\n\n'
      line += action.example ? `*Exemplo:* ${prefix}${aliases[0]} ${action.example}\n\n` : ''

      if (aliases.length > 1) {
        line += 'Comandos alternativos: <'
        line += aliases.slice(1).map(a => `${prefix}${a}`).join(' ') + ' '
        line = line.slice(0, -1)
        line += '>\n\n'
      }

      menu += line
      totalCommands++
    }

    menu = menu.slice(0, -2)
    menu = menu.replace('{totalCommands}', totalCommands.toString())

    const imgDir = path.resolve(__dirname, `../../src/img/${commandName.toLowerCase()}`)
    const randomImage = getRandomFile(imgDir)

    return await sendMessage(
      {
        image: {
          url: randomImage,
        },
        caption: spintax(menu)
      },
      message
    )
  }
}
