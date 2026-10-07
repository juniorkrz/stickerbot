import moment from 'moment'

import { bot } from '../config'
import { colors } from '../utils/colors'

export interface LogEntry {
  id: number
  ts: number
  level: string
  message: string
}

// Últimas linhas de log em memória, para o painel (Sistema > Logs)
const LOG_BUFFER_SIZE = 2000
const logBuffer: LogEntry[] = []
const logListeners = new Set<(entry: LogEntry) => void>()
let logSeq = 0

// eslint-disable-next-line no-control-regex
const stripAnsi = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, '')

export const getLogBuffer = (): LogEntry[] => logBuffer

export const onLog = (listener: (entry: LogEntry) => void): (() => void) => {
  logListeners.add(listener)
  return () => logListeners.delete(listener)
}

class Logger {
  private readonly prefix: string

  constructor(prefix: string) {
    this.prefix = prefix
  }

  private log(message: string, level: string, colorCode: string): void {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss')
    const msgColor = colorCode == colors.blue ? colors.reset : colorCode
    console.log(`[${timestamp}] ${colorCode}[${level.toUpperCase()}]` +
      `${colors.reset} ${this.prefix}: ${msgColor}${message}${colors.reset}`)

    const entry: LogEntry = { id: ++logSeq,
      ts: Date.now(),
      level,
      message: stripAnsi(String(message)) }
    logBuffer.push(entry)
    if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift()
    for (const listener of logListeners) {
      try {
        listener(entry)
      } catch {
        // um listener com erro não pode derrubar o log
      }
    }
  }

  public info(message: string): void {
    this.log(message, 'info', colors.blue) // 34m is blue
  }

  public warn(message: string): void {
    this.log(message, 'warn', colors.yellow) // 33m is yellow
  }

  public error(message: string): void {
    this.log(message, 'error', colors.red) // 31m is red
  }
}

const logger = new Logger(bot.name)

export const getLogger = () => {
  return logger
}
