import { compare } from 'compare-versions'
import fs from 'fs'
import os from 'os'
import path from 'path'

import { bot } from '../config'
import { getLogger } from '../handlers/logger'
import { colors } from './colors'

const logger = getLogger()

export const createDirectoryIfNotExists = async (directory: string) => {
  try {
    await fs.promises.access(directory)
  } catch (error) {
    logger.info(`Creating directory ${directory}`)
    await fs.promises.mkdir(directory, { recursive: true })
  }
}

export const getPackageInfo = () => {
  try {
    const packageJsonPath = './package.json'
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8')
    const packageJson = JSON.parse(packageJsonContent)
    return packageJson
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error('Error reading local package.json:', error.message)
    } else {
      console.error('Other error occurred:', error)
    }
    return null
  }
}

export const getLocalVersion = () => {
  const info = getPackageInfo()
  return info ? info.version : null
}

export const getHomepage = () => {
  const info = getPackageInfo()
  return info ? info.homepage.replace('#readme', '') : 'https://github.com/juniorkrz'
}

export const spinText = (text: string) => {
  const pattern = /\{([^{}]+)\}/g

  while (pattern.test(text)) {
    text = text.replace(pattern, (match, p1) => {
      const options = p1.split('|')
      const randomIndex = Math.floor(Math.random() * options.length)
      return options[randomIndex]
    })
  }

  return text
}

export const capitalize = (str: string): string => {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// Check if message has a valid prefix
export const hasValidPrefix = (body: string) => {
  return bot.prefixes.includes(body.trim()[0])
}

const getJsonFromUrl = async (url: string) => {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      logger.error(`Failed to fetch ${url}: ${response.statusText}`)
      return false
    }
    const json = await response.json()
    return json
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(`Error fetching json from url: ${error.message}`)
    } else {
      logger.error('Error fetching json from url: An unexpected error occurred')
    }
  }
  return false
}


const fetchVersionFromJson = async () => {
  try {
    const versionUrl = 'https://raw.githubusercontent.com/juniorkrz/stickerbot/main/package.json'// don't change it
    const json = await getJsonFromUrl(versionUrl)
    return json
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(`Error fetching version from json: ${error.message}`)
    } else {
      logger.error('Error fetching version from json: An unexpected error occurred')
    }
  }
}

export const checkForUpdates = async () => {
  logger.info('Checking for updates...')
  const latestVersion = await fetchVersionFromJson()
  const localVersion = await getLocalVersion()
  if (!latestVersion || !localVersion) {
    logger.error('Failed to check for updates [!]')
  } else {
    const isUpdated = compare(localVersion, latestVersion.version, '=')
    const versionMessage = isUpdated ? `You're up to date! ${bot.name} running on v${localVersion}. Have fun! :)`
      : `New version available! => ${latestVersion.version} - You are running ${bot.name} on v${localVersion}! :(`
    const messageColor = isUpdated ? colors.green : colors.red
    logger.info(`${messageColor}${versionMessage}${colors.reset}`)
  }

  logger.info(`Starting ${bot.name} on ${bot.sessionId} session...`)
}

export const getRandomItemFromArray = <T>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)]
}

export const getTempFilePath = (filename: string): string => {
  const tempDir = os.tmpdir()
  return path.join(tempDir, filename)
}
