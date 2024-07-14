import ytdl from '@distube/ytdl-core'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import ytsr from 'ytsr'

import { dev } from '../bot'
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

export const downloadAudioFromYoutubeVideo = async (
  url: string, audioFormat: ytdl.videoFormat, filePath: string
): Promise<string | undefined> => {
  return new Promise((resolve, reject) => {
    if (dev) logger.info(`[YTDL] Downloading audio to: ${filePath}`)
    const videoStream = ytdl(url, { format: audioFormat })

    videoStream.on('error', (error) => {
      reject(error)
    })

    const fileWriteStream = fs.createWriteStream(filePath)
    fileWriteStream.on('error', (error) => {
      reject(error)
    })

    const output = filePath.replace('mp4', 'aac')
    if (dev) logger.info(`[YTDL] Audio successfully downloaded: ${filePath}`)
    if (dev) logger.info(`[YTDL] Converting audio to AAC: ${output}`)
    videoStream.pipe(fileWriteStream)
      .on('finish', () => {
        // Conversion to AAC using ffmpeg
        ffmpeg(filePath)
          .output(output)
          .on('end', function() {
            if (dev) logger.info(`[YTDL] Audio successfully converted to AAC: ${output}`)
            resolve(output)
          }).on('error', function(error){
            logger.error(`[YTDL] Error converting audio to AAC: ${error}`)
            resolve(undefined)
          }).run()
      })
      .on('error', (error) => {
        logger.error(`[YTDL] Error converting audio to AAC: ${error}`)
        reject(error)
      })
  })
}
