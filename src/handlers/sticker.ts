import { downloadMediaMessage,WAMessage } from '@whiskeysockets/baileys'
import { MakeStickerOptions } from 'types/Sticker'
import Sticker from 'wa-sticker-formatter'

import { stickerMeta } from '../config'
import { getMediaMessage, react, sendLogToAdmins, sendMessage } from '../utils/baileysHelper'
import { emojis } from '../utils/emojis'
import { getRandomItemFromArray, spintax } from '../utils/misc'
import { getLogger } from './logger'
import { addCaptionOnImage } from './memeCaption'
import { removeBackground } from './rembgApi'

const logger = getLogger()

export const makeSticker = async (
  message: WAMessage,
  options: MakeStickerOptions = {}
) => {
  const { meta = stickerMeta, quotedMsg, url, rembg } = options

  const mediaMessage = quotedMsg
    ? quotedMsg
    : message

  let data: string | Buffer
  if (url) {
    data = url
  } else {
    let buffer = <Buffer>await downloadMediaMessage(mediaMessage, 'buffer', {})
    if (rembg) {
      buffer = await removeBackground(buffer)
    }
    data = buffer
  }

  if (!data) return

  const sticker = new Sticker(data, meta)
  return await sendMessage(await sticker.toMessage(), message)
}

export const makeStaticSticker = async (message: WAMessage, quotedMsg: WAMessage) => {
  return await makeSticker(message, { quotedMsg })
}

export const makeAnimatedSticker = async (message: WAMessage, quotedMsg: WAMessage) => {
  await react(message, getRandomItemFromArray(emojis.wait))
  const result = await makeSticker(message, { quotedMsg })
  await react(message, getRandomItemFromArray(emojis.success))
  return result
}

export const makeStaticStickerWithCaptions = async (
  message: WAMessage,
  quotedMsg: WAMessage | undefined,
  captions: string[]
) => {
  const mediaMessage = quotedMsg
    ? quotedMsg
    : message

  const buffer = <Buffer>await downloadMediaMessage(mediaMessage, 'buffer', {})
  const mimeType = getMediaMessage(mediaMessage)?.mimetype

  const data = await addCaptionOnImage(buffer, mimeType!, captions)
  if (!data) {
    logger.warn('API: memeCaption is down!')
    await sendLogToAdmins('*[API]:* memeCaption error!')
    // TODO: Load texts from JSON
    const reply = '⚠ Desculpe, algo deu errado ao criar seu sticker. ' +
      '{Por favor, tente novamente mais tarde|Se o erro persistir, informe ao desenvolvedor na comunidade do bot}.'
    return await sendMessage(
      { text: spintax(reply) },
      message
    )
  }

  const sticker = new Sticker(data, stickerMeta)
  return await sendMessage(await sticker.toMessage(), message)
}

export const makeRembgSticker = async (message: WAMessage, quotedMsg: WAMessage | undefined = undefined) => {
  try {
    return await makeSticker(
      message,
      {
        rembg: true,
        quotedMsg: quotedMsg
      }
    )
  } catch (error) {
    return
  }
}

export const unmakeSticker = async (message: WAMessage) => {
  // Send sticker as image
  try {
    const image = (await downloadMediaMessage(
      message,
      'buffer',
      {}
    )) as Buffer

    await sendMessage(
      { image },
      message
    )
  } catch (error) {
    // TODO: Error: EBUSY: resource busy or locked (on Windows)
    logger.error(`An error occurred when converting the sticker to image: ${error}`)
  }
}
