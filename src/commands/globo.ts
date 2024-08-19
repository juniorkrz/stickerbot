import { AnyMessageContent, GroupMetadata, WAMessage } from '@whiskeysockets/baileys'
import path from 'path'
import { GCategory, GChannelInfo } from 'types/GloboProgramming'

import { getCache } from '../handlers/cache'
import { channelMap, getChannelCodeBySimpleCode, getChannelPrograms, getChannels } from '../handlers/globoProgramming'
import { getLogger } from '../handlers/logger'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { getBodyWithoutCommand, react, sendLogToAdmins, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { capitalize, getRandomItemFromArray, removeAccents, spintax } from '../utils/misc'

// Gets the logger
const logger = getLogger()

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

const sendError = async (message: WAMessage, error: unknown = undefined) => {
  logger.warn(`API: globoProgramming is down! Error: ${error}`)
  await sendLogToAdmins('*[API]:* globoProgramming está offline!')
  const reply = '⚠ Desculpe, este serviço está indisponível no momento. Por favor, tente novamente mais tarde.'
  await react(message, emojis.error)
  return await sendMessage(
    { text: reply },
    message
  )
}

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['globo'],
  desc: 'Exibe a programação da rede globo.',
  example: 'sp',
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
  onlyVip: false,
  botMustBeAdmin: false,
  interval: 5,
  limiter: {}, // do not touch this
  run: async (
    jid: string,
    sender: string,
    message: WAMessageExtended,
    alias: string,
    body: string,
    group: GroupMetadata | undefined,
    isBotAdmin: boolean,
    isVip: boolean,
    isGroupAdmin: boolean,
    amAdmin: boolean
  ) => {
    const check = await checkCommand(jid, message, alias, group, isBotAdmin, isVip, isGroupAdmin, amAdmin, command)
    if (!check) return

    const simpleChannelCode = getBodyWithoutCommand(removeAccents(body), command.needsPrefix, alias)
      .toLowerCase()

    const cache = getCache()
    const getChannelsKey = 'globoGetChannelsQuery'
    const getChannelsData = cache.get(getChannelsKey)

    let channels: GCategory[] | undefined
    let waitReact: boolean = false

    if (!getChannelsData) {
      await react(message, getRandomItemFromArray(emojis.wait))
      waitReact = true
      try {
        channels = await getChannels()
      } catch (error) {
        return sendError(message, error)
      }

      cache.set(getChannelsKey, channels, 21600)// keep cache for 6 hours
    } else {
      channels = getChannelsData as GCategory[]
    }

    if (!channels) return sendError(message)

    const channelCode = getChannelCodeBySimpleCode(simpleChannelCode)
    if (!simpleChannelCode || !channelCode) {
      let channelsMsg = '⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, {Tu|Vc|Você} ' +
      'precisa digitar o *código do canal* após o comando!\n\n'
      channelsMsg += '📺 *Canais Disponíveis* 📡\n\n'

      channelsMsg += '- *Nome*: código\n\n'

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const [categoryCode, category] of Object.entries(channels)) {
        channelsMsg += `*${category.name}*\n\n`
        for (const [code, channel] of Object.entries(category.channels)) {
          channelsMsg += `- *${channel.name}*: ${channelMap[code]}\n`
        }
        channelsMsg += '\n'
      }

      return await sendMessage(
        {
          text: spintax(
            channelsMsg.trim()
          )
        },
        message
      )
    }

    const getChannelProgramsKey = `globoGetChannelProgramsQuery_${channelCode}`
    const getChannelProgramsData = cache.get(getChannelProgramsKey)

    let channel: GChannelInfo | undefined

    if (!getChannelProgramsData) {
      if (!waitReact) {
        await react(message, getRandomItemFromArray(emojis.wait))
        waitReact = true
      }
      try {
        channel = await getChannelPrograms(channelCode)
      } catch (error) {
        return sendError(message, error)
      }

      cache.set(getChannelProgramsKey, channel, 60)// keep cache for 1 minute
    } else {
      channel = getChannelProgramsData as GChannelInfo
    }

    if (!channel) return sendError(message)

    let response = `📺 *${channel.name}* 📡\n\n`

    // Information about live programming, if available
    if (channel.liveNow) {
      response += `🔴 *Ao Vivo Agora:* ${channel.liveNow.name}\n`
      response += `🕒 *Horário:* ${channel.liveNow.time} - ${channel.liveNow.endTime}\n`
      response += `📺 *Gênero*: ${channel.liveNow.genre}\n`
      response += `📝 *Sinopse*: ${channel.liveNow.synopsis}\n\n`
    }

    response += '🕒 *Programação Completa*\n'

    // Listing programs
    for (const program of channel.programs) {
      response += `\n*${program.name}* ${program.live ? '🔴': ''}\n`
      response += `🕒 ${program.time || '- - : - -'} - ${program.endTime || '- - : - -'}\n`
    }

    let content
    if (channel.liveNow.preview) {
      content = {
        image: {
          url: channel.liveNow.preview,
        },
        caption: spintax(response.trim())
      }
    } else {
      content = { text: spintax(response.trim()) }
    }

    if (waitReact) await react(message, spintax('{📺|📡}'))

    return await sendMessage(
      content as AnyMessageContent,
      message
    )
  }
}
