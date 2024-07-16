import { GroupMetadata } from '@whiskeysockets/baileys'
import { compare } from 'compare-versions'
import path from 'path'

import { bot } from '../config'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import {
  capitalize,
  getProjectLatestVersion,
  getProjectLocalVersion,
  spintax
} from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['versao', 'version', 'sobre', 'about'],
  desc: 'Mostra a versão atual do bot.',
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

    const latestVersion = await getProjectLatestVersion()
    const localVersion = await getProjectLocalVersion()
    const homepage = 'https://github.com/juniorkrz/stickerbot'

    let response
    if (latestVersion.version && localVersion) {

      const isUpdated = compare(localVersion, latestVersion.version, '=')
      response = isUpdated
        ? `🤖 *O ${bot.name} está atualizado!* ✅\n\n` +
        `⚙ *Versão atual:* ${latestVersion.version}\n{🐙|😼} ` +
        `*GitHub:* ${homepage}\n👨🏻‍💻 *Desenvolvedor:* @juniorkrz.dev`
        : `🤖 *O ${bot.name} está desatualizado!* ❌\n\n` +
        `⚙ *Versão atual:* ${localVersion}\n🆕 ` +
        `*Nova versão disponível:* ${latestVersion.version}\n{🐙|😼} ` +
        `*GitHub:* ${homepage}\n👨🏻‍💻 *Desenvolvedor:* @juniorkrz.dev`
    } else {
      response = `🤖 *{Ei|Ops|Opa|Desculpe|Foi mal}, não foi possível verificar se o ${bot.name} está atualizado! ` +
        `{🧐|🫠|🥲|🙃|❌}* ❌\n\n{🐙|😼} *GitHub:* ${homepage}\n👨🏻‍💻 *Desenvolvedor:* @juniorkrz.dev`
    }

    return await sendMessage(
      { text: spintax(response) },
      message
    )
  }
}
