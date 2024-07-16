import { jidNormalizedUser } from '@whiskeysockets/baileys'
import axios from 'axios'
import { FederalResponse } from 'types/Federal'

import { getClient } from '../bot'
import { bot } from '../config'
import { getCache } from '../handlers/cache'
import { getLogger } from '../handlers/logger'
import { getPhoneFromJid } from './baileysHelper'
import { getRandomInt, getRandomItemFromArray } from './misc'

const logger = getLogger()

const baseUrl = 'https://servicebus2.caixa.gov.br/portaldeloterias/api/federal'

const numeros = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣']

const frases_sorte = [
  'Acredite na sua sorte! 🍀🤞',
  'Boa Sorte! 🍀🤞'
]

const grupos: { [key: string]: string[] } = {
  'Grupo *01* - *AVESTRUZ*': ['01', '02', '03', '04'],
  'Grupo *02* - *ÁGUIA* 🦅': ['05', '06', '07', '08'],
  'Grupo *03* - *BURRO* 🫏': ['09', '10', '11', '12'],
  'Grupo *04* - *BORBOLETA* 🦋': ['13', '14', '15', '16'],
  'Grupo *05* - *CACHORRO* 🐕': ['17', '18', '19', '20'],
  'Grupo *06* - *CABRA* 🐐': ['21', '22', '23', '24'],
  'Grupo *07* - *CARNEIRO* 🐏': ['25', '26', '27', '28'],
  'Grupo *08* - *CAMELO* 🐫': ['29', '30', '31', '32'],
  'Grupo *09* - *COBRA* 🐍': ['33', '34', '35', '36'],
  'Grupo *10* - *COELHO* 🐇': ['37', '38', '39', '40'],
  'Grupo *11* - *CAVALO* 🐎': ['41', '42', '43', '44'],
  'Grupo *12* - *ELEFANTE* 🐘': ['45', '46', '47', '48'],
  'Grupo *13* - *GALO* 🐓': ['49', '50', '51', '52'],
  'Grupo *14* - *GATO* 🐈': ['53', '54', '55', '56'],
  'Grupo *15* - *JACARÉ* 🐊': ['57', '58', '59', '60'],
  'Grupo *16* - *LEÃO* 🦁': ['61', '62', '63', '64'],
  'Grupo *17* - *MACACO* 🐒': ['65', '66', '67', '68'],
  'Grupo *18* - *PORCO* 🐖': ['69', '70', '71', '72'],
  'Grupo *19* - *PAVÃO* 🦚': ['73', '74', '75', '76'],
  'Grupo *20* - *PERU* 🦃': ['77', '78', '79', '80'],
  'Grupo *21* - *TOURO* 🦬': ['81', '82', '83', '84'],
  'Grupo *22* - *TIGRE* 🐅': ['85', '86', '87', '88'],
  'Grupo *23* - *URSO* 🐻': ['89', '90', '91', '92'],
  'Grupo *24* - *VEADO* 🦌': ['93', '94', '95', '96'],
  'Grupo *25* - *VACA* 🐄': ['97', '98', '99', '00']
}

export const getBicho = (): string => {
  const grupo = getRandomItemFromArray(Object.keys(grupos))
  const frase = getRandomItemFromArray(frases_sorte)
  return `${grupo}\n\n${frase}`
}

export const getMilhar = (): string => {
  const number = getRandomInt(0, 9999).toString().padStart(4, '0')
  const frase = getRandomItemFromArray(frases_sorte)
  return `${number}\n\n${frase}`
}

export const getCentena = (): string => {
  const number = getRandomInt(0, 999).toString().padStart(3, '0')
  const frase = getRandomItemFromArray(frases_sorte)
  return `${number}\n\n${frase}`
}

export const getDezena = (): string => {
  const number = getRandomInt(0, 99).toString().padStart(2, '0')
  const frase = getRandomItemFromArray(frases_sorte)
  return `${number}\n\n${frase}`
}

const fetchLotteryResponse = async (url: string): Promise<FederalResponse | undefined> => {
  const key = `axios_get_${url}`
  const cache = getCache()
  const cachedData = cache.get(key)

  if (cachedData) return cachedData as FederalResponse
  try {
    const { data } = await axios.get(url)
    cache.set(key, data, 30)
    return data as FederalResponse
  } catch (error) {
    return undefined
  }
}

export const getFederal = async (): Promise<string | undefined> => {
  try{
    let result = await fetchLotteryResponse(baseUrl)

    if (!result) return

    const proxConcurso = (result.numero + 1).toString()
    const proxConcursoUrl = `${baseUrl}/${proxConcurso}`
    const proxConcursoResult = await fetchLotteryResponse(proxConcursoUrl)

    if (proxConcursoResult) {
      result = proxConcursoResult
    }


    let response = '*Resultado da Loteria Federal (19h)* 🍀\n\n'
    response += `*Data de Apuração:* ${result.dataApuracao}\n`
    response += `*Local do Sorteio:* ${result.localSorteio}\n`
    response += `*Número do Concurso:* ${result.numero}\n\n`

    response += '*Milhares Sorteadas:*\n'
    for (let i = 0; i < result.dezenasSorteadasOrdemSorteio.length; i++) {
      const dezena = result.dezenasSorteadasOrdemSorteio[i]
      for (const [grupo, dezenas_grupo] of Object.entries(grupos)) {
        if (dezenas_grupo.includes(dezena.slice(-2))) {
          response += `${numeros[i]} - *${dezena.slice(2)}* (${grupo})\n`
          break
        }
      }
    }

    const client = getClient()
    const botJid = jidNormalizedUser(client.user?.id)
    const botPhone = getPhoneFromJid(botJid)
    response += `\n${getRandomItemFromArray(frases_sorte)}\n\n`
    response += `Créditos: ${bot.name} - https://wa.me/${botPhone}?text=!federal`
    //response += '\n\n_Os resultados geralmente são atualizados por volta das 21h_'
    return response
  } catch (error) {
    logger.error(`An error occurred: ${error}`)
  }
}
