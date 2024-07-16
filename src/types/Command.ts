import { GroupMetadata, proto, WAMessage } from '@whiskeysockets/baileys'

interface LimiterEntry {
  lastPrompt: number
  alerted: boolean
}

export interface CommandLimiter {
  [sender: string]: LimiterEntry
}

export interface CommandRunFunction {
  (
    jid: string,
    sender: string,
    message: WAMessage,
    alias: string,
    body: string,
    group: GroupMetadata | undefined,
    isBotAdmin: boolean,
    isVip: boolean,
    isGroupAdmin: boolean,
    amAdmin: boolean
  ): Promise<proto.WebMessageInfo | undefined>
}

export interface StickerBotCommand {
  name: string
  aliases: string[]
  desc: string
  example?: string
  needsPrefix: boolean
  inMaintenance: boolean
  runInPrivate: boolean
  runInGroups: boolean
  onlyInBotGroup: boolean
  onlyBotAdmin: boolean
  onlyAdmin: boolean
  onlyVip: boolean
  botMustBeAdmin: boolean
  interval: number
  limiter: CommandLimiter
  run: CommandRunFunction
}

export interface CommandActions {
  [key: string]: StickerBotCommand
}
