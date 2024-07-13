import { WAPrivacyOnlineValue, WAPrivacyValue, WAReadReceiptsValue } from '@whiskeysockets/baileys'
import dotenv from 'dotenv'
import { GiphySearch } from 'types/Giphy'
import { TenorSearch } from 'types/Tenor'
import { IStickerOptions } from 'wa-sticker-formatter'

// Load OS Env Vars
dotenv.config()

// https://docs.wwebjs.dev/global.html#StickerMetadata
export const stickerMeta: IStickerOptions = {
  author: process.env.SB_AUTHOR || '@juniorkrz.dev',
  pack: process.env.SB_PACK || 'bit.ly/StickerBot',
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
  setup: JSON.parse(process.env.SB_SETUP || 'false') as boolean,
  status: process.env.SB_STATUS || 'Developed by @juniorkrz.dev',
  donationLink: process.env.SB_DONATION || 'pix@jrkrz.com',
  stickers: +(process.env.SB_STICKERS || 5),
  lastSeenPrivacy: process.env.SB_LAST_SEEN_PRIVACY as WAPrivacyValue || 'all',
  onlinePrivacy: process.env.SB_ONLINE_PRIVACY as WAPrivacyOnlineValue || 'all',
  profilePicPrivacy: process.env.SB_PROFILE_PIC_PRIVACY as WAPrivacyValue || 'all',
  statusPrivacyValue: process.env.SB_STATUS_PRIVACY as WAPrivacyValue || 'all',
  readReceiptsPrivacy: process.env.SB_READ_RECEIPTS_PRIVACY as WAReadReceiptsValue || 'all',
  groupsAddPrivacy: process.env.SB_GROUPS_ADD_PRIVACY as WAPrivacyValue || 'contact_blacklist',
  defaultDisappearingMode: parseInt(process.env.SB_DEFAULT_DISAPPEARING_MODE || '604800') as number,
  sendWarnings: JSON.parse(process.env.SB_SEND_WARNINGS || 'true') as boolean,
  refuseCalls: JSON.parse(process.env.SB_REFUSE_CALLS || 'false') as boolean,
  vipSystem: JSON.parse(process.env.SB_VIP_SYSTEM || 'false') as boolean,
  forceCommunity: JSON.parse(process.env.SB_FORCE_COMMUNITY || 'false') as boolean,
  community: process.env.SB_COMMUNITY,
  logsGroup: process.env.SB_LOGS_GROUP,
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
  // get your own api here: https://github.com/juniorkrz/simple-file-uploader
  fileUploader: process.env.FILE_UPLOADER_API || 'http://localhost:5000',
  // get your own api here: https://github.com/jacebrowning/memegen
  memegen: process.env.MEMEGEN_API || 'http://localhost:6000',
  // get your own api here: https://github.com/helv-io/api
  ttp: process.env.TTP_API || 'http://localhost:7000',
  // get your own api here: https://github.com/juniorkrz/placa-fipe-api
  placaFipe: process.env.PLACA_FIPE_API || 'http://localhost:8000',
  // get your own api here: https://github.com/danielgatis/rembg
  rembg: process.env.REMBG_API || 'http://localhost:9000',
}

// https://developers.giphy.com/docs/api/endpoint#search
export const giphySearch: GiphySearch = {
  api_key: process.env.GIPHY_API_KEY || '',
  lang: process.env.GIPHY_LANGUAGE || 'pt',
  limit: 50,
  q: 'placeholder',
  type: 'gif'
}

// https://developers.google.com/tenor/guides/endpoints
export const tenorSearch: TenorSearch = {
  key: process.env.TENOR_API_KEY || '',
  client_key: process.env.WA_SESSION_ID,
  locale: process.env.TENOR_LOCALE || 'pt_BR',
  media_filter: 'webp_transparent',
  searchfilter: 'sticker,-static',
  limit: 50,
  q: 'placeholder'
}
