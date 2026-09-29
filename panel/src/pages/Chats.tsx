import clsx from 'clsx'
import { MessagesSquare } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { ChatList } from '../components/chat/ChatList'
import { ChatView } from '../components/chat/ChatView'
import { InfoPanel } from '../components/chat/InfoPanel'
import { useAuth } from '../lib/auth'

export default function Chats() {
  const params = useParams()
  const jid = params.jid ? decodeURIComponent(params.jid) : undefined
  const { user } = useAuth()
  const [info, setInfo] = useState(() => window.innerWidth >= 1400)

  useEffect(() => {
    document.title = 'Conversas · StickerBot'
    return () => { document.title = 'StickerBot · Painel' }
  }, [])

  return (
    <div className="flex h-full">
      <div className={clsx('h-full w-full shrink-0 border-r border-border md:w-[340px] xl:w-[380px]', jid && 'hidden md:block')}>
        <ChatList selected={jid} me={user!.phone} />
      </div>
      <div className={clsx('h-full min-w-0 flex-1', !jid && 'hidden md:block')}>
        {jid ? (
          <ChatView key={jid} jid={jid} infoOpen={info} onToggleInfo={() => setInfo(v => !v)} />
        ) : (
          <div className="chat-wallpaper flex h-full flex-col items-center justify-center p-8 text-center">
            <MessagesSquare className="mb-4 size-14 text-text-3" />
            <div className="text-lg font-medium">Atendimento do StickerBot</div>
            <p className="mt-1 max-w-sm text-sm text-text-3">
              Escolha uma conversa para ler e responder como o bot. As mensagens chegam em tempo real.
            </p>
          </div>
        )}
      </div>
      {jid && info && (
        <div className="fixed inset-0 z-30 h-full w-full border-l border-border lg:static lg:z-auto lg:w-[340px] lg:shrink-0">
          <InfoPanel key={jid} jid={jid} onClose={() => setInfo(false)} />
        </div>
      )}
    </div>
  )
}
