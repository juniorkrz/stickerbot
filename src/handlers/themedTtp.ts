import { WAMessage } from '@whiskeysockets/baileys'

import { stickerMeta } from '../config'
import { react, sendMessage } from '../utils/baileysHelper'
import { emojis } from '../utils/emojis'
import { spintax } from '../utils/misc'
import { renderThemedTtp, TtpTheme } from './legacyMemes'
import { getLogger } from './logger'
import { buildStickerMessage } from './stickerEncoder'

const logger = getLogger()

/**
 * Valida o texto, gera e envia a figurinha de um ttp temático.
 * @param {WAMessage} message A mensagem do comando.
 * @param {string} alias O alias usado.
 * @param {string} text O texto após o comando.
 * @param {TtpTheme} theme O tema.
 * @returns {Promise<WAMessage | undefined>} O resultado do envio.
 */
export const sendThemedTtp = async (message: WAMessage, alias: string, text: string, theme: TtpTheme) => {
  const maxChars = 200

  if (!text) {
    return await sendMessage(
      {
        text: spintax(`⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, {para|pra} {utilizar|usar} o comando *${alias}* ` +
          '{você|vc|tu} {precisa|deve} {escrever|digitar} {um texto|algo} {após |depois d}o comando. {🧐|🫠|🥲|🙃|📝}')
      },
      message
    )
  } else if (text.length > maxChars) {
    return await sendMessage(
      { text: spintax(`⚠ O texto deve ter no máximo *${maxChars}* caracteres!`) },
      message
    )
  }

  try {
    const image = await renderThemedTtp(text, theme)
    return await sendMessage(await buildStickerMessage(image, stickerMeta), message)
  } catch (error) {
    logger.error(`Error creating themed ttp: ${error}`)
    return await react(message, emojis.error)
  }
}
