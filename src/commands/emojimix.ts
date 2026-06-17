import { GroupMetadata } from '@whiskeysockets/baileys'
import emojiRegex from 'emoji-regex'
import path from 'path'

import { getEmojiData, getEmojiUnicode, getSupportedEmoji, removeSkinTones } from '../handlers/emojiMix'
import { makeSticker } from '../handlers/sticker'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { capitalize, spintax } from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['emojimix', 'mix'],
  desc: 'Cria uma figurinha misturando dois emojis.',
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
  skipAds: true, // já conta via makeSticker
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

    const regex = emojiRegex()
    const emojis = body
      .slice(command.needsPrefix ? 1 : 0)
      .replace(new RegExp(alias, 'i'), '')
      .trim()
      .match(regex)
      ?.map(removeSkinTones)
      || []

    if (emojis.length !== 2) {
      const chosenPrefix = body.trim()[0]
      return await sendMessage(
        {
          text: spintax(`⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, {para|pra} {utilizar|usar} o comando *${alias}* ` +
                '{você|vc|tu} {precisa|deve} enviar *dois emojis* {após |depois d}o comando.\n\n' +
                `Exemplo: ${chosenPrefix}${alias} 🤖💜`)
        },
        message
      )
    }

    const supportedEmojis = getSupportedEmoji()
    const [leftEmoji, rightEmoji] = emojis
      .map(e => getEmojiUnicode(e))

    const supportLeftEmoji = supportedEmojis.includes(leftEmoji)
    const supportRightEmoji = supportedEmojis.includes(rightEmoji)

    if (!supportLeftEmoji || !supportRightEmoji) {
      const errorMsg = !supportLeftEmoji
        ? `${emojis[0]} não é válido para a união.`
        : !supportRightEmoji
          ? `${emojis[1]} não é válido para a união.`
          : 'os emojis não são compatíveis para união.'
      return await sendMessage(
        {
          text: spintax(`⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, ${errorMsg}`)
        },
        message
      )
    }

    if (!leftEmoji || !rightEmoji) return await sendMessage(
      {
        text: spintax('⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, os emojis não são compatíveis para união.')
      },
      message
    )

    const leftEmojiData = getEmojiData(leftEmoji)
    const rightEmojiData = getEmojiData(rightEmoji)

    const mergedEmoji = leftEmojiData.combinations[
      rightEmojiData.emojiCodepoint
    ]?.filter((c) => c.isLatest)[0]

    if (mergedEmoji) return await makeSticker(message, { url: mergedEmoji.gStaticUrl })

    return await sendMessage(
      {
        text: spintax('⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, os emojis não são compatíveis para união.')
      },
      message
    )
  }
}
