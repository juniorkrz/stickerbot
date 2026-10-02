import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { getQuotedFromContext, relayViewOnce } from '../handlers/viewOnce'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { react, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { capitalize, spintax } from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['visualizar', 'view'],
  desc: 'Mostra a imagem/vídeo/áudio mais uma vez.',
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

    // get quoted message (key + content carried by the quote, if any)
    const quotedMsg = getQuotedFromContext(message)

    // if there is no quote, send an error message
    if (!quotedMsg) return await sendMessage(
      {
        text: spintax(
          `⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, {para|pra} {utilizar|usar} o comando *${alias}* ` +
          '{você|vc|tu} {deve|precisa} responder a uma imagem/vídeo/áudio de *visualização única* com o comando.'
        )
      },
      message
    )

    await react(message, '⏳')

    // resolve (quote, store or bot's phone), download and send
    const result = await relayViewOnce(quotedMsg, jid).catch(() => false)

    await react(message, result ? '✅' : '❌')

    // if something wrong, return an error message
    if (!result) return await sendMessage(
      {
        text: spintax(
          '⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, não {consegui|foi possível} {recuperar|obter} essa mensagem. ' +
          '{Verifique se|Confira se} {você|vc} respondeu a uma imagem/vídeo/áudio de *visualização única*.'
        )
      },
      message
    )
  }
}
