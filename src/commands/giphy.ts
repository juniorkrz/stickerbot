import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'
import { GiphySearch } from 'types/Giphy'

import { bot, giphySearch } from '../config'
import { getGiphys } from '../handlers/giphy'
import { makeSticker } from '../handlers/sticker'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { react, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { capitalize, getRandomItemFromArray, spintax } from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['giphy', 'giphys'],
  desc: 'Cria um sticker do tema solicitado via Giphy, cria vários se usar o comando no plural.',
  example: 'big bang theory',
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

    // multi stickers?
    const multiStickers = alias.endsWith('s')

    // get term
    const term = body
      .slice(command.needsPrefix ? 1 : 0)
      .replace(new RegExp(alias, 'i'), '')
      .trim()

    // if term not found, send a error message
    if (!term) return await sendMessage(
      {
        text: spintax(`⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, {para|pra} {utilizar|usar} o comando *${alias}* ` +
          '{você|vc|tu} {precisa|deve} {escrever|digitar} {um termo|algo} {após |depois d}o comando. {🧐|🫠|🥲|🙃|📝}')
      },
      message
    )

    // react wait
    await react(message, getRandomItemFromArray(emojis.wait))

    // search term
    const customSearch: GiphySearch = {
      ...giphySearch,
      q: term
    }

    const searchResult = await getGiphys(customSearch)

    // if no results, send a error message
    if (!searchResult || searchResult.length == 0) {
      await sendMessage(
        {
          text: spintax(
            `⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, não foram encontrados resultados para *${term}* ` +
            `no Giphy ${getRandomItemFromArray(emojis.confused)}`
          )
        },
        message
      )
      // react error
      return await react(message, emojis.error)
    }

    // randomize and limit results
    const stickers = searchResult.sort(() => 0.5 - Math.random()).slice(0, multiStickers ? bot.stickers : 1)

    // send stickers
    for (const sticker of stickers) {
      await makeSticker(
        message,
        {
          url: sticker
        }
      )
    }

    // react success
    return await react(message, getRandomItemFromArray(emojis.success))
  }
}
