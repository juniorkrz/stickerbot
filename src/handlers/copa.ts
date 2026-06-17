import axios from 'axios'
import { JSDOM } from 'jsdom'
import UserAgent from 'user-agents'

import { CopaMatch, FIFA_RANKING, MATCHES, TEAMS } from '../data/copa2026'
import { spintax } from '../utils/misc'
import { getLogger } from './logger'

const logger = getLogger()

// musa-soccer / Terra — Copa 2026
const CHAMPIONSHIP = '1451'
const GROUP_PHASE = '6770'
const PHASE_BY_STAGE: Record<string, string> = {
  '16-avos': '6771',
  'Oitavas': '6772',
  'Quartas': '6773',
  'Semifinal': '6774',
  '3º lugar': '6775',
  'Final': '6776'
}
const phaseIdFor = (stage: string): string =>
  stage.startsWith('Grupo') ? GROUP_PHASE : (PHASE_BY_STAGE[stage] || GROUP_PHASE)

type Status = 'scheduled' | 'live' | 'finished'
interface LiveScore { home: number; away: number }
interface MatchView { match: CopaMatch; status: Status; score: LiveScore | null }

// ~tempo de jogo (90' + intervalo + acréscimos) para a janela "ao vivo"
const LIVE_WINDOW_MS = 150 * 60 * 1000
const CACHE_TTL_MS = 60 * 1000

const scoreKey = (home: string, away: string, date: string): string => `${home}|${away}|${date}`

interface CacheEntry { at: number; scores: Map<string, LiveScore> }
const phaseCache = new Map<string, CacheEntry>()

// Busca o placar de uma fase no feed keyless da Terra (mesmo padrão do brasileirao.ts).
const fetchPhaseScores = async (phaseId: string): Promise<Map<string, LiveScore>> => {
  const url = `https://p1.trrsf.com/api/musa-soccer/ms-standings-games-light` +
    `?idChampionship=${CHAMPIONSHIP}&idPhase=${phaseId}&language=pt-BR&country=BR&nav=N&timezone=BR`
  const userAgent = new UserAgent()
  const { data } = await axios.get(url, {
    headers: { 'User-Agent': userAgent.toString() },
    timeout: 12000
  })
  const { document } = new JSDOM(data).window
  const map = new Map<string, LiveScore>()

  document.querySelectorAll('li.match').forEach(node => {
    const home = node.querySelector('.shield.home .acronym')?.textContent?.trim()
    const away = node.querySelector('.shield.away .acronym')?.textContent?.trim()
    const date = node.querySelector('meta[itemprop="startDate"]')?.getAttribute('content')?.trim()
    const hg = node.querySelector('.goals.home')?.textContent?.trim()
    const ag = node.querySelector('.goals.away')?.textContent?.trim()
    if (home && away && date && hg && ag) {
      map.set(scoreKey(home, away, date), { home: Number(hg), away: Number(ag) })
    }
  })

  return map
}

// Cache em memória por fase; nunca lança (degrada pra cache velho/vazio).
const getPhaseScores = async (phaseId: string): Promise<Map<string, LiveScore>> => {
  const cached = phaseCache.get(phaseId)
  if (cached && (Date.now() - cached.at) < CACHE_TTL_MS) return cached.scores
  try {
    const scores = await fetchPhaseScores(phaseId)
    phaseCache.set(phaseId, { at: Date.now(), scores })
    return scores
  } catch (error) {
    logger.error(`[COPA] Falha ao buscar placar da fase ${phaseId}: ${error}`)
    return cached?.scores ?? new Map()
  }
}

const statusFor = (match: CopaMatch, now: number): Status => {
  const start = new Date(match.kickoff).getTime()
  if (isNaN(start)) return 'scheduled'
  if (now < start) return 'scheduled'
  if (now >= start + LIVE_WINDOW_MS) return 'finished'
  return 'live'
}

// Constrói as views (status + placar) de um conjunto de jogos, buscando só as fases necessárias.
const buildViews = async (matches: CopaMatch[]): Promise<MatchView[]> => {
  const now = Date.now()
  const phaseIds = [...new Set(matches.map(m => phaseIdFor(m.stage)))]
  const byPhase = new Map<string, Map<string, LiveScore>>()
  await Promise.all(phaseIds.map(async pid => {
    byPhase.set(pid, await getPhaseScores(pid))
  }))

  return matches.map(match => {
    const scores = byPhase.get(phaseIdFor(match.stage)) ?? new Map<string, LiveScore>()
    const date = match.kickoff.slice(0, 10)
    const score = (match.home !== 'TBD' && match.away !== 'TBD')
      ? (scores.get(scoreKey(match.home, match.away, date)) ?? null)
      : null
    return { match, status: statusFor(match, now), score }
  })
}

// ---------------------------------------------------------------------------
// Apresentação
// ---------------------------------------------------------------------------

const teamLabel = (code: string, label?: string): string => {
  if (code === 'TBD') return label || 'A definir'
  const team = TEAMS[code]
  return team ? `${team.flag} ${team.name}` : code
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
  const { match, status, score } = view
  const home = teamLabel(match.home, match.homeLabel)
  const away = teamLabel(match.away, match.awayLabel)
  const middle = score ? `*${score.home} x ${score.away}*` : 'x'
  const tag = status === 'live' ? '🔴' : status === 'finished' ? '✅' : '🕒'
  const when = status === 'finished' && score ? '' : ` ${fmtTime(match.kickoff)}`
  return `${tag}${when} ${home} ${middle} ${away}`
}

const sortByKickoff = (a: CopaMatch, b: CopaMatch): number =>
  new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()

// Lista todos os jogos, agrupados por dia.
export const renderAll = async (): Promise<string> => {
  const views = await buildViews([...MATCHES].sort(sortByKickoff))
  let out = '⚽ *Copa do Mundo 2026 — Tabela de jogos*'
  let currentDay = ''
  for (const view of views) {
    const day = view.match.kickoff.slice(0, 10)
    if (day !== currentDay) {
      currentDay = day
      out += `\n\n📅 *${fmtDayHeader(view.match.kickoff)}*`
    }
    out += `\n${formatLine(view)}`
  }
  out += '\n\n_Use_ `!copa proximo` _ou_ `!copa palpite`'
  return out
}

// Próximos jogos: ao vivo agora + agendados, em ordem.
export const renderNext = async (limit = 10): Promise<string> => {
  const upcoming = [...MATCHES].sort(sortByKickoff)
  const views = (await buildViews(upcoming)).filter(v => v.status !== 'finished')
  if (views.length === 0) return '⚽ Não há jogos futuros na Copa 2026 (torneio encerrado?).'
  const slice = views.slice(0, limit)
  let out = '⚽ *Copa 2026 — Próximos jogos*'
  let currentDay = ''
  for (const view of slice) {
    const day = view.match.kickoff.slice(0, 10)
    if (day !== currentDay) {
      currentDay = day
      out += `\n\n📅 *${fmtDayHeader(view.match.kickoff)}*`
    }
    out += `\n${formatLine(view)}`
  }
  return out
}

// Jogo atual (ao vivo) + o próximo agendado.
export const renderCurrent = async (): Promise<string> => {
  const views = await buildViews([...MATCHES].sort(sortByKickoff))
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
  if (!out) out = '⚽ Nenhum jogo ao vivo ou agendado no momento.'
  return out
}

// ---------------------------------------------------------------------------
// Palpite (baseado no ranking FIFA — determinístico por confronto)
// ---------------------------------------------------------------------------

const hashStr = (s: string): number => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const HOSTS = ['EUA', 'CAN', 'MEX']

export const buildPalpite = (match: CopaMatch): string => {
  const home = teamLabel(match.home, match.homeLabel)
  const away = teamLabel(match.away, match.awayLabel)
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
  return `🔮 *Palpite do bot*\n${home} *${gh} x ${ga}* ${away}\n_${flavor} — baseado no ranking FIFA._`
}

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g')
const normalize = (s: string): string =>
  s.normalize('NFD').replace(DIACRITICS, '').toLowerCase().trim()

const teamMatchesQuery = (code: string, q: string): boolean => {
  if (code === 'TBD') return false
  if (code.toLowerCase() === q) return true
  const team = TEAMS[code]
  return team ? normalize(team.name).includes(q) : false
}

// Acha o jogo de uma seleção pedida (por nome ou código): prioriza ao vivo/agendado, senão o último.
export const findMatchByQuery = async (query: string): Promise<CopaMatch | null> => {
  const q = normalize(query)
  if (!q) return null
  const views = await buildViews([...MATCHES].sort(sortByKickoff))
  const upcoming = views.find(v => v.status !== 'finished' &&
    (teamMatchesQuery(v.match.home, q) || teamMatchesQuery(v.match.away, q)))
  if (upcoming) return upcoming.match
  const recent = [...views].reverse().find(v =>
    teamMatchesQuery(v.match.home, q) || teamMatchesQuery(v.match.away, q))
  return recent ? recent.match : null
}

// Acha o jogo-alvo do palpite: o ao vivo, senão o próximo agendado.
export const palpiteTarget = async (): Promise<CopaMatch | null> => {
  const sorted = [...MATCHES].sort(sortByKickoff)
  const views = await buildViews(sorted)
  const live = views.find(v => v.status === 'live')
  if (live) return live.match
  const next = views.find(v => v.status === 'scheduled')
  return next ? next.match : null
}
