import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { capitalize, spintax } from '../utils/misc'

// Gets the file name without the .ts extension
const commandName = capitalize(path.basename(__filename, '.ts'))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['pinga'],
  desc: 'Envia uma bebida aleatória',
  example: false,
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
  botMustBeAdmin: false,
  interval: 5,
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

    // Envia uma bebida aleatória

    // TODO: Load texts from JSON
    const pingas = {
      'text': '{Vamos lá!|Um brinde!|Alegria!|Bebida gelada!|Pinga na veia!|' +
        'Chama a cerveja!|Hora do happy hour!|Cheers!|Opa!|Bora!}',

      'emojis': '{🍺|🥃|🍻|🧊|🥃}'
    }

    const drinks = {
      'text': '{Vamos lá!|Um brinde!|Alegria!|Bebida gelada!|Hora do happy hour!|Cheers!|Opa!|Bora!}',
      'emojis': '{🍷|🍾|🍶|🍹|🍸}'
    }

    const randomNumber = Math.random()
    // Se randomNumber for menor que 0.5, escolha pingas, caso contrário, escolha drinks
    const bebida = randomNumber < 0.5 ? pingas
      : drinks


    const response = `${bebida.text} ${bebida.emojis}`

    return await sendMessage(
      { text: spintax(response) },
      message
    )
  }
}
