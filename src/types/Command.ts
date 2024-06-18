import { WAMessage } from '@whiskeysockets/baileys'

interface LimiterEntry {
    lastPrompt: number
    alerted: boolean
}

interface CommandLimiter {
    [sender: string]: LimiterEntry
}

export interface CommandRunFunction {
    (message: WAMessage, alias: string): Promise<any>
}

export interface StickerBotCommand {
    name: string,
    aliases: string[],
    desc?: (string | null),
    example: (string | boolean),
    needsPrefix: boolean,
    inMaintenance: boolean,
    runInPrivate: boolean,
    runInGroups: boolean,
    onlyInBotGroup: boolean,
    onlyBotAdmin: boolean,
    onlyAdmin: boolean,
    botMustBeAdmin: boolean,
    interval: number,
    limiter: CommandLimiter,
    run: CommandRunFunction
}