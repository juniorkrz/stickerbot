/* eslint-disable max-len */
import { GroupMetadata } from '@whiskeysockets/baileys'
import fs from 'fs'
import path from 'path'

import { dev, getClient } from '../bot'
import { getLogger } from '../handlers/logger'
import { downloadAudioFromYoutubeVideo, getYoutubeVideo, isYouTubeUrl } from '../handlers/youtube'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { react, sendAudio, sendLogToAdmins, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { capitalize, getRandomItemFromArray, getTempFilePath, spintax } from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

const logger = getLogger()

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['mp3'],
  desc: 'Baixa música do vídeo no YouTube.',
  example: 'link do vídeo no YouTube',
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
  onlyVip: false,
  botMustBeAdmin: false,
  interval: 60,
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
    const check = await checkCommand(
      jid,
      message,
      alias,
      group,
      isBotAdmin,
      isVip,
      isGroupAdmin,
      amAdmin,
      command
    )
    if (!check) return

    // Baixa música do YouTube
    const url: string | undefined = body
      .slice(command.needsPrefix ? 1 : 0)
      .replace(new RegExp(alias, 'i'), '')
      .trim()

    // TODO: Load texts from JSON
    const replies = {
      UNKNOWN_ERROR: `${emojis.error} {Foi mal|Ops|Eita|Ei|Opa}, {um erro desconhecido aconteceu|algo deu errado}, tente novamente mais tarde!`,
      MISSING_NAME_OR_LINK: '⚠ {Foi mal|Ops|Eita|Ei|Opa}, {você|tu} deve enviar o link do vídeo após o comando!',
      VIDEO_IS_TOO_LONG: `{Foi mal|Ops|Eita|Ei|Opa}, eu {posso|consigo} baixar músicas, não CDs completos ${getRandomItemFromArray(emojis.confused)}`,
      WAIT: [
        'Essa música é {boa|top|das boas|show}, {calma|espera|pera|aguenta} aí, já já te {envio|mando}...',
        'Eu {estava|tava} ouvindo essa {agorinha|agora}, vou te enviar, {pera|espera|já vai}...',
        '{Calma|Espera|Pera|Aguenta} aí, {sua|essa} música já {está|tá} ficando pronta...',
        'Essa é {boa|top|das boas|show}, vou te {mandar|enviar} agora!',
        'Segura o forninho, que a música {está|tá} quase saindo!',
        '{Calma|Espera|Pera|Aguenta} aí que o envio {da|dessa} música {está|tá} mais devagar que tartaruga com sono!',
        'A música já {está|tá} quase pronta para ser enviada, só {estou|tô} {ajustando|terminando} os últimos detalhes!',
        '{Calma|Espera|Pera|Aguenta} aí, a música {está|tá} quase saindo do {forno|forninho} digital, fresquinha e pronta para {você|tu|vc}!',
        '{Tô|Estou} acelerando o envio da música para {você|vc|tu}, em alguns {instantes|segundos} estará batendo na porta do seu {dispositivo|celular|aifone}!',
        '{Calma|Espera|Pera|Aguenta} aí {CNPJoto|Muçarelo|meu Samsungo|meu Tim Maio|meu Madonno|Calabreso}, eu já {tô|estou} {enviando|fazendo o upload|mandando}...',
        `O que {você|vc|tu} me pede chorando que eu não faço {sorrindo|rindo}? ${getRandomItemFromArray(emojis.happy)}`,
        'Calma ae paizão, já to baixando seu audio! a pressa é a inimiga da perfeição...'
      ]
    }

    if (!url) {
      await sendMessage({ text: spintax(replies.MISSING_NAME_OR_LINK) }, message)
      await react(message, emojis.error)
      return
    }

    if (!isYouTubeUrl(url)) {
      await sendMessage({ text: spintax(replies.MISSING_NAME_OR_LINK) }, message)
      await react(message, emojis.error)
      return
    }

    if (!url) return

    const videoResult = await getYoutubeVideo(url)
    if (!videoResult) {
      await sendMessage({ text: spintax(replies.MISSING_NAME_OR_LINK) }, message)
      await react(message, emojis.error)
      return
    }

    const audio = videoResult.audio
    if (!audio.approxDurationMs) {
      return
    }

    const duration = audio ? parseInt(audio.approxDurationMs!) : 0


    if (!audio || !duration) {
      await sendLogToAdmins('*[ERROR]:* YouTube error!')
      await sendMessage({ text: spintax(replies.UNKNOWN_ERROR) }, message)
      return await react(message, emojis.error)
    }

    // test duration
    if (duration > (10 * 60000)) { // maximum video duration is 10 minutes
      await sendMessage({ text: spintax(replies.VIDEO_IS_TOO_LONG) }, message)
      return react(message, emojis.error)
    }

    // send wait message
    await sendMessage(
      { text: spintax(getRandomItemFromArray(replies.WAIT)) },
      message
    )

    // react wait
    await react(message, getRandomItemFromArray(emojis.wait))

    // set presence recording
    const client = getClient()
    await client.sendPresenceUpdate('recording', jid)

    // download audio from video as MP4 and convert audio to AAC
    const filename = `${message.key.id}_${message.messageTimestamp}.mp4`
    const filePath = getTempFilePath(filename)
    const output = await downloadAudioFromYoutubeVideo(url, audio, filePath)

    // if something wrong, react with an error
    if (!output) return await react(message, emojis.error)

    // send audio
    if (dev) logger.info(`[YTDL] Sending audio ${output}`)
    await client.sendPresenceUpdate('available', jid)
    const result = await sendAudio(message, output)

    // delete file
    fs.unlink(output, (err) => {
      if (err) {
        logger.error(`[YTDL] An error occurred while deleting the file: ${err}`)
        return
      }
      if (dev) logger.info(`[YTDL] File deleted successfully: ${output}`)
    })

    if (result?.status == 1) {
      // react success
      return await react(message, getRandomItemFromArray(emojis.music))
    } else {
      // react error
      await react(message, emojis.error)
    }
    return
  }
}
