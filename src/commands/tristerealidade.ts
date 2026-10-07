import { GroupMetadata, GroupParticipant, jidNormalizedUser, WAMessage } from '@whiskeysockets/baileys'
import path from 'path'

import { getClient, getStore } from '../bot'
import { getLogger } from '../handlers/logger'
import { generateSadReality, sadRealitySlots } from '../handlers/sadReality'
import { StickerBotCommand } from '../types/Command'
import { getMentionedJids, getPhoneFromJid, react, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { capitalize, getRandomItemFromArray, spintax } from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

const logger = getLogger()

// Máximo de fotos de perfil consultadas para completar os 6 (grupos grandes não precisam consultar todo mundo)
const MAX_LOOKUPS = 20

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['tristerealidade', 'sadreality'],
  desc: 'Cria uma triste realidade com os membros do grupo... É, nem sempre a gente sai ganhando.',
  example: '@mina @pai @irmão @primeiroamor @melhoramigo @você',
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: false,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
  onlyVip: false,
  botMustBeAdmin: false,
  interval: 10,
  limiter: {}, // do not touch this
  run: async (
    jid: string,
    sender: string,
    message: WAMessage,
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

    if (!group) return await react(message, emojis.error)

    const client = getClient()
    const botJids = [client.user?.id, client.user?.lid]
      .filter((id): id is string => !!id)
      .map(id => jidNormalizedUser(id))
    const idsOf = (p: GroupParticipant) =>
      [p.id, p.phoneNumber, p.lid].filter((id): id is string => !!id).map(id => jidNormalizedUser(id))

    const members = group.participants.filter(p => !idsOf(p).some(id => botJids.includes(id)))
    const findMember = async (jid: string) => {
      const normalized = jidNormalizedUser(jid)
      const direct = members.find(p => idsOf(p).includes(normalized))
      if (direct) return direct
      const phone = await getPhoneFromJid(normalized)
      for (const p of members) {
        if (phone && await getPhoneFromJid(p.id) === phone) return p
      }
    }

    const getAvatar = async (p: GroupParticipant) => {
      try {
        const url = await client.profilePictureUrl(p.id, 'image', 5000)
        if (!url) return undefined
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
        return res.ok ? Buffer.from(await res.arrayBuffer()) : undefined
      } catch {
        return undefined // sem foto ou foto privada
      }
    }

    // Como na Loritta: os usuários informados (menções, na ordem) ocupam os primeiros papéis...
    const chosen: { participant: GroupParticipant, avatar?: Buffer }[] = []
    for (const mentioned of getMentionedJids(message) || []) {
      if (chosen.length >= 6) break
      const participant = await findMember(mentioned)
      if (!participant || chosen.some(c => c.participant === participant)) continue
      chosen.push({ participant,
        avatar: await getAvatar(participant) })
    }

    // ...e o resto é sorteado entre os membros, dando preferência a quem tem foto de perfil
    const pool = members.filter(p => !chosen.some(c => c.participant === p))
    if (chosen.length + pool.length < 6) {
      return await sendMessage(
        { text: spintax('😭 {Não existem|Não tem} membros suficientes para fazer uma triste realidade, sorry ;w;') },
        message
      )
    }

    await react(message, getRandomItemFromArray(emojis.wait))

    const withoutPhoto: GroupParticipant[] = []
    let lookups = 0
    while (chosen.length < 6 && pool.length > 0 && lookups < MAX_LOOKUPS) {
      const participant = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]
      lookups++
      const avatar = await getAvatar(participant)
      if (avatar) chosen.push({ participant,
        avatar })
      else withoutPhoto.push(participant)
    }
    for (const participant of [...withoutPhoto, ...pool].sort(() => Math.random() - 0.5)) {
      if (chosen.length >= 6) break
      chosen.push({ participant })
    }

    try {
      // Nome = último pushName visto do membro nas mensagens recentes deste grupo
      const names: Record<string, string> = {}
      for (const m of getStore().messages[jid]?.array || []) {
        const author = m.key.participant
        if (author && m.pushName) names[jidNormalizedUser(author)] = m.pushName
      }
      const senderIds = [sender, message.key.participant, message.key.participantAlt]
        .filter((id): id is string => !!id)
        .map(id => jidNormalizedUser(id))

      const image = await generateSadReality(chosen.map((c, i) => {
        const ids = idsOf(c.participant)
        const isSender = ids.some(id => senderIds.includes(id))
        const name = (isSender && message.pushName) || ids.map(id => names[id]).find(Boolean)
        return { text: sadRealitySlots[i],
          name,
          avatar: c.avatar }
      }))

      await react(message, getRandomItemFromArray(emojis.success))
      return await sendMessage({ image }, message)
    } catch (error) {
      logger.error(`Error in ${commandName}: ${error}`)
      return await react(message, emojis.error)
    }
  }
}
