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
  phoneNumber: process.env.SB_PHONE_NUMBER || undefined,
  useQrCode: JSON.parse(process.env.SB_USE_QR_CODE || 'true') as boolean,
  skipUnreadMessages: JSON.parse(process.env.SB_SKIP_UNREAD || 'false') as boolean
}

// Bot config
export const bot = {
  name: process.env.SB_NAME || 'StickerBot',
  sessionId: process.env.WA_SESSION_ID || 'stickerbot',
  sendWarnings: JSON.parse(process.env.SB_SEND_WARNINGS || 'true') as boolean,
  refuseCalls: JSON.parse(process.env.SB_REFUSE_CALLS || 'false') as boolean,
  community: process.env.SB_COMMUNITY,
  prefixes: process.env.SB_PREFIXES ? process.env.SB_PREFIXES.split(';') : ['!'],
  maxUsagePerTime: process.env.SB_MAX_USAGE_PER_TIME ?
    process.env.SB_MAX_USAGE_PER_TIME.split(';')
      .map(v => parseInt(v))
      .slice(0, 2)
    : [10, 60],
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
