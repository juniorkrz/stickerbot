import dotenv from 'dotenv'
import { IStickerOptions } from 'wa-sticker-formatter'

// Load OS Env Vars
dotenv.config()

// https://docs.wwebjs.dev/global.html#StickerMetadata
export const stickerMeta: IStickerOptions = {
  author: process.env.SB_AUTHOR || '@juniorkrz.dev',
  pack: process.env.SB_PACK || 'StickerBot',
}

// Baileys Config
export const baileys = {
  phoneNumber: process.env.SB_PHONE_NUMBER || '',
  useQrCode: process.env.SB_USE_QR_CODE !== 'false',
  skipUnreadMessages: process.env.SB_SKIP_UNREAD === 'true',
}

// Bot config
export const bot = {
  name: process.env.SB_NAME || 'StickerBot',
  sessionId: process.env.WA_SESSION_ID || 'stickerbot',
  sendWarnings:process.env.SB_SEND_WARNINGS === 'false',
  community: process.env.SB_COMMUNITY,
  prefixes: process.env.SB_PREFIXES ? process.env.SB_PREFIXES.split(';') : ['!'],
  admins: process.env.SB_ADMINS?.replaceAll(' ', '').split(
    ';'
  ) || [],
  groups: process.env.SB_GROUPS?.replaceAll(' ', '').split(
    ';'
  ) || []// TODO - Get from community?
}

// External APIs
export const externalEndpoints = {
  textOnImage: process.env.API_TEXT_ON_IMAGE || 'http://localhost:8000/addText'
}
