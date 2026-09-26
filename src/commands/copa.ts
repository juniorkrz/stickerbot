import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import {
  buildPalpite,
  findMatchByQuery,
  palpiteTarget,
  renderAll,
  renderCurrent,
  renderNext
} from '../handlers/copa'
import { getLogger } from '../handlers/logger'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { react, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { capitalize } from '../utils/misc'

// Gets the logger
const logger = getLogger()

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Short aliases that map straight to a subcommand (e.g. !proximo === !copa proximo)
const SHORTCUTS = ['jogos', 'proximos', 'proximo', 'palpite']

const usage = '⚽ *Copa do Mundo 2026*\n\n' +
  '`!copa` - jogo de agora + próximo\n' +
  '`!copa jogos` - tabela completa\n' +
  '`!copa proximos` - próximos jogos\n' +
  '`!copa proximo` - jogo atual + próximo\n' +
  '`!copa palpite` - palpite do jogo de agora/próximo\n' +
  '`!copa palpite <seleção>` - palpite de um jogo (ex.: `!copa palpite brasil`)\n\n' +
  '_Atalhos:_ `!jogos` `!proximos` `!proximo` `!palpite`'

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['copa', 'mundial', 'worldcup', ...SHORTCUTS],
  desc: 'Jogos, placares ao vivo, próximos jogos e palpites da Copa do Mundo 2026.',
  example: 'proximo',
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
  onlyVip: false,
  botMustBeAdmin: false,
  interval: 0,
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

    const params = body
      .slice(command.needsPrefix ? 1 : 0)
      .replace(new RegExp(`^${alias}\\s*`, 'i'), '')

    const aliasLower = alias.toLowerCase()
    let sub: string
    let argText: string
    if (SHORTCUTS.includes(aliasLower)) {
      sub = aliasLower
      argText = params.trim()
    } else {
      const parsed = params.match(/^(\S+)\s*([\s\S]*)$/)
      sub = (parsed?.[1] || '').toLowerCase()
      argText = (parsed?.[2] || '').trim()
    }

    try {
      // Predictions: a requested team (by name/code) or the live/next match
      if (['palpite', 'palpitar', 'chute', 'chutar'].includes(sub)) {
        const match = argText ? await findMatchByQuery(argText) : await palpiteTarget()
        if (!match) {
          return await sendMessage(
            {
              text: argText
                ? `⚠ Não achei jogo da Copa pra *${argText}*.`
                : '⚽ Nenhum jogo ao vivo ou agendado pra palpitar agora.'
            },
            message
          )
        }
        return await sendMessage({ text: buildPalpite(match) }, message)
      }

      // Full schedule
      if (['jogos', 'tabela', 'todos', 'todas', 'all'].includes(sub)) {
        return await sendMessage({ text: await renderAll() }, message)
      }

      // Upcoming matches
      if (['proximos', 'próximos', 'next'].includes(sub)) {
        return await sendMessage({ text: await renderNext() }, message)
      }

      // Live + next (also the bare !copa default)
      if (sub === '' || ['proximo', 'próximo', 'atual', 'agora', 'now'].includes(sub)) {
        const text = await renderCurrent()
        const footer = sub === '' ? '\n\n_Veja_ `!copa jogos` _ou_ `!copa palpite`' : ''
        return await sendMessage({ text: text + footer }, message)
      }

      // Unknown subcommand
      return await sendMessage({ text: usage }, message)
    } catch (error) {
      logger.error(`Error in ${commandName}: ${error}`)
      await react(message, emojis.error)
      return await sendMessage({ text: '⚠ Não consegui buscar os dados da Copa agora. Tente de novo em instantes.' }, message)
    }
  }
}
