import { GroupMetadata, jidEncode, WAMessage } from '@whiskeysockets/baileys'
import path from 'path'

import {
  createList,
  drawTeams,
  DrawResult,
  EntryRow,
  getActiveList,
  getPresentCount,
  joinList,
  JoinResult,
  leaveList,
  markPresenceByJid,
  markPresenceByPosition,
  parseListTemplate,
  removeByPosition,
  renderList,
  SECTION_GK,
  SECTION_MAIN,
  setListStatus
} from '../handlers/lists'
import { getLogger } from '../handlers/logger'
import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { getPhoneFromJid, react, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { capitalize, getRandomItemFromArray } from '../utils/misc'

// Gets the logger
const logger = getLogger()

// Gets the extension of this file, to dynamically import '.ts' if in development and '.js' if in production
const extension = __filename.endsWith('.js') ? '.js' : '.ts'

// Gets the file name without the .ts/.js extension
const commandName = capitalize(path.basename(__filename, extension))

const usage = '📋 *Listas (ex.: pelada)*\n\n' +
  '`!lista` - mostra a lista atual\n' +
  '`!lista eu` - você entra na linha\n' +
  '`!lista gol` - você entra como goleiro\n' +
  '`!lista add <nome>` - adiciona um convidado na linha\n' +
  '`!lista gol <nome>` - adiciona um goleiro convidado\n' +
  '`!lista presente` - marca a sua presença ✅\n' +
  '`!lista presente <nº>` - marca presença por posição (`gol <nº>` p/ goleiro)\n' +
  '`!lista falta <nº>` - desmarca presença\n' +
  '`!lista sair` - você sai da lista\n\n' +
  '*Admin do grupo:*\n' +
  '`!lista criar` - cria a lista (responda/cole o modelo)\n' +
  '`!lista nova` - recomeça a semana (mesma estrutura, vazia)\n' +
  '`!lista remover <nº>` - remove da linha (`gol <nº>` p/ goleiro)\n' +
  '`!lista fechar` / `!lista abrir` - tranca/destranca entradas\n' +
  '`!lista sortear <N>` - sorteia times de N (só presentes)\n' +
  '`!lista sortear <N> todos` - sorteia com todos da lista'

const TEAM_EMOJIS = ['⚪', '🔵', '🔴', '🟢', '🟡', '🟣', '🟠', '⚫']

// Reads the quoted message text directly from the command message's contextInfo.
const getQuotedText = (message: WAMessage): string => {
  const ctx = message.message?.extendedTextMessage?.contextInfo
    || message.message?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo
  const q = ctx?.quotedMessage
  if (!q) return ''
  return q.conversation
    || q.extendedTextMessage?.text
    || q.imageMessage?.caption
    || q.videoMessage?.caption
    || ''
}

// A name argument means "add this person as a guest" (no linked account);
// no argument means "the sender joins" (linked to their jid).
const resolveJoiner = (argText: string, sender: string, senderName: string) => {
  if (argText) return { name: argText, jid: null, addedBy: senderName }
  return { name: senderName, jid: sender, addedBy: null }
}

// Short confirmation for a main-list join (used by !lista eu and !lista add).
const replyJoin = async (
  message: WAMessage,
  res: JoinResult,
  name: string,
  mainCap: number
): Promise<WAMessage | undefined> => {
  if (res.status === 'dup') {
    return await sendMessage({ text: 'ℹ️ Você já está na lista.' }, message)
  }
  await react(message, getRandomItemFromArray(emojis.success))
  if (res.isReserva) {
    return await sendMessage(
      { text: `📋 *${name}* entrou nas reservas (${res.position - mainCap}º da fila).` },
      message
    )
  }
  return await sendMessage({ text: `✅ *${name}* entrou! (${res.position}/${mainCap})` }, message)
}

// Notifies (mentioning when possible) the reserve that was promoted into the list.
const notifyPromotion = async (message: WAMessage, promoted: EntryRow): Promise<void> => {
  if (promoted.jid) {
    const phone = await getPhoneFromJid(promoted.jid)
    if (phone) {
      const mentions = [promoted.jid, jidEncode(phone, 's.whatsapp.net')]
      await sendMessage(
        {
          text: `🔄 @${phone} subiu da reserva para a lista!`,
          mentions: Array.from(new Set(mentions))
        },
        message
      )
      return
    }
  }
  await sendMessage({ text: `🔄 *${promoted.name}* subiu da reserva para a lista!` }, message)
}

const renderDraw = (draw: DrawResult, size: number, all: boolean): string => {
  const label = all ? 'jogadores' : 'presentes'
  let out = `🎲 *Sorteio* — times de ${size} (${draw.confirmed} ${label})\n`
  draw.teams!.forEach((team, i) => {
    const emoji = TEAM_EMOJIS[i % TEAM_EMOJIS.length]
    out += `\n${emoji} *Time ${i + 1}*`
    team.players.forEach(p => {
      out += `\n  • ${p.name}`
    })
    if (team.gk) out += `\n  🧤 ${team.gk.name}`
  })
  if (draw.leftover && draw.leftover.length > 0) {
    out += '\n\n📋 *Fora do sorteio:* ' + draw.leftover.map(p => p.name).join(', ')
  }
  if (draw.gkLeftover && draw.gkLeftover.length > 0) {
    out += '\n🧤 *Goleiros extras:* ' + draw.gkLeftover.map(p => p.name).join(', ')
  }
  return out
}

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['lista', 'listas', 'ls'],
  desc: 'Cria e gerencia listas (ex.: pelada): entrar, sair, reservas e sorteio de times.',
  example: 'eu',
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: false,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false, // open; admin subcommands are gated internally on isGroupAdmin
  onlyVip: false,
  botMustBeAdmin: false,
  interval: 0,
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

    const params = body
      .slice(command.needsPrefix ? 1 : 0)
      .replace(new RegExp(`^${alias}\\s*`, 'i'), '')
    const parsed = params.match(/^(\S+)\s*([\s\S]*)$/)
    const sub = (parsed?.[1] || '').toLowerCase()
    const argText = (parsed?.[2] || '').trim()

    const senderName = message.pushName || 'Jogador'

    const requireAdmin = async (): Promise<boolean> => {
      if (!isGroupAdmin) {
        await sendMessage({ text: `⚠ Só *administradores do grupo* podem usar \`!lista ${sub}\`.` }, message)
        return false
      }
      return true
    }

    try {
      // Create a list from a pasted/quoted model (admin)
      if (sub === 'criar' || sub === 'create') {
        if (!await requireAdmin()) return
        const modelText = getQuotedText(message) || argText
        if (!modelText.trim()) {
          return await sendMessage(
            {
              text: '⚠ Responda à mensagem do modelo (ou cole junto) com `!lista criar`.\n' +
                'O bot lê o título, o horário, as vagas e a seção de goleiros.'
            },
            message
          )
        }
        const template = parseListTemplate(modelText)
        if (!template) {
          return await sendMessage(
            { text: '⚠ Não entendi o modelo. Use o formato numerado (`1 - `, `2 - `, ...).' },
            message
          )
        }
        const created = await createList(jid, template, sender, true)
        await react(message, getRandomItemFromArray(emojis.success))
        return await sendMessage({ text: await renderList(created) }, message)
      }

      // Start a fresh week from the current structure (admin)
      if (sub === 'nova' || sub === 'new' || sub === 'limpar') {
        if (!await requireAdmin()) return
        const active = await getActiveList(jid)
        if (!active) {
          return await sendMessage({ text: '⚠ Não há lista pra renovar. Crie com `!lista criar`.' }, message)
        }
        const created = await createList(
          jid,
          {
            title: active.title,
            subtitle: active.subtitle,
            mainCap: active.mainCap,
            gkLabel: active.gkLabel,
            gkCap: active.gkCap,
            mainNames: [],
            gkNames: []
          },
          sender,
          false
        )
        await react(message, getRandomItemFromArray(emojis.success))
        return await sendMessage({ text: '🆕 Lista nova!\n\n' + await renderList(created) }, message)
      }

      // Everything below needs an active list
      const list = await getActiveList(jid)
      if (!list) {
        return await sendMessage(
          { text: '📭 Nenhuma lista ativa. Um *admin do grupo* cria com `!lista criar`.' },
          message
        )
      }

      // Show
      if (sub === '' || sub === 'ver' || sub === 'show' || sub === 'lista') {
        return await sendMessage({ text: await renderList(list) }, message)
      }

      const isMutating = ['eu', 'entrar', 'vou', 'gol', 'goleiro', 'add', 'adicionar', 'sair', 'fora'].includes(sub)
      if (isMutating && list.status === 'closed') {
        return await sendMessage({ text: '🔒 A lista está *fechada* no momento.' }, message)
      }

      // Join the main list — sender if no name, guest if a name is given
      if (sub === 'eu' || sub === 'entrar' || sub === 'vou') {
        const j = resolveJoiner(argText, sender, senderName)
        const res = await joinList(list, SECTION_MAIN, j.name, j.jid, j.addedBy)
        return await replyJoin(message, res, j.name, list.mainCap)
      }

      // Join as goalkeeper — sender if no name, guest goalkeeper if a name is given
      if (sub === 'gol' || sub === 'goleiro') {
        const j = resolveJoiner(argText, sender, senderName)
        const res = await joinList(list, SECTION_GK, j.name, j.jid, j.addedBy)
        if (res.status === 'gk_full') {
          return await sendMessage(
            { text: `🧤 Goleiros lotado (${list.gkCap}/${list.gkCap}). Entre na linha com \`!lista eu\`.` },
            message
          )
        }
        if (res.status === 'dup') {
          return await sendMessage({ text: 'ℹ️ Você já está na lista.' }, message)
        }
        await react(message, getRandomItemFromArray(emojis.success))
        return await sendMessage({ text: `🧤 *${j.name}* entrou como goleiro! (${res.position}/${list.gkCap})` }, message)
      }

      // Add a guest to the main list
      if (sub === 'add' || sub === 'adicionar') {
        if (!argText) {
          return await sendMessage({ text: '⚠ Informe o nome. Ex: `!lista add Primo do Bruno`' }, message)
        }
        const res = await joinList(list, SECTION_MAIN, argText, null, senderName)
        return await replyJoin(message, res, argText, list.mainCap)
      }

      // Leave the list
      if (sub === 'sair' || sub === 'fora') {
        const res = await leaveList(list, sender)
        if (!res.ok) {
          return await sendMessage({ text: 'ℹ️ Você não está na lista.' }, message)
        }
        await react(message, getRandomItemFromArray(emojis.success))
        if (res.promoted) await notifyPromotion(message, res.promoted)
        return undefined
      }

      // Mark / unmark presence — self (no arg), by line position, or "gol <nº>".
      // Anyone can mark (collaborative); works even when the list is closed.
      if (sub === 'presente' || sub === 'cheguei' || sub === 'falta' || sub === 'ausente') {
        const present = sub === 'presente' || sub === 'cheguei'
        const gkMatch = argText.match(/^(gol|goleiro)\s+(\d+)$/i)
        let affected: EntryRow | null = null
        if (!argText) {
          affected = await markPresenceByJid(list, sender, present)
          if (!affected) {
            return await sendMessage(
              { text: 'ℹ️ Você não está na lista. Entre com `!lista eu` primeiro.' },
              message
            )
          }
        } else if (gkMatch) {
          affected = await markPresenceByPosition(list, SECTION_GK, parseInt(gkMatch[2]), present)
          if (!affected) {
            return await sendMessage({ text: `⚠ Goleiro *${gkMatch[2]}* não encontrado.` }, message)
          }
        } else {
          const n = parseInt(argText)
          if (isNaN(n)) {
            return await sendMessage(
              { text: '⚠ Use `!lista presente`, `!lista presente <nº>` ou `!lista presente gol <nº>`.' },
              message
            )
          }
          affected = await markPresenceByPosition(list, SECTION_MAIN, n, present)
          if (!affected) {
            return await sendMessage({ text: `⚠ Posição *${n}* não encontrada.` }, message)
          }
        }
        if (!affected) return
        await react(message, getRandomItemFromArray(emojis.success))
        const count = await getPresentCount(list)
        const status = present ? `✅ presente (${count} no total)` : '⬜ ausente'
        return await sendMessage({ text: `*${affected.name}* — ${status}.` }, message)
      }

      // Remove someone by position (admin) — line by default, "gol <nº>" for goalkeepers
      if (sub === 'remover' || sub === 'remove' || sub === 'rm') {
        if (!await requireAdmin()) return
        const gkMatch = argText.match(/^(gol|goleiro)\s+(\d+)$/i)
        const section = gkMatch ? SECTION_GK : SECTION_MAIN
        const position = parseInt(gkMatch ? gkMatch[2] : argText)
        if (isNaN(position)) {
          return await sendMessage(
            { text: '⚠ Informe a posição. Ex: `!lista remover 3` ou `!lista remover gol 1`.' },
            message
          )
        }
        const res = await removeByPosition(list, position, section)
        if (!res.ok) {
          const where = section === SECTION_GK ? 'nos goleiros' : 'na linha'
          return await sendMessage({ text: `⚠ Posição *${position}* não encontrada ${where}.` }, message)
        }
        await react(message, getRandomItemFromArray(emojis.success))
        if (res.promoted) await notifyPromotion(message, res.promoted)
        return await sendMessage({ text: `🗑️ *${res.removed?.name}* removido.` }, message)
      }

      // Open / close the list (admin)
      if (sub === 'fechar' || sub === 'close' || sub === 'abrir' || sub === 'open') {
        if (!await requireAdmin()) return
        const closing = sub === 'fechar' || sub === 'close'
        await setListStatus(list.id, closing ? 'closed' : 'open')
        return await sendMessage({ text: closing ? '🔒 Lista fechada.' : '🔓 Lista reaberta.' }, message)
      }

      // Draw teams (admin) — present-only by default, "todos" includes everyone
      if (sub === 'sortear' || sub === 'sorteio' || sub === 'times') {
        if (!await requireAdmin()) return
        const tokens = argText.split(/\s+/).filter(Boolean)
        const all = tokens.some(t => ['todos', 'todas', 'all', 'geral', 'tudo'].includes(t.toLowerCase()))
        const sizeToken = tokens.find(t => /^\d+$/.test(t))
        const size = sizeToken ? parseInt(sizeToken) : NaN
        if (isNaN(size) || size < 1) {
          return await sendMessage(
            { text: '⚠ Informe o tamanho do time. Ex: `!lista sortear 5` ou `!lista sortear 5 todos`.' },
            message
          )
        }
        const draw = await drawTeams(list, size, !all)
        if (!draw.ok) {
          let text: string
          if (draw.error === 'nopresence') {
            text = '⚠ Ninguém marcou presença ainda. Marque com `!lista presente` ' +
              `ou sorteie todos com \`!lista sortear ${size} todos\`.`
          } else if (draw.error === 'few') {
            text = `⚠ Jogadores ${all ? '' : 'presentes '}insuficientes para um time de ${size}.`
          } else {
            text = '⚠ Tamanho de time inválido.'
          }
          return await sendMessage({ text }, message)
        }
        return await sendMessage({ text: renderDraw(draw, size, all) }, message)
      }

      // Unknown subcommand
      return await sendMessage({ text: usage }, message)
    } catch (error) {
      logger.error(`Error in ${commandName}: ${error}`)
      await react(message, emojis.error)
      return await sendMessage({ text: '⚠ Ocorreu um erro ao gerenciar a lista.' }, message)
    }
  }
}
