import moment from 'moment'

import { bot } from '../config'
import { colors } from '../utils/colors'

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
