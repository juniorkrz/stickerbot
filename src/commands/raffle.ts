import {
  GroupMetadata,
  GroupParticipant,
  isLidUser,
  jidDecode,
  jidEncode,
  jidNormalizedUser,
} from '@whiskeysockets/baileys'
import path from 'path'

import { getClient } from '../bot'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { getBodyWithoutCommand, getPhoneFromJid, react, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { capitalize, getRandomItemFromArray, spintax } from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['sorteio', 'sortear', 'concurso', 'raffle'],
  desc: 'Realiza um sorteio entre os membros do grupo.',
  example: 'de um doce!',
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: false,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
  onlyVip: false,
  botMustBeAdmin: false,
  interval: 20,
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

    if (!group) {
      return await react(message, emojis.error)
    }

    const client = getClient()
    // In LID groups participant ids are @lid, so the bot must be matched by both its PN and LID
    const botJids = [client.user?.id, client.user?.lid]
      .filter((id): id is string => !!id)
      .map(id => jidNormalizedUser(id))
    const participants: GroupParticipant[] = group.participants.filter(
      participant => ![participant.id, participant.phoneNumber, participant.lid]
        .some(id => id && botJids.includes(jidNormalizedUser(id)))
    )

    const winner = getRandomItemFromArray(participants)
    const winnerTag = await getMentionTag(winner)

    const raffleName = getBodyWithoutCommand(body, command.needsPrefix, alias)
    const phrase = `@${winnerTag.user} {{meus |}parabéns|boa}! {Você|Tu|Vc} ` +
      `{ganhou |venceu |é o vencedor d}o {sorteio|concurso}${raffleName ? ' *' +
        raffleName + '*' : ''}! {🎉|🏆|🏅|🎖|🥇|⭐|✨}`

    return await sendMessage(
      {
        text: spintax(phrase),
        mentions: [winnerTag.jid]
      },
      message
    )
  }
}

// Mentions by phone number when it is known, otherwise by LID (WhatsApp renders a LID mention as the contact name).
// Never builds a @s.whatsapp.net jid from LID digits: that is what made the raffle show the raw id.
const getMentionTag = async (participant: GroupParticipant) => {
  if (participant.phoneNumber) {
    const jid = jidNormalizedUser(participant.phoneNumber)
    return { jid, user: jidDecode(jid)!.user }
  }

  if (isLidUser(participant.id)) {
    const phone = await getPhoneFromJid(participant.id)
    const lidUser = jidDecode(participant.id)!.user
    if (phone && phone !== lidUser) {
      return { jid: jidEncode(phone, 's.whatsapp.net'), user: phone }
    }
    return { jid: jidNormalizedUser(participant.id), user: lidUser }
  }

  const jid = jidNormalizedUser(participant.id)
  return { jid, user: jidDecode(jid)!.user }
}
