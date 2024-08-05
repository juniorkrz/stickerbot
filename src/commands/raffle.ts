import { GroupMetadata, GroupParticipant, jidNormalizedUser } from '@whiskeysockets/baileys'
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
    const botJid = jidNormalizedUser(client.user?.id)
    const participants: GroupParticipant[] = group.participants.filter(
      participant => participant.id !== botJid
    )

    const winner = getRandomItemFromArray(participants)
    const raffleName = getBodyWithoutCommand(body, command.needsPrefix, alias)
    const phrase = `@${getPhoneFromJid(winner.id)} {{meus |}parabéns|boa}! {Você|Tu|Vc} ` +
      `{ganhou |venceu |é o vencedor d}o {sorteio|concurso}${raffleName ? ' *' +
        raffleName + '*' : ''}! {🎉|🏆|🏅|🎖|🥇|⭐|✨}`

    return await sendMessage(
      {
        text: spintax(phrase),
        mentions: [winner.id]
      },
      message
    )
  }
}
