import { downloadMediaMessage, extractMessageContent, GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import {
  addAd,
  getAdById,
  getAdsConfig,
  getAllAds,
  removeAd,
  sendAdPreview,
  setAdActive,
  setAdsCooldown,
  setAdsEvery,
  setAdsSystem
} from '../handlers/ads'
import { getLogger } from '../handlers/logger'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import {
  getImageMessageFromContent,
  getQuotedMessage,
  react,
  sendMessage
} from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { capitalize, getRandomItemFromArray } from '../utils/misc'

// Gets the logger
const logger = getLogger()

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

const usage = '📢 *Gerenciador de Anúncios*\n\n' +
  '`!ads list` - lista os anúncios e a configuração atual\n' +
  '`!ads add <texto>` - cadastra um anúncio (responda/legende uma imagem para incluí-la)\n' +
  '`!ads del <id>` - remove um anúncio\n' +
  '`!ads on <id>` / `!ads off <id>` - ativa/desativa um anúncio\n' +
  '`!ads test` - envia um anúncio de teste neste chat\n\n' +
  '*Configuração:*\n' +
  '`!ads cada <N>` - envia 1 anúncio a cada N figurinhas\n' +
  '`!ads cooldown <min>` - intervalo mínimo por chat, em minutos (0 = sem intervalo)\n' +
  '`!ads sistema on` / `!ads sistema off` - liga/desliga o envio automático'

// Formats the current ads config as a single line, reused in the list and in confirmations.
const formatConfig = (): string => {
  const cfg = getAdsConfig()
  const sys = cfg.system ? '🟢 ligado' : '🔴 desligado'
  const cd = cfg.cooldown >= 60 ? `${Math.round(cfg.cooldown / 60)} min` : `${cfg.cooldown}s`
  return `⚙️ Sistema: ${sys} · 1 a cada *${cfg.every}* figurinhas · cooldown ${cd}/chat`
}

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['ads', 'anuncio', 'anuncios', 'propaganda'],
  desc: 'Gerencia os anúncios enviados automaticamente pelo bot.',
  example: 'add Conheça nosso VIP! Use !donate',
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: true,
  onlyAdmin: false,
  onlyVip: false,
  botMustBeAdmin: false,
  interval: 0,
  limiter: {}, // do not touch this
  skipAds: true, // não anuncia enquanto gerencia anúncios
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

    // Strip prefix + alias, preserving the rest of the text (newlines/spacing) for the ad content
    const params = body
      .slice(command.needsPrefix ? 1 : 0)
      .replace(new RegExp(`^${alias}\\s*`, 'i'), '')

    const parsed = params.match(/^(\S+)\s*([\s\S]*)$/)
    const sub = (parsed?.[1] || '').toLowerCase()
    const argText = (parsed?.[2] || '').trim()

    try {
      // List
      if (sub === '' || sub === 'list' || sub === 'lista') {
        const all = await getAllAds()
        if (all.length === 0) {
          return await sendMessage(
            {
              text: `📭 Nenhum anúncio cadastrado.\n${formatConfig()}\n\n` +
                'Use `!ads add <texto>` para criar o primeiro.'
            },
            message
          )
        }
        let text = `📢 *Anúncios cadastrados (${all.length}):*\n${formatConfig()}\n`
        for (const ad of all) {
          const status = ad.active ? '🟢' : '🔴'
          const img = ad.imageBase64 ? '🖼️ ' : ''
          const oneLine = ad.content.replace(/\n/g, ' ')
          const preview = oneLine.length > 60 ? oneLine.slice(0, 60) + '…' : oneLine
          let stats = `📤 ${ad.sentCount} ${ad.sentCount === 1 ? 'envio' : 'envios'}`
          if (ad.lastSentAt) {
            const when = new Date(ad.lastSentAt).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })
            stats += ` · último: ${when}`
          }
          text += `\n*#${ad.id}* ${status} ${img}${preview}\n   ↳ ${stats}`
        }
        text += '\n\n_Use_ `!ads on/off <id>`, `!ads del <id>` _ou_ `!ads test`'
        return await sendMessage({ text }, message)
      }

      // Add
      if (sub === 'add' || sub === 'adicionar') {
        // Look for an image in the quoted message or in the command message itself
        const quotedMsg = getQuotedMessage(message)
        const targetMessage = quotedMsg ? quotedMsg : message
        const content = extractMessageContent(targetMessage.message)
        const imageMsg = content ? getImageMessageFromContent(content) : undefined

        let imageBase64: string | null = null
        if (imageMsg) {
          try {
            const buffer = (await downloadMediaMessage(targetMessage, 'buffer', {})) as Buffer
            imageBase64 = buffer.toString('base64')
          } catch (error) {
            logger.error(`[ADS] Failed to download image for ad: ${error}`)
            return await sendMessage(
              { text: '⚠ Não consegui baixar a imagem. Tente novamente.' },
              message
            )
          }
        }

        if (!argText && !imageBase64) {
          await react(message, getRandomItemFromArray(emojis.confused))
          return await sendMessage(
            {
              text: '⚠ Informe o texto do anúncio.\n\n*Exemplos:*\n' +
                '`!ads add Conheça nosso VIP! Use !donate`\n' +
                '_ou envie/responda uma imagem com a legenda_ `!ads add <texto>`'
            },
            message
          )
        }

        await addAd(argText, imageBase64)
        await react(message, getRandomItemFromArray(emojis.success))
        return await sendMessage(
          { text: `✅ Anúncio cadastrado${imageBase64 ? ' com imagem' : ''}!\n\nUse \`!ads list\` para ver todos.` },
          message
        )
      }

      // Remove
      if (['del', 'delete', 'remove', 'rm', 'remover', 'excluir'].includes(sub)) {
        const id = parseInt(argText)
        if (isNaN(id)) {
          return await sendMessage({ text: '⚠ Informe o ID do anúncio. Ex: `!ads del 3`' }, message)
        }
        const ad = await getAdById(id)
        if (!ad) {
          return await sendMessage({ text: `⚠ Anúncio *#${id}* não encontrado.` }, message)
        }
        await removeAd(id)
        await react(message, getRandomItemFromArray(emojis.success))
        return await sendMessage({ text: `🗑️ Anúncio *#${id}* removido.` }, message)
      }

      // Activate / Deactivate
      if (sub === 'on' || sub === 'off' || sub === 'ativar' || sub === 'desativar') {
        const id = parseInt(argText)
        if (isNaN(id)) {
          return await sendMessage({ text: '⚠ Informe o ID do anúncio. Ex: `!ads on 3`' }, message)
        }
        const ad = await getAdById(id)
        if (!ad) {
          return await sendMessage({ text: `⚠ Anúncio *#${id}* não encontrado.` }, message)
        }
        const activate = sub === 'on' || sub === 'ativar'
        await setAdActive(id, activate)
        await react(message, getRandomItemFromArray(emojis.success))
        return await sendMessage(
          { text: `${activate ? '🟢' : '🔴'} Anúncio *#${id}* ${activate ? 'ativado' : 'desativado'}.` },
          message
        )
      }

      // Test (sends a random active ad to the current chat, ignoring counter/cooldown)
      if (sub === 'test' || sub === 'testar' || sub === 'preview') {
        const sentId = await sendAdPreview(jid)
        if (sentId === null) {
          return await sendMessage(
            { text: '📭 Nenhum anúncio *ativo* para testar. Cadastre com `!ads add` ou ative com `!ads on <id>`.' },
            message
          )
        }
        return undefined
      }

      // Config: frequency (1 ad every N stickers)
      if (sub === 'cada' || sub === 'every' || sub === 'chance' || sub === 'freq') {
        const n = parseInt(argText)
        if (isNaN(n) || n < 1) {
          return await sendMessage(
            { text: '⚠ Informe um número ≥ 1. Ex: `!ads cada 10` (1 anúncio a cada 10 figurinhas).' },
            message
          )
        }
        await setAdsEvery(n)
        await react(message, getRandomItemFromArray(emojis.success))
        return await sendMessage(
          { text: `✅ Frequência: 1 anúncio a cada *${n}* figurinhas.\n\n${formatConfig()}` },
          message
        )
      }

      // Config: per-chat cooldown (input in minutes, stored in seconds)
      if (sub === 'cooldown' || sub === 'intervalo') {
        const minutes = parseInt(argText)
        if (isNaN(minutes) || minutes < 0) {
          return await sendMessage(
            { text: '⚠ Informe os minutos (≥ 0). Ex: `!ads cooldown 30` (0 = sem intervalo).' },
            message
          )
        }
        await setAdsCooldown(minutes * 60)
        await react(message, getRandomItemFromArray(emojis.success))
        return await sendMessage(
          { text: `✅ Cooldown por chat: *${minutes} min*.\n\n${formatConfig()}` },
          message
        )
      }

      // Config: turn the automatic ad system on/off
      if (sub === 'system' || sub === 'sistema') {
        const arg = argText.toLowerCase()
        const on = ['on', 'ligar', 'ligado', 'true', '1'].includes(arg)
        const off = ['off', 'desligar', 'desligado', 'false', '0'].includes(arg)
        if (!on && !off) {
          return await sendMessage({ text: '⚠ Use `!ads sistema on` ou `!ads sistema off`.' }, message)
        }
        await setAdsSystem(on)
        await react(message, getRandomItemFromArray(emojis.success))
        const label = on ? '🟢 ligado' : '🔴 desligado'
        return await sendMessage(
          { text: `Envio automático: *${label}*.\n\n${formatConfig()}` },
          message
        )
      }

      // Unknown subcommand
      return await sendMessage({ text: usage }, message)
    } catch (error) {
      logger.error(`Error in ${commandName}: ${error}`)
      await react(message, emojis.error)
      return await sendMessage({ text: '⚠ Ocorreu um erro ao gerenciar os anúncios.' }, message)
    }
  }
}
