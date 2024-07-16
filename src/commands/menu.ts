import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { bot } from '../config'
import { getActions } from '../handlers/text'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { capitalize, getRandomFile, spintax } from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['menu', 'comando'],
  desc: 'Mostra o menu de comandos do bot.',
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

    let menu = `*${bot.name} Menu* 🤖\n\n`
    menu += `Atualmente o ${bot.name} possui *{totalCommands}* comandos.\n\n`
    menu += `*${chosenPrefix}comando* - _Descrição_ (intervalo)\n\n`

    const sections = {
      'commandsForAdmins': {
        title: 'comandos para admins',
        commands: [] as string[]
      },
      'commandsForGroups': {
        title: 'comandos para grupos',
        commands: [] as string[]
      },
      'generalCommands': {
        title: 'comandos gerais',
        commands: [] as string[]
      }
    }

    const actions = getActions()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [key, action] of Object.entries(actions)) {
      const prefix = action.needsPrefix ? chosenPrefix : ''
      const aliases = action.aliases
      const inMaintenance = action.inMaintenance ? ' - *(EM MANUTENÇÃO)*' : ''

      let line = ''
      line += `*${prefix}${aliases[0]}*${inMaintenance} - _${action.desc}_`
      line += action.interval > 0
        ? ` (${action.interval.toString()}s)`
        : ''
      line += '\n\n'
      line += action.example ? `*Exemplo:* ${prefix}${aliases[0]} ${action.example}\n\n` : ''

      if (aliases.length > 1) {
        line += 'Comandos alternativos: <'
        line += aliases.slice(1).map(a => `${prefix}${a}`).join(' ') + ' '
        line = line.slice(0, -1)
        line += '>\n\n'
      }

      if (action.onlyBotAdmin && isBotAdmin && !group) {
        sections['commandsForAdmins'].commands.push(line)
      } else if (action.runInGroups && !action.runInPrivate) {
        sections['commandsForGroups'].commands.push(line)
      } else if (!action.onlyBotAdmin) {
        sections['generalCommands'].commands.push(line)
      }
    }

    let totalCommands = 0

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [_, section] of Object.entries(sections)) {
      const sectionTitle = section.title
      const sectionCommands = section.commands
      if (sectionCommands.length > 0) {
        totalCommands += sectionCommands.length
        menu += `*${sectionTitle.toUpperCase()}:*\n\n`
        menu += sectionCommands.join('') || `Não foram encontrados ${sectionTitle.toLowerCase()}.\n\n`
      }
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
