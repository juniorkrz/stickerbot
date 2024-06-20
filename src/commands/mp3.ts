import { capitalize, getRandomItemFromArray, getTempFilePath, spinText } from '../utils/misc'
import { downloadYoutubeVideo, getUrlByQuery, getYoutubeVideo, isYouTubeUrl } from '../handlers/youtube'
import { react, sendAudio, sendMessage } from '../utils/baileysHelper'
import { GroupMetadata } from '@whiskeysockets/baileys'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { checkCommand } from '../utils/commandValidator'
import fs from 'fs'
import { getClient } from '../bot'
import { getLogger } from '../handlers/logger'
import path from 'path'

// Gets the file name without the .ts extension
const commandName = capitalize(path.basename(__filename, '.ts'))

const logger = getLogger()

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['mp3', 'play'],
  desc: 'Baixa música do video no YouTube.',
  example: 'mp3 link do video no YouTube ou nome da música',
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
  botMustBeAdmin: false,
  interval: 60,
  limiter: {}, // do not touch this
  run: async (
    jid: string,
    message: WAMessageExtended,
    alias: string,
    body: string,
    group: GroupMetadata | undefined,
    isBotAdmin: boolean,
    isGroupAdmin: boolean,
    amAdmin: boolean
  ) => {
    const check = await checkCommand(
      jid,
      message,
      alias,
      group,
      isBotAdmin,
      isGroupAdmin,
      amAdmin,
      command
    )
    if (!check) {
      return false
    }

    // Baixa música do YouTube
    let url: string | undefined = body
      .slice(command.needsPrefix ? 1 : 0)
      .replace(alias, '')
      .trim()

    if (!url) {
      const reply =
                '⚠ {Foi mal|Ops|Eita|Ei|Opa}, {você|tu} deve enviar o nome da música ou o link após o comando!'
      await sendMessage({ text: spinText(reply) }, message)
      await react(message, '❌')
      return false
    }

    if (!isYouTubeUrl(url)) {
      url = await getUrlByQuery(url)
    }

    if (!url) return false

    const videoResult = await getYoutubeVideo(url)
    if (!videoResult) {
      const reply = '❌ {Foi mal|Ops|Eita|Ei|Opa}, {um erro desconhecido aconteceu|algo deu errado}, tente novamente mais tarde!'
      await sendMessage({ text: spinText(reply) }, message)
      await react(message, '❌')
      return false
    }

    const audio = videoResult.audio
    if (!audio.approxDurationMs) {
      return false
    }

    const duration = audio ? parseInt(audio.approxDurationMs!) : 0


    if (!audio || !duration) {
      const reply = '❌ {Foi mal|Ops|Eita|Ei|Opa}, {um erro desconhecido aconteceu|algo deu errado}, tente novamente mais tarde!'
      await sendMessage({ text: spinText(reply) }, message)
      await react(message, '❌')
      return false
    }

    // test duration
    if (duration > (10 * 60000)) { // maximum video duration is 10 minutes
      const reply = '{Foi mal|Ops|Eita|Ei|Opa}, eu {posso|consigo} baixar músicas, não CDs completos {🫤|🫠|🥲|🙃|🤨|🤯|🤗|😑}'
      await sendMessage({ text: spinText(reply) }, message)
      await react(message, '❌')
      return false
    }

    // send wait message
    const replies = [
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
      'O que {você|vc|tu} me pede chorando que eu não faço {sorrindo|rindo}? {😁|😆|😄|🤣|😂}',
      'Calma ae paizão, já to baixando seu audio! a pressa é a inimiga da perfeição...'
    ]

    await sendMessage(
      { text: spinText(getRandomItemFromArray(replies)) },
      message
    )
    await react(message, spinText('{⏱|⏳|🕓|⏰}'))

    // set presence recording
    const client = getClient()
    await client.sendPresenceUpdate('recording', jid)

    // download video
    const filename = `${message.key.id}_${message.messageTimestamp}.mp3`
    const filePath = getTempFilePath(filename)
    await downloadYoutubeVideo(url, audio, filePath)

    // send audio
    await client.sendPresenceUpdate('available', jid)
    const result = await sendAudio(message, filePath)

    // delete file...
    fs.unlink(filePath, (err) => {
      if (err) {
        logger.error(`An error occurred while deleting the file: ${err}`)
        return false
      }
      logger.info(`File deleted successfully: ${filePath}`)
    })

    if (result?.status == 1) {
      await react(message, spinText('{🎧|📻|🎶|🎹|🎸|🎤|🎺|🎼|🎙|🎚|🔈|🔊|🎵|🪗}'))
      return true
    } else {
      await react(message, '❌')
    }
    return false
  }
}
