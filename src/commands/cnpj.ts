import { GroupMetadata } from '@whiskeysockets/baileys'
import axios from 'axios'
import path from 'path'

import { bot } from '../config'
import { getLogger } from '../handlers/logger'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { getBodyWithoutCommand, sendLogToAdmins, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
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
  aliases: ['cnpj'],
  desc: 'Mostra informações do CNPJ enviado.',
  example: '19131243000197',
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

    const cnpj = getBodyWithoutCommand(body, command.needsPrefix, alias).replace(/\D/g, '')

    // Validate the CNPJ input
    if (!/^\d{14}$/.test(cnpj)) {
      const errorMessage = '⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, o CNPJ fornecido é inválido. ' +
        'Por favor, insira um CNPJ válido de *14 dígitos* e tente novamente.'
      return await sendMessage(
        { text: spintax(errorMessage) },
        message
      )
    }

    try {
      // Fetching data from the BrasilAPI
      const { data } = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)

      // Constructing the response message
      let response = `🏢 *Informações do CNPJ ${cnpj}:*\n\n` +
        `🔍 *Razão Social:* ${data.razao_social}\n` +
        `🎯 *Nome Fantasia:* ${data.nome_fantasia}\n` +
        `📍 *Endereço:* ${data.logradouro}, ${data.numero}, ${data.bairro}, ${data.municipio} - ${data.uf}\n` +
        `📞 *Telefone:* ${data.ddd_telefone_1}\n`

      // Adicionando parâmetros adicionais se estiverem presentes na resposta
      if (data.descricao_matriz_filial) {
        response += `🏢 *Matriz/Filial:* ${data.descricao_matriz_filial}\n`
      }
      if (data.situacao_cadastral) {
        response += `📈 *Situação Cadastral:* ${data.descricao_situacao_cadastral} (${data.data_situacao_cadastral})\n`
      }
      if (data.motivo_situacao_cadastral !== undefined) {
        response += `📅 *Motivo Situação Cadastral:* ${data.motivo_situacao_cadastral}\n`
      }
      if (data.nome_cidade_exterior) {
        response += `🌍 *Cidade Exterior:* ${data.nome_cidade_exterior}\n`
      }
      if (data.codigo_natureza_juridica) {
        response += `📜 *Natureza Jurídica:* ${data.codigo_natureza_juridica}\n`
      }
      if (data.data_inicio_atividade) {
        response += `📅 *Data de Início de Atividade:* ${data.data_inicio_atividade}\n`
      }
      if (data.cnae_fiscal) {
        response += `📊 *CNAE Fiscal:* ${data.cnae_fiscal}\n`
      }
      if (data.cnae_fiscal_descricao) {
        response += `📊 *Atividade Econômica Principal:* ${data.cnae_fiscal_descricao}\n`
      }
      if (data.descricao_tipo_de_logradouro) {
        response += `🏠 *Tipo de Logradouro:* ${data.descricao_tipo_de_logradouro}\n`
      }
      if (data.logradouro) {
        response += `🏠 *Logradouro:* ${data.logradouro}\n`
      }
      if (data.numero) {
        response += `🏠 *Número:* ${data.numero}\n`
      }
      if (data.complemento) {
        response += `🏠 *Complemento:* ${data.complemento}\n`
      }
      if (data.bairro) {
        response += `🏙️ *Bairro:* ${data.bairro}\n`
      }
      if (data.cep) {
        response += `📮 *CEP:* ${data.cep}\n`
      }
      if (data.uf) {
        response += `📍 *UF:* ${data.uf}\n`
      }
      if (data.codigo_municipio) {
        response += `🌆 *Código do Município:* ${data.codigo_municipio}\n`
      }
      if (data.municipio) {
        response += `🌆 *Município:* ${data.municipio}\n`
      }
      if (data.ddd_telefone_1) {
        response += `📞 *Telefone 1:* ${data.ddd_telefone_1}\n`
      }
      if (data.ddd_telefone_2) {
        response += `📞 *Telefone 2:* ${data.ddd_telefone_2}\n`
      }
      if (data.ddd_fax) {
        response += `📠 *Fax:* ${data.ddd_fax}\n`
      }
      if (data.qualificacao_do_responsavel) {
        response += `👥 *Qualificação do Responsável:* ${data.qualificacao_do_responsavel}\n`
      }
      if (data.capital_social !== undefined) {
        response += `💰 *Capital Social:* R$ ${data.capital_social.toFixed(2)}\n`
      }
      if (data.porte) {
        response += `🏢 *Porte:* ${data.porte} - ${data.descricao_porte}\n`
      }
      if (data.opcao_pelo_simples !== undefined) {
        response += `🟢 *Opção pelo Simples Nacional:* ${data.opcao_pelo_simples ? 'Sim' : 'Não'}\n`
      }
      if (data.data_opcao_pelo_simples) {
        response += `📅 *Data de Opção pelo Simples Nacional:* ${data.data_opcao_pelo_simples}\n`
      }
      if (data.data_exclusao_do_simples) {
        response += `📅 *Data de Exclusão do Simples Nacional:* ${data.data_exclusao_do_simples}\n`
      }
      if (data.opcao_pelo_mei !== undefined) {
        response += `🟢 *Opção pelo MEI:* ${data.opcao_pelo_mei ? 'Sim' : 'Não'}\n`
      }
      if (data.situacao_especial) {
        response += `⚠ *Situação Especial:* ${data.situacao_especial}\n`
      }
      if (data.data_situacao_especial) {
        response += `⚠ *Data Situação Especial:* ${data.data_situacao_especial}\n`
      }

      // CNAEs secundários
      if (data.cnaes_secundarios && data.cnaes_secundarios.length > 0) {
        response += '\n📚 *CNAEs Secundários:*\n'
        data.cnaes_secundarios.forEach((cnae: { codigo: number, descricao: string }) => {
          response += `• ${cnae.codigo} - ${cnae.descricao}\n`
        })
      }

      // Quadro de sócios e administradores (QSA)
      if (data.qsa && data.qsa.length > 0) {
        response += '\n👥 *Quadro de Sócios e Administradores (QSA):*\n'
        data.qsa.forEach((socio: { nome_socio: string, cnpj_cpf_do_socio: string, data_entrada_sociedade: string }) => {
          response += `• ${socio.nome_socio} (${socio.cnpj_cpf_do_socio}) - Entrada: ${socio.data_entrada_sociedade}\n`
        })
      }

      response += `\n_Consultado com ${bot.name}. Digite !pix para apoiar o projeto._`

      return await sendMessage(
        { text: spintax(response) },
        message
      )
    } catch (error) {
      logger.warn('API: BrasilAPI/CNPJ error!')
      await sendLogToAdmins('*[API]:* BrasilAPI/CNPJ error!')
      const reply = '⚠ Desculpe, não consegui obter informações para o CNPJ fornecido. ' +
        'Por favor, verifique se está correto e tente novamente.'
      return await sendMessage(
        { text: reply },
        message
      )
    }
  }
}
