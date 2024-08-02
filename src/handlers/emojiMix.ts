import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { EmojiData, EmojiMetadata } from 'types/Emoji'

import { bot } from '../config'
import { getLogger } from './logger'

const logger = getLogger()
const emojiMetadataPath = path.join(`/data/${bot.sessionId}/resources/emojis-metadata.json`)
const emojiMetadataUrl = 'https://raw.githubusercontent.com/xsalazar/emoji-kitchen-backend/main/app/metadata.json'

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

// eslint-disable-next-line max-len
export const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F018}-\u{1F0F5}]|[\u{1F600}-\u{1F636}]|[\u{1F681}-\u{1F6C5}]|[\u{1F30D}-\u{1F567}]/gu

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
