import { GroupMetadata, isJidGroup, WAMessage } from '@whiskeysockets/baileys'

import { bot } from '../config'
import { getLogger } from '../handlers/logger'
import { CommandLimiter, StickerBotCommand } from '../types/Command'
import { sendMessage } from './baileysHelper'
import { spintax } from './misc'

const logger = getLogger()

const getRemainingTime = (sender: string, interval: number, cmdLimiter: CommandLimiter) => {
  const limiter = cmdLimiter[sender] || {}
  const lastPrompt = limiter.lastPrompt

  if (lastPrompt) {
    if (lastPrompt + interval < Date.now()) {
      cmdLimiter[sender].lastPrompt = Date.now()
      cmdLimiter[sender].alerted = false
    } else {
      return Math.floor((lastPrompt + interval - Date.now()) / 1000)
    }
  } else {
    cmdLimiter[sender] = {
      lastPrompt: Date.now(),
      alerted: false
    }
  }

  return 0
}

export const checkCommand = async (
  jid: string,
  message: WAMessage,
  alias: string,
  group: GroupMetadata | undefined,
  isBotAdmin: boolean,
  isVip: boolean,
  isGroupAdmin: boolean,
  amAdmin: boolean,
  command: StickerBotCommand
) => {
  const sender = message.key.participant || jid
  const isDonor = false// TODO: donors.includes(sender)
  const isGroup = isJidGroup(jid)
  const isBotGroup = isGroup ? bot.groups.includes(jid) : false
  const interval = (isBotAdmin || isDonor || isVip) ? (command.interval / 2) : command.interval

  // Check remaining time
  const remainingTime = interval > 0 ? getRemainingTime(sender, interval * 1000, command.limiter) : 0
  if (remainingTime > 0) {
    if (!command.limiter[sender].alerted && bot.sendWarnings) {
      command.limiter[sender].alerted = true
      // TODO: Load texts from JSON
      const reply = '⚠ {Aguarde|Espere|Não seja tão rápido, ' +
        `{espere|aguarde}} *${remainingTime.toString()}* segundo${remainingTime > 1 ? 's' : ''} antes de ` +
        `{executar|enviar} comando *${alias}* {novamente|mais uma vez}! {⏱|⏳|🕓|⏰}`
      await sendMessage(
        { text: spintax(reply) },
        message
      )
    }
    return false
  }

  // Check if the command is in maintenance
  if (command.inMaintenance && !isBotAdmin) {
    const reply = `⚠ {Ei|Ops|Opa|Desculpe|Foi mal}, o comando *${alias}* {está|tá} em *manutenção*!`
    await sendMessage(
      { text: spintax(reply) },
      message
    )
    return false
  }

  // Check if the sender needs to be the bot owner
  if (command.onlyBotAdmin && !isBotAdmin) {
    return false
  }

  // Check if the command should run only for bot donors/vips
  if (command.onlyVip && bot.vipSystem && !(isDonor || isVip)) {
    const reply = `⚠ O comando *${alias}* só funciona para *apoiadores do ${bot.name}*!\n\n` +
    'Digite *!pix* para saber como se tornar um apoiador.'
    await sendMessage(
      { text: spintax(reply) },
      message
    )
    return false
  }

  // Check if the command should run only in the bot's group
  if (command.onlyInBotGroup && !isBotGroup) {
    const reply = `⚠ O comando *${alias}* só funciona no *grupo oficial do bot*!`
    await sendMessage(
      { text: spintax(reply) },
      message
    )
    return false
  }

  // Is this a Group?
  if (isGroup) {
    // Check if the command should run in groups
    if (!command.runInGroups) {
      const reply = `⚠ O comando *${alias}* não funciona *em grupos*!`
      await sendMessage(
        { text: spintax(reply) },
        message
      )
      return false
    }

    if (!group) {
      logger.warn('Failed to get groupMetadata!')
      return false
    }

    // Can only administrators send messages in the group?
    const onlyAdmins = group?.announce

    // Check if bot can send messages in announce groups
    if (onlyAdmins && !amAdmin) {
      return false
    }

    // Check if the sender needs to be a group admin
    if (command.onlyAdmin && !isGroupAdmin) {
      const reply = `⚠ O comando *${alias}* só funciona para *administradores do grupo*!`
      await sendMessage(
        { text: spintax(reply) },
        message
      )
      return false
    }

    // Check if the bot needs to be a group admin
    if (command.botMustBeAdmin && !amAdmin) {
      const reply = '⚠ Eu preciso ser *um administrador* do grupo para fazer isso!'
      await sendMessage(
        { text: spintax(reply) },
        message
      )
      return false
    }
  } else {
    // Check if the command should run in privates
    if (!command.runInPrivate) {
      const reply = `⚠ O comando *${alias}* só funciona *em grupos*!`
      await sendMessage(
        { text: spintax(reply) },
        message
      )
      return false
    }
  }
  return true
}
