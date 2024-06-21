import { GroupMetadata, GroupParticipant, jidNormalizedUser } from '@whiskeysockets/baileys'
import path from 'path'

import { getClient } from '../bot'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { getPhoneFromJid, react, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { capitalize, getRandomItemFromArray, spintax } from '../utils/misc'

// Gets the file name without the .ts extension
const commandName = capitalize(path.basename(__filename, '.ts'))

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
  botMustBeAdmin: false,
  interval: 20,
  limiter: {}, // do not touch this
  run: async (
    jid: string,
    message: WAMessageExtended,
    alias: string,
    body: string,
    group: GroupMetadata | undefined,
    isBotAdmin: boolean,
    isGroupAdmin: boolean,
    amAdmin: boolean
  ) => {
    const check = await checkCommand(jid, message, alias, group, isBotAdmin, isGroupAdmin, amAdmin, command)
    if (!check) {
      return
    }

    if(!group) {
      return await react(message, '❌')
    }

    const client = getClient()
    const botJid = jidNormalizedUser(client.user?.id)
    const participants: GroupParticipant[] = group.participants.filter(
      participant => participant.id !== botJid
    )

    const winner = getRandomItemFromArray(participants)
    const raffleName = body.slice(command.needsPrefix ? 1 : 0).replace(alias, '').trim()
    const phrase = `@${getPhoneFromJid(winner.id)} {{meus |}parabéns|boa}! {Você|Tu|Vc} ` +
    `{ganhou |venceu |é o vencedor d}o {sorteio|concurso}${raffleName ? ' *' + raffleName + '*' : ''}! {🎉|🏆|🏅|🎖|🥇|⭐|✨}`

    return await sendMessage(
      {
        text: spintax(phrase),
        mentions: [winner.id]
      },
      message
    )
  }
}
