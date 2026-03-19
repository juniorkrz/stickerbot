import { WAMessage } from '@whiskeysockets/baileys'
import fs from 'fs'

export class SimpleStore {
  messages: { [jid: string]: { get: (id: string) => WAMessage | undefined, set: (id: string, msg: WAMessage) => void, delete: (id: string) => void, array: WAMessage[] } } = {}
  chats: any[] = []

  bind(ev: any) {
    ev.on('messages.upsert', (arg: any) => {
      const messages: WAMessage[] = arg.messages
      for (const msg of messages) {
        const jid = msg.key.remoteJid
        if (!jid) continue
        if (!this.messages[jid]) {
           const map = new Map<string, WAMessage>()
           this.messages[jid] = {
             get: (id) => map.get(id),
             set: (id, m) => { 
                map.set(id, m)
                if (map.size > 500) map.delete(map.keys().next().value!)
             },
             delete: (id) => map.delete(id),
             get array() { return Array.from(map.values()) }
           }
        }
        if (msg.key.id) this.messages[jid].set(msg.key.id, msg)
      }
    })
  }

  writeToFile(path: string) {
    // minimalist or no-op since it's an in-memory ephemeral store for the bot
  }

  readFromFile(path: string) {
    // no-op
  }
}

export const makeInMemoryStore = () => new SimpleStore()
