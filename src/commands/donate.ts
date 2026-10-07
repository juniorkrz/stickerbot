import path from 'path'
import { GroupMetadata, jidEncode } from '@whiskeysockets/baileys'

import { bot } from '../config'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { checkCommand } from '../utils/commandValidator'
import { getLogger } from '../handlers/logger'
import { createVipPix, isMercadoPagoConfigured } from '../handlers/vipPayments'
import { getPhoneFromJid, react, sendMessage } from '../utils/baileysHelper'
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

    if (!isMercadoPagoConfigured()) {
      logger.warn('[VIP] !doar usado, mas o access token do Mercado Pago não está configurado')
      return await sendMessage({
        text: '⚠ O PIX automático está indisponível no momento. Use o comando *!pix* para doar pela chave.'
      }, message)
    }

    try {
      const params = body.slice(command.needsPrefix ? 1 : 0).replace(new RegExp(`^${alias}\s*`, 'i'), '').trim()
      const args = params.split(/\s+/).filter(Boolean)

      if (args.length < 4) {
        await react(message, getRandomItemFromArray(emojis.confused))
        return await sendMessage({
          text: spintax('⚠ {Ei|Ops|Opa}, você precisa informar o valor, e-mail, nome e sobrenome.\n\n' +
            `*Exemplo:* \`!${alias} ${bot.vipMonthlyPrice.toFixed(0)} email@exemplo.com João Silva\``)
        }, message)
      }

      const amount = parseFloat(args[0].replace('R$', '').replace(',', '.'))
      if (isNaN(amount) || amount < 1) {
        return await sendMessage({ text: '⚠ O valor informado é inválido (mínimo R$ 1,00).' }, message)
      }

      const email = args[1]
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return await sendMessage({ text: '⚠ O e-mail informado é inválido.' }, message)
      }

      await react(message, getRandomItemFromArray(emojis.wait))

      // VIP vai para o número (estável); se não der para descobrir, usa o id do remetente
      const phone = await getPhoneFromJid(sender)
      const vipJid = phone ? jidEncode(phone, 's.whatsapp.net') : sender
      const pix = await createVipPix(vipJid, amount, { email, firstName: args[2], lastName: args.slice(3).join(' ') })

      const months = amount / bot.vipMonthlyPrice
      const durationText = months >= 1
        ? `Isso adicionará *${months.toFixed(1).replace('.', ',')}* ${months < 2 ? 'mês' : 'meses'} de VIP à sua conta!`
        : 'Isso adicionará uma fração de mês de VIP à sua conta!'

      // Sem botões: o WhatsApp não entrega mensagens interativas de forma confiável para contas comuns.
      // QR na imagem + código "copia e cola" sozinho numa mensagem (fácil de copiar segurando).
      await sendMessage({
        image: Buffer.from(pix.qrCodeBase64, 'base64'),
        caption: `💜 *${bot.name} VIP - Doação*\n\n` +
          `*Valor:* R$ ${amount.toFixed(2).replace('.', ',')}\n` +
          `${durationText}\n\n` +
          'Leia o QR Code no app do seu banco ou copie o código *PIX copia e cola* da próxima mensagem.\n\n' +
          '✅ O VIP é liberado automaticamente assim que o pagamento for aprovado (normalmente em até 1 minuto).'
      }, message)
      await react(message, getRandomItemFromArray(emojis.success))
      return await sendMessage({ text: pix.qrCode }, message, false)
    } catch (error) {
      logger.error(`Error in ${commandName}: ${error}`)
      await react(message, emojis.error)
      return await sendMessage({
        text: '⚠ Ocorreu um erro ao gerar o PIX. Verifique os dados ou tente novamente mais tarde.'
      }, message)
    }
  }
}
