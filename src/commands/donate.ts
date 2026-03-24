import path from 'path'
import { GroupMetadata } from '@whiskeysockets/baileys'
import { MercadoPagoConfig, Payment } from 'mercadopago'

import { bot } from '../config'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { checkCommand } from '../utils/commandValidator'
import { getLogger } from '../handlers/logger'
import { sendMessage, react } from '../utils/baileysHelper'
import { capitalize, spintax, getRandomItemFromArray } from '../utils/misc'
import { emojis } from '../utils/emojis'

// Gets the logger
const logger = getLogger()

// Dynamic import resolution
const extension = __filename.endsWith('.js') ? '.js' : '.ts'
const commandName = capitalize(path.basename(__filename, extension))

export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['donate', 'doar'],
  desc: 'Gera um código PIX para doação/compra de VIP.',
  example: 'donate 15 email@teste.com Nome Sobrenome',
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
  onlyVip: false,
  botMustBeAdmin: false,
  interval: 10,
  limiter: {},
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

    try {
      const params = body.slice(command.needsPrefix ? 1 : 0).replace(new RegExp(`^${alias}\\s*`, 'i'), '').trim()
      const args = params.split(' ')

      if (args.length < 4) {
        await react(message, getRandomItemFromArray(emojis.confused))
        return await sendMessage({
          text: spintax('⚠ {Ei|Ops|Opa}, você precisa informar o valor, email, nome e sobrenome.\n\n*Exemplo:* `!donate 15 email@teste.com João Silva`')
        }, message)
      }

      // Parse params
      const valueStr = args[0].replace(',', '.')
      const amount = parseFloat(valueStr)
      if (isNaN(amount) || amount <= 0) {
        return await sendMessage({ text: '⚠ O valor informado é inválido.' }, message)
      }

      const email = args[1]
      const firstName = args[2]
      const lastName = args.slice(3).join(' ')

      if (!email.includes('@')) {
        return await sendMessage({ text: '⚠ O email informado é inválido.' }, message)
      }

      await react(message, getRandomItemFromArray(emojis.wait))

      const mpConfig = new MercadoPagoConfig({ accessToken: bot.mpAccessToken })
      const mpPayment = new Payment(mpConfig)

      const paymentResponse = await mpPayment.create({
        body: {
          transaction_amount: amount,
          description: `StickerBot VIP Donation - ${sender}`,
          payment_method_id: 'pix',
          payer: {
            email: email,
            first_name: firstName,
            last_name: lastName
          },
          external_reference: sender // We use the sender JID as external_reference to identify who paid
        }
      })

      const qrCodeBase64 = paymentResponse.point_of_interaction?.transaction_data?.qr_code_base64
      const qrCodeText = paymentResponse.point_of_interaction?.transaction_data?.qr_code

      if (!qrCodeBase64 || !qrCodeText) {
        throw new Error('QR Code data missing from MP response.')
      }

      const projectedMonths = amount / bot.vipMonthlyPrice
      let durationText = ''
      if (projectedMonths >= 1) {
        durationText = `Isso adicionará *${projectedMonths.toFixed(1)}* meses de VIP à sua conta!`
      } else {
        durationText = `Isso adicionará uma fração de mês de VIP à sua conta!`
      }

      // Send the image with caption
      await sendMessage({
        image: Buffer.from(qrCodeBase64, 'base64'),
        caption: `💜 *StickerBot VIP - Doação*\n\n` +
          `Valor: R$ ${amount.toFixed(2)}\n\nLeia o QR Code acima no app do seu banco ou utilize a chave PIX Copia e Cola abaixo.\n\n${durationText}\n\nO bot confirmará automaticamente quando o pagamento for aprovado!`
      }, message)

      // Send the Copia e Cola in a separate message for easy copying
      return await sendMessage({
        text: `${qrCodeText}`
      }, message)

    } catch (error) {
      logger.error(`Error in ${commandName}: ${error}`)
      await react(message, emojis.error)
      return await sendMessage({
        text: '⚠ Ocorreu um erro ao gerar o PIX. Verifique os dados ou tente novamente mais tarde.'
      }, message)
    }
  }
}
