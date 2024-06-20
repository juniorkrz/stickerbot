import ytdl from 'ytdl-core'

export interface ytsrItem {
  url: string
}

export interface VideoAudioInfo {
  info: ytdl.videoInfo
  audio: ytdl.videoFormat
}
