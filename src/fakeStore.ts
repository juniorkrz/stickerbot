import { WAMessage } from '@whiskeysockets/baileys'

class MessageCollection {
  public messages: WAMessage[] = []

  add(message: WAMessage) {
    this.messages.push(message)
  }

  get(id: string): WAMessage | undefined {
    return undefined
  }

  getAll(): WAMessage[] {
    return this.messages
  }

  // Mais métodos se quiser: findByRemoteJid, clear, etc.
}

class FakeStore {
  public messages: { [remoteJid: string]: MessageCollection } = {}
  public chats: string[] = []

  get(): void {
    // nada aqui ainda
  }
}

export default new FakeStore()
