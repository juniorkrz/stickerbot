/* eslint-disable max-len */
import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { react, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { capitalize } from '../utils/misc'

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['creditos', 'credits'],
  desc: 'Mostra os créditos do bot.',
  example: undefined,
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
  onlyVip: false,
  botMustBeAdmin: false,
  interval: 5,
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


    const response =
      /* Créditos */
      `🤖 *StickerBot*

💻 Originalmente desenvolvido em Python, migrado para JavaScript e agora escrito em TypeScript. 🎉

O StickerBot foi criado em *abril de 2023* para uso pessoal, inicialmente sendo bem simples e criando apenas stickers. Não demorou muito para que outras pessoas começassem a utilizá-lo (de Pernambuco para o mundo hahaha).

A cada nova ideia, um comando novo era adicionado ao bot (quem é das antigas sabe). Desde rastrear encomendas dos correios, baixar músicas do YouTube, até gerar uma foto com o negão do zap, eu estava bem ocioso naquela época hahaha.

No início, o StickerBot passou 6 meses fritando meu notebook velho para criar stickers para vocês. Era cada agonia que vocês nem imaginam! Sempre levei isso aqui muito a sério. Apesar de ser apenas um hobbie, nunca deixei esse bot ficar off por mais de 24 horas. Hoje, graças a Deus, temos um servidor dedicado, para a alegria do bot e de vocês.

O StickerBot me trouxe muitas amizades, experiências positivas e muito conhecimento sobre novas tecnologias. Para quem é da área ou pretende entrar, super recomendo criar um projeto louco assim ou mexer em um projeto existente. Vale muito a pena.

Como sabem, toda ideia boa é inspirada na ideia boa de alguém. Então, aqui cito algumas inspirações para o StickerBot:
* wa-stickerbot (https://github.com/helv-io/wa-stickerbot)
* deadbyte-bot (https://github.com/sergiooak/deadbyte-bot)
* lbot-whatsapp (https://github.com/victorsouzaleal/lbot-whatsapp)
* ZeroBot (https://x.com/botzerobot)

Gostaria de agradecer especialmente a algumas pessoas que me ajudaram com coisas relacionadas ao bot. São elas:

*StickerMasters* 👑 - Testes e moderação do bot/comunidade
* Gio 🖤 - Testes, ideias
* Bruno - Testes, ideias
* Pedro H. - Testes, ideias, desenvolvimento
* Pedro R. - Testes, ideias, desenvolvimento
* Todos os admins da comunidade - Moderação

*Tropa do StickerBot* - Sim, a comunidade do StickerBot
* Todas as pessoas com paciência e boa vontade, que estão sempre me ajudando (ou já ajudaram) a testar as novidades no bot
* Todos os apoiadores (https://stickerbot.jrkrz.com/apoiadores)
* Os manitos da Argentina que usam o bot (coloquei tradução só pra vocês, hermanos. ~falei que era de Pernambuco para o mundo~)
* E, é claro, a todos os usuários do StickerBot (até vocês do K-pop que inundaram minha comunidade com essas fontes ~ridículas~, é brincadeira)

Atenciosamente, Júnior "Krz" (@juniorkrz.dev no instagram) - Autor dessa bagaça chamada *StickerBot* - https://github.com/juniorkrz/stickerbot

💜`
    /* Fim créditos */
    await react(message, emojis.heart)
    return await sendMessage(
      { text: response },
      message
    )
  }
}
