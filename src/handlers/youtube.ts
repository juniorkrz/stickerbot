import ytdl from '@distube/ytdl-core'
import fs from 'fs'
import ytsr from 'ytsr'

import { ytsrItem } from '../types/Youtube'
import { getLogger } from './logger'

const logger = getLogger()

export const isYouTubeUrl = (url: string) => {
  const youtubeUrlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/).+$/
  return youtubeUrlPattern.test(url)
}

export async function getUrlByQuery(query: string) {
  try {
    // Perform a search on YouTube
    const filters = await ytsr.getFilters(query)
    const filter = filters.get('Type')?.get('Video')
    const options = {
      limit: 1, // Limit results to just 1 video
    }

    if (!filter?.url) return

    const searchResults = await ytsr(filter.url, options)

    // Get the first result
    const firstVideo = searchResults.items[0] as ytsrItem | undefined

    if (!firstVideo?.url) return

    return firstVideo.url
  } catch (error) {
    logger.error(`An error occurred during the search: ${error}`)
  }
  return
}

export const getYoutubeVideo = async (url: string) => {
  try {
    const info = await ytdl.getInfo(url)
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly')

    if (audioFormats.length === 0) {
      logger.warn('This video does not have an audio format available for download.')
      return
    }

    const audioFormat = ytdl.chooseFormat(audioFormats, { quality: 'highestaudio' })
    return { info: info,
      audio: audioFormat }
  } catch (error) {
    logger.error(`An error occurred while getting information from the video: ${error}`)
    return
  }
}

// TODO: return boolean
export const downloadYoutubeVideo = async (url: string, audioFormat: ytdl.videoFormat, filePath: string) => {
  return new Promise((resolve, reject) => {
    // Start downloading the audio
    const videoStream = ytdl(url, { format: audioFormat })

    videoStream.on('error', (error) => {
      reject(error) // Reject the promise in case of error
    })

    videoStream.pipe(fs.createWriteStream(filePath))
      .on('finish', () => {
        logger.info(`Video audio successfully downloaded: ${filePath}`)
        resolve(filePath) // Resolves promise with file path when download is complete
      })
      .on('error', (error) => {
        reject(error) // Rejects promise in case of error during download
      })
  })
}
