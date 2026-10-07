import { MercadoPagoConfig, Payment } from 'mercadopago'

import { getClient } from '../bot'
import { bot } from '../config'
import { addVip, pool } from './db'
import { getLogger } from './logger'

const logger = getLogger()

// Cliente criado na hora do uso: o token pode ser trocado pelo painel sem reiniciar
const paymentClient = () => new Payment(new MercadoPagoConfig({ accessToken: bot.mpAccessToken }))

export const isMercadoPagoConfigured = () =>
  !!bot.mpAccessToken && !bot.mpAccessToken.startsWith('your_') && bot.mpAccessToken.length > 20

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const q = async <T = any>(sql: string, params: unknown[] = []): Promise<T[]> => {
  const [rows] = await pool.query(sql, params)
  return rows as T[]
}

export const initVipPayments = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`VipPayments\` (
      \`id\` VARCHAR(64) NOT NULL,
      \`jid\` VARCHAR(191) NOT NULL,
      \`amount\` DECIMAL(10,2) NOT NULL,
      \`status\` VARCHAR(32) NOT NULL,
      \`months\` DECIMAL(10,2),
      \`createdAt\` DATETIME NOT NULL,
      \`updatedAt\` DATETIME NOT NULL,
      \`processedAt\` DATETIME NULL,
      PRIMARY KEY (\`id\`),
      KEY \`status\` (\`status\`, \`processedAt\`)
    )
  `)
}

interface CreatedPix {
  id: string
  qrCode: string
  qrCodeBase64: string
}

/** Cria um PIX no Mercado Pago e registra para liberar o VIP quando for aprovado. */
export const createVipPix = async (
  jid: string,
  amount: number,
  payer: { email: string, firstName: string, lastName: string }
): Promise<CreatedPix> => {
  const response = await paymentClient().create({
    body: {
      transaction_amount: Number(amount.toFixed(2)),
      description: `${bot.name} VIP`,
      payment_method_id: 'pix',
      payer: { email: payer.email, first_name: payer.firstName, last_name: payer.lastName },
      // quem pagou: usado pelo webhook/checagem para dar o VIP
      external_reference: jid,
      ...(bot.mpNotificationUrl ? { notification_url: bot.mpNotificationUrl } : {})
    },
    requestOptions: { idempotencyKey: `${jid}-${amount}-${Date.now()}` }
  })
  const id = String(response.id)
  const data = response.point_of_interaction?.transaction_data
  if (!response.id || !data?.qr_code || !data.qr_code_base64) throw new Error('O Mercado Pago não devolveu o QR Code do PIX')
  await pool.query(
    'INSERT IGNORE INTO VipPayments (id, jid, amount, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, NOW(), NOW())',
    [id, jid, amount, response.status || 'pending']
  )
  logger.info(`[VIP] PIX ${id} de R$ ${amount.toFixed(2)} criado para ${jid}`)
  return { id, qrCode: data.qr_code, qrCodeBase64: data.qr_code_base64 }
}

/**
 * Consulta o pagamento no Mercado Pago (fonte da verdade) e, se aprovado, libera o VIP UMA única vez.
 * Chamado pelo webhook e pela checagem periódica.
 */
export const processPayment = async (id: string): Promise<'approved' | 'pending' | 'ignored' | 'already'> => {
  if (!isMercadoPagoConfigured()) return 'ignored'
  const info = await paymentClient().get({ id })
  const status = info.status || 'unknown'
  const jid = info.external_reference
  const amount = Number(info.transaction_amount || 0)
  if (!jid) return 'ignored' // pagamento que não veio do bot

  await pool.query(
    `INSERT INTO VipPayments (id, jid, amount, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE status = VALUES(status), updatedAt = NOW()`,
    [String(id), jid, amount, status]
  )
  if (status !== 'approved') return 'pending'
  if (!(amount > 0) || !(bot.vipMonthlyPrice > 0)) return 'ignored'

  // trava atômica: só um processo (webhook repetido, checagem) consegue marcar como processado
  const months = amount / bot.vipMonthlyPrice
  const [result] = await pool.query(
    'UPDATE VipPayments SET processedAt = NOW(), months = ? WHERE id = ? AND processedAt IS NULL',
    [months, String(id)]
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((result as any).affectedRows !== 1) return 'already'

  const expires = await addVip(jid, months)
  logger.info(`[VIP] Pagamento ${id} aprovado: R$ ${amount.toFixed(2)} -> ${months.toFixed(1)} meses para ${jid}`)
  try {
    await getClient().sendMessage(jid, {
      text: `🎉 *Pagamento aprovado!*\n\nRecebemos sua doação de R$ ${amount.toFixed(2).replace('.', ',')}.\n` +
        `Foram adicionados *${months.toFixed(1).replace('.', ',')}* ${months >= 1 && months < 2 ? 'mês' : 'meses'} ao seu VIP ` +
        `(válido até ${expires.toLocaleDateString('pt-BR')}). Obrigado pelo apoio 💜\n\n` +
        'Digite *!vantagens* para ver o que você ganhou.'
    })
  } catch (error) {
    logger.error(`[VIP] Não consegui avisar ${jid}: ${error}`)
  }
  return 'approved'
}

// Checagem periódica dos PIX pendentes (funciona mesmo sem webhook público configurado)
const pollPending = async () => {
  if (!isMercadoPagoConfigured()) return
  try {
    const rows = await q<{ id: string }>(
      `SELECT id FROM VipPayments WHERE processedAt IS NULL AND status IN ('pending', 'in_process', 'authorized')
       AND createdAt >= NOW() - INTERVAL 2 DAY ORDER BY createdAt DESC LIMIT 30`
    )
    for (const { id } of rows) {
      try {
        await processPayment(id)
      } catch (error) {
        logger.error(`[VIP] Erro ao checar o pagamento ${id}: ${error}`)
      }
    }
  } catch (error) {
    logger.error(`[VIP] Erro na checagem de pagamentos: ${error}`)
  }
}

setInterval(() => void pollPending(), 60_000)
