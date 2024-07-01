export interface SenderUsage {
  uses: number
  lastUse: number
  senderAlerted: boolean
  shouldAlertSender: boolean
  isSenderRateLimited: boolean
}
