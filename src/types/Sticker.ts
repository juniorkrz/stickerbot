import { WAMessage } from '@whiskeysockets/baileys'
import { IStickerOptions } from 'wa-sticker-formatter'

export interface MakeStickerOptions {
    meta?: IStickerOptions
    quotedMsg?: WAMessage
    url?: string
    rembg?: boolean
}
