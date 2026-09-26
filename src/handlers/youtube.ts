import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'

import { dev } from '../bot'
import { YoutubeVideoInfo } from '../types/Youtube'
import { getLogger } from './logger'

const logger = getLogger()

// yt-dlp is installed in the Docker image (see Dockerfile). YouTube changes often, so it is kept up to date at runtime.
const YTDLP_BIN = process.env.YTDLP_BIN || 'yt-dlp'
const YTDLP_TIMEOUT_MS = 3 * 60 * 1000
const YTDLP_UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000
const FIELD_SEPARATOR = '|||'

const runYtDlp = (args: string[], timeout = YTDLP_TIMEOUT_MS): Promise<string> => {
  return new Promise((resolve, reject) => {
    execFile(YTDLP_BIN, args, { timeout, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(`${error.message} ${stderr}`.trim()))
      resolve(stdout.trim())
    })
  })
}

const updateYtDlp = async () => {
  try {
    const output = await runYtDlp(['-U'], 60 * 1000)
    logger.info(`[YTDLP] ${output.split('\n').pop()}`)
  } catch (error) {
    logger.warn(`[YTDLP] Could not update yt-dlp: ${error}`)
  }
}

void updateYtDlp()
setInterval(() => void updateYtDlp(), YTDLP_UPDATE_INTERVAL_MS).unref()

export const isYouTubeUrl = (url: string) => {
  const youtubeUrlPattern = /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/).+$/
  return youtubeUrlPattern.test(url)
}

const getInfo = async (target: string): Promise<YoutubeVideoInfo | undefined> => {
  const fields = ['%(id)s', '%(title)s', '%(duration|0)s', '%(webpage_url)s'].join(FIELD_SEPARATOR)
  const output = await runYtDlp(['--no-playlist', '--skip-download', '--no-warnings', '--print', fields, target])
  const [id, title, duration, url] = output.split('\n')[0].split(FIELD_SEPARATOR)
  if (!id || !url) return
  return { id, title, duration: parseInt(duration) || 0, url }
}

export async function getUrlByQuery(query: string) {
  try {
    const video = await getInfo(`ytsearch1:${query}`)
    return video?.url
  } catch (error) {
    logger.error(`An error occurred during the search: ${error}`)
  }
  return
}

export const getYoutubeVideo = async (url: string) => {
  try {
    return await getInfo(url)
  } catch (error) {
    logger.error(`An error occurred while getting information from the video: ${error}`)
    return
  }
}

// Downloads the best audio stream and converts it to M4A (AAC), returning the final file path
export const downloadAudioFromYoutubeVideo = async (url: string, fileBasePath: string): Promise<string | undefined> => {
  const output = `${fileBasePath}.m4a`
  try {
    if (dev) logger.info(`[YTDLP] Downloading audio to: ${output}`)
    await runYtDlp([
      '--no-playlist',
      '--no-warnings',
      '--no-part',
      '-f', 'bestaudio[ext=m4a]/bestaudio/best',
      '-x', '--audio-format', 'm4a',
      '-o', `${fileBasePath}.%(ext)s`,
      url
    ])
    if (!fs.existsSync(output)) throw new Error(`output file not found: ${output}`)
    if (dev) logger.info(`[YTDLP] Audio successfully downloaded: ${output}`)
    return output
  } catch (error) {
    logger.error(`[YTDLP] Error downloading audio: ${error}`)
    cleanupDownload(fileBasePath)
    return
  }
}

// Removes the final file and any leftovers from yt-dlp (original stream before conversion)
export const cleanupDownload = (fileBasePath: string) => {
  const dir = path.dirname(fileBasePath)
  const prefix = path.basename(fileBasePath)
  for (const file of fs.readdirSync(dir)) {
    if (!file.startsWith(`${prefix}.`)) continue
    fs.unlink(path.join(dir, file), (err) => {
      if (err) logger.error(`[YTDLP] An error occurred while deleting the file: ${err}`)
    })
  }
}
