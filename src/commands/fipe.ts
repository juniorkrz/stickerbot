import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'
import { FipeResponse } from 'types/Fipe'

import { getCache } from '../handlers/cache'
import { getLogger } from '../handlers/logger'
import * as fipe from '../handlers/placafipe'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { getBodyWithoutCommand, sendLogToAdmins, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { capitalize, spintax } from '../utils/misc'

// Gets the logger
const logger = getLogger()

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['placa', 'fipe'],
  desc: 'Consulta informações do veículo na tabela FIPE baseado na sua placa. (apenas veículos registrados no Brasil)',
  example: 'ABC1234',
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
  onlyVip: true,
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
    const check = await checkCommand(jid, message, alias, group, isBotAdmin, isVip, isGroupAdmin, amAdmin, command)
    if (!check) return

    let licensePlate = getBodyWithoutCommand(body, command.needsPrefix, alias)

    if (!licensePlate) {
      return await sendMessage(
        {
          text: spintax(
            `${emojis.search} {Ops|Desculpe|Foi mal|Eita}, {você|tu} precisa {digitar|informar|escrever} ` +
            `uma placa após o comando ${emojis.error}`
          )
        },
        message
      )
    }

    licensePlate = fipe.sanitizeInput(licensePlate).toLowerCase()

    const cache = getCache()
    const key = `fipeQuery_${licensePlate}`
    const data = cache.get(key)

    let query: FipeResponse | undefined

    if (!data) {
      await sendMessage(
        {
          text: spintax(
            `${emojis.search} {Consultando|Buscando}, {aguarde|espera|pera|espere} um pouco...`
          )
        },
        message
      )
      try {
        query = await fipe.fipeQuery(licensePlate)
      } catch (error) {
        logger.warn(`API: placaFipe is down! Error: ${error}`)
        await sendLogToAdmins('*[API]:* placaFipe está offline!')
        const reply = '⚠ Desculpe, este serviço está indisponível no momento. Por favor, tente novamente mais tarde.'
        return await sendMessage(
          { text: reply },
          message
        )
      }

      cache.set(key, query, 86400)// keep cache for a day
    } else {
      query = data as FipeResponse
    }

    if (!query) {
      return await sendMessage(
        {
          text: spintax(
            `${emojis.search} {Ops|Desculpe|Foi mal|Eita}, a placa não foi encontrada ${emojis.error}`
          )
        },
        message
      )
    }

    const isMercosul = fipe.isMercosul(licensePlate)

    const marca = query.detalhes.marca
    const tipo_veiculo = query.detalhes.tipo_veiculo
    const generico = query.detalhes.generico
    const modelo = query.detalhes.modelo
    const ano = query.detalhes.ano
    const ano_modelo = query.detalhes.ano_modelo
    const cor = query.detalhes.cor
    const cilindrada = query.detalhes.cilindrada
    const potencia = query.detalhes.potencia
    const combustivel = query.detalhes.combustivel
    const chassi = query.detalhes.chassi
    const motor = query.detalhes.motor
    const passageiros = query.detalhes.passageiros
    const municipio = query.detalhes.municipio
    const orgao_emissor = query.orgao_emissor
    const valores_tabela_fipe = query.tabela_fipe.valores
    const valores_ipva = query.tabela_fipe.valores_ipva
    const mercosul = isMercosul ? `Sim ${emojis.success[1]}` : `Não ${emojis.error}`
    const importado = query.detalhes.importado ? `Sim ${emojis.success[1]}` : `Não ${emojis.error}`
    const uf = query.detalhes.uf
    const estado = uf ? fipe.getStateNameByUf(uf) : false

    let veiculos_registrados = query.veiculos_registrados
    if (veiculos_registrados) {
      veiculos_registrados = parseFloat(`${veiculos_registrados}`.replace(',', '.'))
    }

    // Vehicle Emojis
    const vehEmojis: { [key: string]: string } = {
      'carro': emojis.car,
      'moto': emojis.bike,
      'ônibus': emojis.bus,
      'caminhão': emojis.truck
    }

    const emoji = vehEmojis[tipo_veiculo] || emojis.car

    // Generate the message with all the information
    let response = `${emoji} *Consulta de Veículo*\n\n`
    response += `*🪪 Placa:* ${licensePlate.toUpperCase()}\n`
    response += `${isMercosul ? '*🪪 Placa Anterior:*' : '*🪪 Placa Nova:*'} ${fipe.convertLicensePlate(licensePlate)}\n`
    response += `*🇧🇷 Placa Mercosul:* ${mercosul}\n`
    response += tipo_veiculo ? `🔖 *Tipo:* ${tipo_veiculo.toUpperCase()}\n` : ''
    response += marca ? `🏷️ *Marca:* ${marca}\n` : ''
    response += generico ? `🗣 *Genérico:* ${generico}\n` : ''
    response += modelo ? `📝 *Modelo:* ${modelo}\n` : ''
    response += importado ? `🏎 *Importado:* ${importado}\n` : ''
    response += ano ? `📅 *Ano:* ${ano}\n` : ''
    response += ano_modelo ? `📆 *Ano/Modelo:* ${ano_modelo}\n` : ''
    response += cor ? `🎨 *Cor:* ${cor}\n` : ''
    response += cilindrada ? `⚙️ *Cilindrada:* ${cilindrada}\n` : ''
    response += potencia ? `💪 *Potência:* ${potencia}\n` : ''
    response += combustivel ? `⛽ *Combustível:* ${combustivel}\n` : ''
    response += chassi ? `🔢 *Chassi:* ${chassi}\n` : ''
    response += motor ? `🔌 *Motor:* ${motor}\n` : ''
    response += passageiros ? `👥 *Passageiros:* ${passageiros}\n` : ''
    response += estado ? `📍 *Estado:* ${estado}\n` : ''
    response += municipio ? `🏙️ *Município:* ${municipio}\n` : ''
    response += orgao_emissor ? `🏢 *Órgão Emissor:* ${orgao_emissor}\n` : ''
    response += veiculos_registrados ? `📊 *Veículos Registrados em todo Brasil:* ${veiculos_registrados}\n` : ''

    if (valores_tabela_fipe) {
      response += '\n💰 *Valores de Tabela FIPE:*\n'
      for (const valor of valores_tabela_fipe) {
        const modelo = valor.modelo
        const valor_fipe = valor.valor
        response += `${emoji} ${modelo}: ${valor_fipe}\n`
      }

      if (estado && valores_ipva) {
        const valor_ipva = valores_ipva.uf
        if (valor_ipva) {
          response += `\n💲 *Valores para ${estado}:*\n`
          const { valor_venal, taxa, valor_ipva: valor_ipva_value } = valor_ipva
          response += `*IPVA:* ${valor_ipva_value}\n`
          response += `*Taxa:* ${taxa}\n`
          response += `*Valor Venal:* ${valor_venal}\n`
        }
      }
    }

    if (valores_ipva) {
      response += '\n*💲 Valores por Estado:*\n'
      for (const [estado, dados_ipva] of Object.entries(valores_ipva)) {
        const estado_nome = fipe.getStateNameByUf(estado)
        const { valor_venal, taxa, valor_ipva: valor_ipva_value } = dados_ipva
        response += `\n*[ ${estado_nome} ]*\n`
        response += `*IPVA:* ${valor_ipva_value}\n`
        response += `*Taxa:* ${taxa}\n`
        response += `*Valor Venal:* ${valor_venal}\n`
      }
    }

    const descricao = query['tabela_fipe'].descricao
    response += descricao ? `\n_${descricao}_\n\n` : '\n'

    response += '_Desenvolvido por *Júnior "Krz"*_\n_Considere apoiar o projeto me pagando um café 🍺_' +
      '\n\n_Chave Pix: pix@jrkrz.com_'

    return await sendMessage(
      { text: spintax(response) },
      message
    )
  }
}
