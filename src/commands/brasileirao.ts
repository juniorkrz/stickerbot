import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'
import { ResultadoBrasileirao } from 'types/Brasileirao'

import { obterBrasileiraoA, obterBrasileiraoB } from '../handlers/brasileirao'
import { getCache } from '../handlers/cache'
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

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['brasileirao'],
  desc: 'Exibe a tabela e a rodada atual do Brasileirão série A-B.',
  example: 'A',
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
  onlyVip: false,
  botMustBeAdmin: false,
  interval: 30,
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

    const series = ['A', 'B']

    const statusEmojis = {
      g4: '🟢',
      neutro: '⚫',
      z4: '🔴'
    }

    const serie = getBodyWithoutCommand(removeAccents(body), command.needsPrefix, alias)
      .toUpperCase()

    if (!series.includes(serie)) return await sendMessage(
      {
        text: spintax(
          '⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, a série digitada não é suportada, ' +
          'atualmente são suportados apenas *A* e *B*.'
        )
      },
      message
    )

    const serieData = serie == 'A'
      ? obterBrasileiraoA
      : obterBrasileiraoB

    const cache = getCache()
    const key = `brasileiraoQuery_${serie}`
    const data = cache.get(key)

    let resultado: ResultadoBrasileirao
    let waitReact: boolean = false

    if (!data) {
      await react(message, getRandomItemFromArray(emojis.wait))
      waitReact = true
      try {
        resultado = await serieData()
      } catch (error) {
        logger.warn(`API: brasileirao is down! Error: ${error}`)
        await sendLogToAdmins('*[API]:* brasileirao está offline!')
        const reply = '⚠ Desculpe, este serviço está indisponível no momento. Por favor, tente novamente mais tarde.'
        return await sendMessage(
          { text: reply },
          message
        )
      }

      cache.set(key, resultado, 600)// keep cache for 10 minutes
    } else {
      resultado = data as ResultadoBrasileirao
    }

    const {tabela, rodadas} = resultado
    const [rodada] = rodadas!.filter(rodada => rodada.rodada_atual === true)
    const {partidas} = rodada

    let textoTabela = '', textoPartidas = ''
    tabela.forEach(time =>{
      const pos = parseInt(time.posicao)
      const status = pos < 5
        ? statusEmojis.g4
        : pos < 17
          ? statusEmojis.neutro
          : statusEmojis.z4
      textoTabela += `${status} ${time.posicao}° ${time.nome} - ` +
      `P: ${time.pontos} J: ${time.jogos} V: ${time.vitorias}\n`
    })

    partidas.forEach(partida =>{
      textoPartidas += `- *Partida:* ${partida.time_casa} x ${partida.time_fora} \n`+
                    `- *Data:* ${partida.data} \n`+
                    `- *Local:* ${partida.local} \n`+
                    `- *Resultado:* ${partida.gols_casa ? partida.resultado_texto : '---'}\n\n`
    })

    const response = `⚽ *BRASILEIRÃO SERIE ${serie}* ⚽ \n\n` +
    '*Tabela:*\n' +
    `${textoTabela}\n` +
    '*Rodada Atual:*\n\n' +
    `${textoPartidas}`

    if (waitReact) await react(message, '⚽')

    return await sendMessage(
      {
        text: response.slice(0, -2)
      },
      message
    )
  }
}
