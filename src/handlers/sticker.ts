import { downloadMediaMessage,WAMessage } from '@whiskeysockets/baileys'
import { MakeStickerOptions } from 'types/Sticker'
import Sticker from 'wa-sticker-formatter'

import { externalEndpoints, stickerMeta } from '../config'
import { getMediaMessage, react, sendMessage } from '../utils/baileysHelper'
import { emojis } from '../utils/emojis'
import { getExtensionFromMimetype, getRandomItemFromArray, spintax } from '../utils/misc'
import { deleteUploadedFile, uploadFile } from './fileUploader'
import { getLogger } from './logger'
import { getCustomMemeUrl } from './memegen'
import { removeBackground } from './rembgApi'

const logger = getLogger()

export const makeSticker = async (
  message: WAMessage,
  options: MakeStickerOptions = {}
) => {
  // get options
  const {
    animated,
    captions,
    customMeta,
    quotedMsg,
    rembg,
    url
  } = options

  // generate sticker meta
  const meta = customMeta
    ? customMeta
    : {
      author: message.pushName || undefined,
      pack: stickerMeta.pack
    }

  // need to react?
  const needReact = (animated || rembg || (captions && captions?.length > 0))
    ? true
    : false

  // if so, react wait
  if (needReact) await react(message, getRandomItemFromArray(emojis.wait))

  // get media message from original message or quoted message
  const mediaMessage = quotedMsg
    ? quotedMsg
    : message

  // limit video duration to 10 seconds
  if (animated) {
    const seconds = mediaMessage.message?.videoMessage?.seconds
    if (seconds && seconds > 10) {
      return await sendMessage(
        {
          text: spintax(
            '⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, o vídeo {deve|precisa} ter no máximo *10* segundos de duração.'
          )
        },
        message
      )
    }
  }

  // get data
  let data: string | Buffer

  if (url) {
    data = url
  } else {
    data = <Buffer>await downloadMediaMessage(mediaMessage, 'buffer', {})
    // if rembg is true, remove background
    if (rembg) data = await removeBackground(data)
  }

  // if something went wrong, react error
  if (!data) return await react(message, emojis.error)

  let uploadedFilename

  // adding captions if necessary
  if (captions && captions.length > 0 && !animated) {
    // get mimetype
    const mimetype = getMediaMessage(mediaMessage)?.mimetype || 'image/png'
    // get the file extension
    const fileExtension = getExtensionFromMimetype(mimetype)
    // generate a filename
    const filename = `${message.key.id}_${message.messageTimestamp}.${fileExtension}`
    // send file to file uploader
    const uploadInfo = await uploadFile(data as Buffer, filename)
    // get the generated filename from file uploader
    uploadedFilename = uploadInfo.file_id + '.' + uploadInfo.file_format
    // get the file url
    const uploadedFileUrl = `${externalEndpoints.fileUploader}/view/${uploadedFilename}`
    // get the file url with captions
    data = getCustomMemeUrl(captions, uploadedFileUrl, animated)
  }

  try {
    // create and send sticker
    const sticker = new Sticker(data, meta)
    const result = await sendMessage(await sticker.toMessage(), message)

    // delete the upload if necessary
    if (uploadedFilename) await deleteUploadedFile(uploadedFilename)

    // react success
    if (needReact) await react(message, getRandomItemFromArray(emojis.success))

    // return result
    return result
  }
  catch (error) {
    // if something went wrong, react error
    await react(message, emojis.error)
    return
  }
}

export const sendStickerAsImage = async (message: WAMessage) => {
  try {
    const image = (await downloadMediaMessage(
      message,
      'buffer',
      {}
    )) as Buffer

    return await sendMessage(
      { image },
      message
    )
  } catch (error) {
    // TODO: Error: EBUSY: resource busy or locked (on Windows)
    logger.error(`An error occurred when converting the sticker to image: ${error}`)
  }
}
