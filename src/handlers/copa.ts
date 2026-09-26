import axios from 'axios'
import { JSDOM } from 'jsdom'
import UserAgent from 'user-agents'

import { FIFA_RANKING, TEAMS } from '../data/copa2026'
import { spintax } from '../utils/misc'
import { getLogger } from './logger'

const logger = getLogger()

// musa-soccer / Terra — Copa 2026. Tudo (times, datas, sedes, placares, status) é puxado ao vivo
// da API; o dataset estático só fornece bandeiras (TEAMS) e ranking FIFA (palpite).
const CHAMPIONSHIP = '1451'
const PHASES: Array<{ id: string; stage: string }> = [
  { id: '6770', stage: 'Fase de Grupos' },
  { id: '6771', stage: '16-avos' },
  { id: '6772', stage: 'Oitavas' },
  { id: '6773', stage: 'Quartas' },
  { id: '6774', stage: 'Semifinal' },
  { id: '6775', stage: '3º lugar' },
  { id: '6776', stage: 'Final' }
]

type Status = 'scheduled' | 'live' | 'finished'
interface LiveScore { home: number; away: number }
export interface CopaMatch {
  id: string
  stage: string
  home: string        // código do time (TEAMS) ou 'TBD'
  away: string
  homeName: string    // nome vindo do feed (fallback quando não há bandeira)
  awayName: string
  kickoff: string     // ISO em BRT
  venue: string
  score: LiveScore | null
}
interface MatchView { match: CopaMatch; status: Status }

// ~tempo de jogo (90' + intervalo + acréscimos) para a janela "ao vivo"
const LIVE_WINDOW_MS = 150 * 60 * 1000
const CACHE_TTL_MS = 60 * 1000

interface CacheEntry { at: number; matches: CopaMatch[] }
let cache: CacheEntry | null = null

// "Qui 11/06 16h00" + "2026-06-11" -> ISO BRT '2026-06-11T16:00:00-03:00'
const buildKickoff = (date: string, timeText: string): string => {
  const m = timeText.match(/(\d{1,2})h(\d{2})/)
  const hh = m ? m[1].padStart(2, '0') : '00'
  const mm = m ? m[2] : '00'
  return `${date}T${hh}:${mm}:00-03:00`
}

const normalize = (s: string): string =>
  s.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase().trim()

// O feed do mata-mata traz o NOME do time, mas nem sempre a sigla — resolvemos o código
// (chave de TEAMS, p/ bandeira e ranking) pelo nome quando a sigla vier vazia/desconhecida.
const CODE_BY_NAME: Record<string, string> = {}
for (const c of Object.keys(TEAMS)) CODE_BY_NAME[normalize(TEAMS[c].name)] = c

const resolveCode = (acronym: string, name: string): string => {
  if (acronym && TEAMS[acronym]) return acronym
  return CODE_BY_NAME[normalize(name)] || acronym || 'TBD'
}

// Busca e parseia uma fase do feed da Terra (mesmo padrão do brasileirao.ts). Nunca lança.
const fetchPhase = async (phase: { id: string; stage: string }): Promise<CopaMatch[]> => {
  try {
    const url = `https://p1.trrsf.com/api/musa-soccer/ms-standings-games-light` +
      `?idChampionship=${CHAMPIONSHIP}&idPhase=${phase.id}&language=pt-BR&country=BR&nav=N&timezone=BR`
    const userAgent = new UserAgent()
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': userAgent.toString() },
      timeout: 12000
    })
    const { document } = new JSDOM(data).window
    const out: CopaMatch[] = []

    document.querySelectorAll('li.match').forEach(node => {
      const nameMeta = node.querySelector('meta[itemprop="name"]')?.getAttribute('content')?.trim() || ''
      const parts = nameMeta.split(' x ')
      const homeName = (parts[0] || '').trim()
      const awayName = (parts[1] || '').trim()
      const date = node.querySelector('meta[itemprop="startDate"]')?.getAttribute('content')?.trim() || ''
      const timeText = node.querySelector('.date-manager')?.textContent?.trim() || ''
      const venue = node.querySelector('.stadium')?.textContent?.trim() || ''
      const homeCode = node.querySelector('.shield.home .acronym')?.textContent?.trim() || ''
      const awayCode = node.querySelector('.shield.away .acronym')?.textContent?.trim() || ''
      const hg = node.querySelector('.goals.home')?.textContent?.trim()
      const ag = node.querySelector('.goals.away')?.textContent?.trim()
      if (!date || (!homeName && !homeCode)) return

      const home = resolveCode(homeCode, homeName)
      const away = resolveCode(awayCode, awayName)
      const decided = home !== 'TBD' && away !== 'TBD'
      out.push({
        id: decided
          ? `${home}-${away}-${date}`
          : `${normalize(homeName)}-${normalize(awayName)}-${date}`,
        stage: phase.stage,
        home,
        away,
        homeName,
        awayName,
        kickoff: buildKickoff(date, timeText),
        venue,
        score: (hg && ag) ? { home: Number(hg), away: Number(ag) } : null
      })
    })

    return out
  } catch (error) {
    logger.error(`[COPA] Falha ao buscar fase ${phase.id}: ${error}`)
    return []
  }
}

// Todos os jogos (todas as fases), ao vivo + cache. Degrada pro cache velho em falha total.
const getAllMatches = async (): Promise<CopaMatch[]> => {
  if (cache && (Date.now() - cache.at) < CACHE_TTL_MS) return cache.matches
  const results = await Promise.all(PHASES.map(p => fetchPhase(p)))
  const matches = results.flat()
  if (matches.length) {
    cache = { at: Date.now(), matches }
    return matches
  }
  return cache?.matches ?? []
}

const statusFor = (match: CopaMatch, now: number): Status => {
  const start = new Date(match.kickoff).getTime()
  if (isNaN(start) || now < start) return 'scheduled'
  if (now >= start + LIVE_WINDOW_MS) return 'finished'
  return 'live'
}

const sortByKickoff = (a: CopaMatch, b: CopaMatch): number =>
  new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()

const buildViews = async (): Promise<MatchView[]> => {
  const now = Date.now()
  const matches = [...(await getAllMatches())].sort(sortByKickoff)
  return matches.map(match => ({ match, status: statusFor(match, now) }))
}

// ---------------------------------------------------------------------------
// Apresentação
// ---------------------------------------------------------------------------

const teamLabel = (code: string, name: string): string => {
  const team = TEAMS[code]
  if (team) return `${team.flag} ${team.name}`
  return name || 'A definir'
}

const fmtTime = (kickoff: string): string =>
  new Date(kickoff).toLocaleString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo'
  })

const fmtDayHeader = (kickoff: string): string =>
  new Date(kickoff).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo'
  })

const formatLine = (view: MatchView): string => {
  const { match, status } = view
  const home = teamLabel(match.home, match.homeName)
  const away = teamLabel(match.away, match.awayName)
  const middle = match.score ? `*${match.score.home} x ${match.score.away}*` : 'x'
  const tag = status === 'live' ? '🔴' : status === 'finished' ? '✅' : '🕒'
  const when = status === 'finished' ? '' : ` ${fmtTime(match.kickoff)}`
  return `${tag}${when} ${home} ${middle} ${away}`
}

const groupByDay = (views: MatchView[], header: string): string => {
  let out = header
  let currentDay = ''
  for (const view of views) {
    const day = view.match.kickoff.slice(0, 10)
    if (day !== currentDay) {
      currentDay = day
      out += `\n\n📅 *${fmtDayHeader(view.match.kickoff)}*`
    }
    out += `\n${formatLine(view)}`
  }
  return out
}

// Todos os jogos, agrupados por dia.
export const renderAll = async (): Promise<string> => {
  const views = await buildViews()
  if (!views.length) return '⚽ Não consegui buscar os jogos da Copa agora. Tente de novo em instantes.'
  return groupByDay(views, '⚽ *Copa do Mundo 2026 — Tabela de jogos*') +
    '\n\n_Use_ `!copa proximo` _ou_ `!copa palpite`'
}

// Próximos jogos: ao vivo + agendados, em ordem.
export const renderNext = async (limit = 10): Promise<string> => {
  const views = (await buildViews()).filter(v => v.status !== 'finished')
  if (!views.length) return '⚽ Não há mais jogos futuros na Copa 2026.'
  return groupByDay(views.slice(0, limit), '⚽ *Copa 2026 — Próximos jogos*')
}

// Jogo atual (ao vivo) + o próximo agendado.
export const renderCurrent = async (): Promise<string> => {
  const views = await buildViews()
  const live = views.filter(v => v.status === 'live')
  const next = views.find(v => v.status === 'scheduled')

  let out = ''
  if (live.length > 0) {
    out += '🔴 *Agora na Copa 2026*\n' + live.map(formatLine).join('\n')
  }
  if (next) {
    if (out) out += '\n\n'
    out += `🕒 *Próximo jogo* — ${fmtDayHeader(next.match.kickoff)}\n${formatLine(next)}`
  }
  if (!out) {
    out = views.length
      ? '⚽ Nenhum jogo ao vivo ou agendado no momento (Copa encerrada?).'
      : '⚽ Não consegui buscar os jogos da Copa agora. Tente de novo em instantes.'
  }
  return out
}

// ---------------------------------------------------------------------------
// Palpite (ranking FIFA — determinístico por confronto)
// ---------------------------------------------------------------------------

const hashStr = (s: string): number => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const HOSTS = ['EUA', 'CAN', 'MEX']

export const buildPalpite = (match: CopaMatch): string => {
  const home = teamLabel(match.home, match.homeName)
  const away = teamLabel(match.away, match.awayName)
  if (match.home === 'TBD' || match.away === 'TBD') {
    return `🔮 ${home} x ${away} ainda não está definido — volto a palpitar quando os times forem conhecidos!`
  }

  const rankHome = FIFA_RANKING[match.home] ?? 60
  const rankAway = FIFA_RANKING[match.away] ?? 60
  const seed = hashStr(match.home + match.away + match.id)
  const diff = rankAway - rankHome // > 0 => mandante é favorito (ranking menor é melhor)

  let gh = 1
  let ga = 1
  if (diff >= 0) {
    gh += Math.min(2, Math.floor(diff / 15)) + (seed % 2)
    ga = (seed >> 2) % 2
  } else {
    ga += Math.min(2, Math.floor(-diff / 15)) + ((seed >> 1) % 2)
    gh = (seed >> 2) % 2
  }
  if (HOSTS.includes(match.home)) gh += (seed % 2)
  if (HOSTS.includes(match.away)) ga += ((seed >> 1) % 2)
  gh = Math.min(gh, 4)
  ga = Math.min(ga, 4)

  const flavor = spintax('{Meu palpite|Acho que vai ser|Cravo|Aposto em}')
  const scoreLine = match.score ? `\n_(placar atual: ${match.score.home} x ${match.score.away})_` : ''
  return `🔮 *Palpite do bot*\n${home} *${gh} x ${ga}* ${away}\n_${flavor} — baseado no ranking FIFA._${scoreLine}`
}

const teamMatchesQuery = (match: CopaMatch, q: string): boolean => {
  if (match.home.toLowerCase() === q || match.away.toLowerCase() === q) return true
  const homeName = TEAMS[match.home]?.name || match.homeName
  const awayName = TEAMS[match.away]?.name || match.awayName
  return normalize(homeName).includes(q) || normalize(awayName).includes(q)
}

// Acha o jogo de uma seleção pedida (por nome/código): prioriza ao vivo/agendado, senão o último.
export const findMatchByQuery = async (query: string): Promise<CopaMatch | null> => {
  const q = normalize(query)
  if (!q) return null
  const views = await buildViews()
  const upcoming = views.find(v => v.status !== 'finished' && teamMatchesQuery(v.match, q))
  if (upcoming) return upcoming.match
  const recent = [...views].reverse().find(v => teamMatchesQuery(v.match, q))
  return recent ? recent.match : null
}

// Alvo do palpite: o jogo ao vivo, senão o próximo agendado.
export const palpiteTarget = async (): Promise<CopaMatch | null> => {
  const views = await buildViews()
  const live = views.find(v => v.status === 'live')
  if (live) return live.match
  const next = views.find(v => v.status === 'scheduled')
  return next ? next.match : null
}
