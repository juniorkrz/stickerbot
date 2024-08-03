import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { EmojiData, EmojiMetadata } from 'types/Emoji'

import { bot } from '../config'
import { getLogger } from './logger'

const logger = getLogger()
const emojiMetadataPath = path.join(`/data/${bot.sessionId}/resources/emojis-metadata.json`)
const emojiMetadataUrl = 'https://raw.githubusercontent.com/xsalazar/emoji-kitchen-backend/main/app/metadata.json'

export const removeSkinTones = (emoji: string) => {
  const skinToneModifiers = /[\u{1F3FB}-\u{1F3FF}]/u
  return emoji.replace(skinToneModifiers, '')
}

async function downloadFile(url: string, destination: string): Promise<void> {
  const response = await axios.get(url, { responseType: 'stream' })
  const writer = fs.createWriteStream(destination)

  return new Promise((resolve, reject) => {
    response.data.pipe(writer)
    let error: Error | null = null
    writer.on('error', err => {
      error = err
      writer.close()
      reject(err)
    })
    writer.on('close', () => {
      if (!error) {
        resolve()
      }
    })
  })
}

// Ensure the metadata is available
async function ensureEmojiMetadata(): Promise<EmojiMetadata> {
  if (!fs.existsSync(emojiMetadataPath)) {
    logger.info('[EMOJIMIX] Metadata file not found, downloading...')
    await downloadFile(emojiMetadataUrl, emojiMetadataPath)
    logger.info('[EMOJIMIX] Metadata file download complete.')
  }

  return JSON.parse(fs.readFileSync(emojiMetadataPath, 'utf-8'))
}

// Use the emoji metadata
let emojiMetadata: EmojiMetadata

ensureEmojiMetadata().then(metadata => {
  emojiMetadata = metadata
})

export const getEmojiData = (emojiCodepoint: string): EmojiData => {
  return (emojiMetadata as EmojiMetadata).data[emojiCodepoint]
}

export const getSupportedEmoji = (): Array<string> => {
  return (emojiMetadata as EmojiMetadata).knownSupportedEmoji
}

export const getEmojiUnicode = (emoji: string): string => {
  const codepoints = []
  for (let i = 0; i < emoji.length; i++) {
    const codePoint = emoji.codePointAt(i)
    if (codePoint !== undefined) {
      codepoints.push(codePoint.toString(16).toLowerCase())
      if (codePoint > 0xffff) i++
    }
  }

  return `${codepoints.join('')}`
}
