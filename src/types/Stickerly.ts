interface StickerlyUser {
  oid: string
  userName: string
  relationship?: string
  profileUrl: string
  isOfficial?: boolean
  creatorType?: string
}

interface StickerlyPack {
  trayResourceUrl: string
  packId: string
  nsfwScore: number
  resourceFileNames: string[]
  stickerCount: number
  status: string
  name: string
  private: boolean
  animated?: boolean
  trayIndex?: number
  isOfficial?: boolean
  thumb?: boolean
  endNewmarkDate?: number
  shareUrl?: string
  resourceUrlPrefix?: string
  resourceVersion?: number
  resourceZip?: string
  updated?: number
  owner?: string
}

interface Stickerly {
  packId: string
  stickerPack: StickerlyPack
  user: StickerlyUser
  authorName: string
  resourceUrl: string
  packName: string
  tags: string[]
  sid: string
  animated: boolean
  viewCount: number
  isAnimated: boolean
}

interface StickerlyPackAlt {
  user: StickerlyUser
  packId: string
  animated: boolean
  trayIndex: number
  resourceFiles: string[]
  isOfficial: boolean
  thumb: boolean
  endNewmarkDate: number
  authorName: string
  isAnimated: boolean
  shareUrl: string
  resourceUrlPrefix: string
  resourceVersion: number
  resourceZip: string
  updated: number
  owner: string
  name: string
}

export interface StickerlyResponse {
  result: {
      stickers?: Stickerly[]
      stickerPacks?: StickerlyPackAlt[]
  }
}

export interface StickerlySticker {
  authorName: string
  resourceUrl: string
  packName: string
  nsfwScore: number
}
