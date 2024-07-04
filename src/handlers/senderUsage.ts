import { GroupMetadata, WAMessage } from '@whiskeysockets/baileys'
import { SenderUsage } from 'types/SenderUsage'

import { bot } from '../config'
import { getPhoneFromJid, logAction, sendLogToAdmins, sendMessage } from '../utils/baileysHelper'
import { spintax } from '../utils/misc'
import { getCache } from './cache'

export const getSenderUsage = (sender: string) => {
  const cache = getCache()
  const key = `${sender}_usage`
  const data = cache.get(key)

  // Get sender usage
  const usage = data
    ? data as SenderUsage
    : {
      uses: 0,
      lastUse: Date.now(),
      senderAlerted: false,
      shouldAlertSender: false,
      isSenderRateLimited: false
    } as SenderUsage

  // If he has already been alerted once, he should not be alerted again
  if (usage.senderAlerted && usage.shouldAlertSender) {
    usage.shouldAlertSender = false
  }

  // Is rate limited?
  if (usage.isSenderRateLimited) return usage

  // Increment usage
  usage.uses++

  // Limit the sender if it exceeds the limit
  if (usage.uses > bot.maxUsagePerTime[0]) {
    usage.isSenderRateLimited = true
  }

  // Alert the sender if it is being rate limited
  if (usage.isSenderRateLimited && !usage.senderAlerted) {
    usage.shouldAlertSender = true
    usage.senderAlerted = true
  }

  // Update cache
  cache.set(key, usage, bot.maxUsagePerTime[1])

  return usage
}

export const handleLimitedSender = async (
  message: WAMessage,
  jid: string,
  group: GroupMetadata | undefined,
  sender: string
) => {
  // Get sender usage
  const senderUsage = getSenderUsage(sender)

  // Alert sender if necessary
  if (senderUsage.shouldAlertSender) {
    logAction(message, jid, group, 'Rate Limited Alert')
    await sendLogToAdmins(`*[RATE LIMITED]:* Usuário ${getPhoneFromJid(sender)} foi limitado!`)
    await sendMessage(
      {
        text: spintax(
          '🛑 {Ei|Opa|Ops}, {você|vc|tu} {atingiu|alcançou} o limite de solicitações. ' +
              'Por favor, {aguarde|espere|{não seja tão rápido|evite floodar o bot}, {espere|aguarde}} ' +
              `*${bot.maxUsagePerTime[1]} segundos* e tente novamente. {⏱|⏳|🕓|⏰}`
        )
      },
      message
    )
  }

  return senderUsage.isSenderRateLimited
}
