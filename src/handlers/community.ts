import { areJidsSameUser, GroupMetadata, WAMessage } from '@whiskeysockets/baileys'

import { getClient } from '../bot'
import { bot } from '../config'
import { getAllGroupsFromCommunity, logAction, sendMessage } from '../utils/baileysHelper'
import { spintax } from '../utils/misc'
import { getCache } from './cache'

export const getCommunityAnnounceGroup = async (communityJid: string) => {
  const allGroups = await getAllGroupsFromCommunity(communityJid)
  return allGroups.filter(g => g.isCommunityAnnounce)[0]
}

const isSenderCmmMember = async (sender: string) => {
  const annGroup = await getCommunityAnnounceGroup(bot.community!)
  if (!annGroup) return true
  return annGroup.participants.find(p => areJidsSameUser(p.id, sender)) !== undefined
}

export const handleSenderParticipation = async (
  message: WAMessage,
  jid: string,
  group: GroupMetadata | undefined,
  sender: string
) => {
  if (!bot.forceCommunity || !bot.community) return true

  const isCmmMember = await isSenderCmmMember(sender)
  if (!isCmmMember) {
    const cache = getCache()
    const key = `communityInviteAlert_${sender}`
    const data = cache.get(key)

    // avoid sending the message again for 30 seconds
    if (data) {
      return false
    } else {
      cache.set(key, true, 30)
    }

    const client = getClient()
    const cmmCode = await client.groupInviteCode(bot.community)
    logAction(message, jid, group, 'Community Invite Alert')
    await sendMessage(
      {
        text: spintax(
          '🤖 {Você|Vc|Tu} {precisa|deve} {participar d|entrar n}o *grupo de avisos* ' +
          `para o {${bot.name}|bot} funcionar!\n\nEntre no link e aguarde 30 segundos.` +
          `\n\nhttps://chat.whatsapp.com/${cmmCode}`
        )
      },
      message
    )
    return false
  }
  return true
}
