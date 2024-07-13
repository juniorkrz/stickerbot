/* Adapted from https://github.com/sergiooak/deadbyte-bot/blob/master/src/services/functions/stickers.js */

import { StickerlyResponse, StickerlySticker } from 'types/Stickerly'

const headers = {
  'User-Agent': 'androidapp.stickerly/2.16.0 (G011A; U; Android 22; pt-BR; br;)',
  'Content-Type': 'application/json',
  Host: 'api.sticker.ly'
}

export const searchTermOnStickerLy = async (term: string) => {
  const response = await fetch('http://api.sticker.ly/v4/sticker/search', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      keyword: term,
      size: 0,
      cursor: 0,
      limit: 999
    })
  })

  const json = await response.json() as StickerlyResponse
  if (!json.result.stickers) return []

  const stickers: StickerlySticker[] = json.result.stickers.map((s) => ({
    authorName: s.authorName,
    packName: s.packName,
    resourceUrl: s.resourceUrl,
    nsfwScore: s.stickerPack.nsfwScore
  }))
    .filter((s) => s.nsfwScore <= 69) // filter out nsfw stickers

  return stickers
}

export const getStickerLyTrendings = async () => {
  const response = await fetch('http://api.sticker.ly/v4/stickerPack/recommend', {
    method: 'GET',
    headers
  })

  const json = await response.json() as StickerlyResponse
  if (!json.result.stickerPacks) return []

  const stickers = json.result.stickerPacks.reduce((
    acc: StickerlySticker[], pack) => {
    const prefix = pack.resourceUrlPrefix
    acc.push(...pack.resourceFiles.map((s) => { return {
      authorName: pack.authorName,
      packName: pack.name,
      resourceUrl: prefix + s,
      nsfwScore: 0
    }}))
    return acc
  }, [])

  return stickers
}
