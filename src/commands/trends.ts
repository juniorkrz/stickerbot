import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { bot } from '../config'
import { makeSticker } from '../handlers/sticker'
import { getStickerLyTrendings } from '../handlers/stickerly'
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
  aliases: ['trends'],
  desc: 'Envia trending stickers do Stickerly.',
  example: undefined,
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
  onlyVip: true,
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

    // react wait
    await react(message, getRandomItemFromArray(emojis.wait))

    // search trend stickers
    const searchResult = await getStickerLyTrendings()

    // if no results, send a error message
    if (!searchResult) {
      await sendMessage(
        {
          text: spintax('⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, não foram encontrados trending stickers no Stickerly.')
        },
        message
      )
      // react error
      return await react(message, emojis.error)
    }

    // randomize and limit results
    const stickers = searchResult.sort(() => 0.5 - Math.random()).slice(0, bot.stickers)

    // send stickers
    for (const sticker of stickers) {
      await makeSticker(
        message,
        {
          url: sticker.resourceUrl,
          customMeta: {
            author: sticker.authorName,
            pack: sticker.packName
          }
        }
      )
    }

    // react success
    return await react(message, getRandomItemFromArray(emojis.success))
  }
}
