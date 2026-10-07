import { bot } from '../config'
import { getLogger } from '../handlers/logger'

const logger = getLogger()

// Converte 'HH:MM,HH:MM' em pares [hora, minuto] (entradas inválidas são descartadas).
const parseTimes = (raw: string): Array<[number, number]> =>
  raw.split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => t.split(':').map(n => parseInt(n, 10)) as [number, number])
    .filter(([h, m]) => Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h < 24 && m >= 0 && m < 60)

// Agenda reinícios diários: em cada horário configurado o processo faz exit(0) e a política de
// restart do Docker (unless-stopped/always) o religa. Dispensa systemd/cron.
// Configurável via SB_RESTART_TIMES (separado por vírgula, ex.: '02:00' ou '02:00,14:00'). Vazio = desativado.
// O container roda em America/Sao_Paulo, então os horários são em BRT.
export const scheduleAutoRestart = (): void => {
  const times = parseTimes(bot.restartTimes)
  const pad = (n: number): string => String(n).padStart(2, '0')
  if (!times.length) {
    logger.info('[RESTART] Auto-restart desativado (SB_RESTART_TIMES vazio)')
  } else {
    const label = times.map(([h, m]) => `${pad(h)}:${pad(m)}`).join(', ')
    logger.info(`[RESTART] Auto-restart diário agendado (BRT): ${label}`)
  }

  let lastFired = ''
  setInterval(() => {
    // relê a cada checagem: o horário pode ser alterado pelo painel sem reiniciar
    const times = parseTimes(bot.restartTimes)
    const now = new Date()
    const key = `${pad(now.getHours())}:${pad(now.getMinutes())}`
    const due = times.some(([h, m]) => h === now.getHours() && m === now.getMinutes())
    if (due && lastFired !== key) {
      lastFired = key
      logger.info(`[RESTART] Reinício programado (${key}) — encerrando para o Docker religar...`)
      process.exit(0)
    }
  }, 30 * 1000)
}
