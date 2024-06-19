import ytdl from "ytdl-core"

export interface VideoSearch {
  url: string
}

export interface VideoAudioInfo {
  info: ytdl.videoInfo
  audio: ytdl.videoFormat
}
