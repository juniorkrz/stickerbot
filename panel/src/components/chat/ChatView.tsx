import { useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowLeft,
  CircleCheck,
  Info,
  MoreVertical,
  Pin,
  PinOff,
  RotateCcw,
  UserCheck,
  UserX,
  X
} from 'lucide-react'
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { del, enc, get, mediaUrl, patch, post } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useEvent } from '../../lib/events'
import { displayName, formatDayLabel, formatPhone } from '../../lib/format'
import type { Admin, ChatDetail, Message, MessagesPage } from '../../lib/types'
import { Avatar, Badge, Button, Spinner, useUi } from '../ui'
import { Composer } from './Composer'
import { BubbleContext, MessageBubble, senderName } from './MessageBubble'

const dayKey = (ts: number) => new Date(ts).toDateString()

let pendingSeq = 0

export const ChatView = ({ jid, onToggleInfo, infoOpen }: { jid: string, onToggleInfo: () => void, infoOpen: boolean }) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { toast, confirm } = useUi()

  const [messages, setMessages] = useState<Message[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [admins, setAdmins] = useState<Record<string, string>>({})
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [atBottom, setAtBottom] = useState(true)
  const [newBelow, setNewBelow] = useState(0)
  const [actions, setActions] = useState(false)
  const [lightbox, setLightbox] = useState<Message | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const restoreScroll = useRef<number | null>(null)
  const stickToBottom = useRef(true)
  const readTimer = useRef<number>()

  const detail = useQuery({ queryKey: ['chat', jid], queryFn: () => get<ChatDetail>(`/chats/${enc(jid)}`) })
  const adminList = useQuery({ queryKey: ['admins'], queryFn: () => get<Admin[]>('/admins'), staleTime: 300_000 })
  const chat = detail.data

  const markRead = useCallback(() => {
    window.clearTimeout(readTimer.current)
    readTimer.current = window.setTimeout(() => {
      void post(`/chats/${enc(jid)}/read`).catch(() => undefined)
    }, 400)
  }, [jid])

  // carga inicial
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setMessages([])
    setReplyTo(null)
    setNewBelow(0)
    stickToBottom.current = true
    get<MessagesPage>(`/chats/${enc(jid)}/messages?limit=60`)
      .then(page => {
        if (cancelled) return
        setMessages(page.messages)
        setNames(page.names)
        setAdmins(page.admins)
        setHasMore(page.hasMore)
      })
      .catch(e => toast(e instanceof Error ? e.message : 'Erro ao carregar mensagens', 'error'))
      .finally(() => !cancelled && setLoading(false))
    markRead()
    return () => { cancelled = true }
  }, [jid, markRead, toast])

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore || messages.length === 0) return
    setLoadingOlder(true)
    const el = scrollRef.current
    restoreScroll.current = el ? el.scrollHeight - el.scrollTop : null
    try {
      const page = await get<MessagesPage>(`/chats/${enc(jid)}/messages?limit=60&before=${messages[0].timestamp}`)
      setMessages(list => {
        const ids = new Set(list.map(m => m.id))
        return [...page.messages.filter(m => !ids.has(m.id)), ...list]
      })
      setNames(n => ({ ...page.names, ...n }))
      setAdmins(a => ({ ...page.admins, ...a }))
      setHasMore(page.hasMore)
    } finally {
      setLoadingOlder(false)
    }
  }, [loadingOlder, hasMore, messages, jid])

  // mantém a posição ao carregar antigas / cola no fim com mensagens novas
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (restoreScroll.current !== null) {
      el.scrollTop = el.scrollHeight - restoreScroll.current
      restoreScroll.current = null
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, loading])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    stickToBottom.current = bottom
    setAtBottom(bottom)
    if (bottom) setNewBelow(0)
    if (el.scrollTop < 200) void loadOlder()
  }

  const scrollToBottom = () => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    setNewBelow(0)
  }

  // eventos ao vivo
  useEvent('message', ({ message }: { message: Message }) => {
    if (message.jid !== jid) return
    setMessages(list => {
      if (list.some(m => m.id === message.id)) return list.map(m => (m.id === message.id ? { ...m, ...message } : m))
      let next = list
      if (message.fromMe) {
        // troca a mensagem otimista correspondente
        const idx = list.findIndex(m => m.pending && (m.text === message.text || (!m.text && m.type === message.type) ||
          (m.type !== 'text' && message.type !== 'text')))
        if (idx !== -1) next = list.filter((_, i) => i !== idx)
      }
      return [...next, message]
    })
    if (message.sender && message.pushName) setNames(n => (n[message.sender!] ? n : { ...n, [message.sender!]: message.pushName! }))
    if (message.sentBy && !admins[message.sentBy]) {
      const admin = adminList.data?.find(a => a.phone === message.sentBy)
      setAdmins(a => ({ ...a, [message.sentBy!]: admin?.name || formatPhone(message.sentBy) }))
    }
    if (!message.fromMe) {
      if (document.visibilityState === 'visible') markRead()
      if (!stickToBottom.current) setNewBelow(n => n + 1)
    }
  })
  useEvent('message-update', (update: Partial<Message> & { jid: string, id: string }) => {
    if (update.jid !== jid) return
    setMessages(list => list.map(m => (m.id === update.id
      ? { ...m, ...update, status: update.status !== undefined ? Math.max(m.status, update.status) : m.status }
      : m)))
  })
  useEvent('chat', (c: { jid: string }) => {
    if (c.jid === jid) queryClient.invalidateQueries({ queryKey: ['chat', jid] })
  })

  const addOptimistic = ({ text, kind, quotedId }: { text?: string, kind?: string, quotedId?: string }) => {
    const id = `pending-${++pendingSeq}`
    const quoted = quotedId ? messages.find(m => m.id === quotedId) : undefined
    stickToBottom.current = true
    setMessages(list => [...list, {
      id,
      jid,
      fromMe: true,
      type: kind ? (kind === 'sticker' ? 'sticker' : kind) : 'text',
      text: text || null,
      meta: quoted ? { quoted: { id: quoted.id, participant: quoted.sender || undefined, text: quoted.text || undefined } } : {},
      reactions: {},
      status: 1,
      deleted: false,
      edited: false,
      sentBy: user?.phone,
      timestamp: Date.now(),
      hasMedia: false,
      pending: true
    }])
    if (user) setAdmins(a => ({ ...a, [user.phone]: user.name }))
    // se não confirmar em 30s, some (o envio falhou ou o evento se perdeu)
    setTimeout(() => setMessages(list => list.filter(m => m.id !== id)), 30_000)
  }

  const jumpTo = useCallback((id: string) => {
    const el = document.getElementById(`msg-${id}`)
    if (!el) {
      toast('Mensagem antiga demais para exibir aqui', 'info')
      return
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlight(id)
    setTimeout(() => setHighlight(null), 1600)
  }, [toast])

  const ctx: BubbleContext = useMemo(() => ({
    isGroup: !!chat?.isGroup,
    names,
    admins,
    canDeleteOthers: !!chat?.group?.amAdmin,
    onReply: m => setReplyTo(m),
    onReact: (m, emoji) => {
      post(`/chats/${enc(jid)}/messages/${enc(m.id)}/react`, { emoji }).catch(e => toast(e.message, 'error'))
    },
    onDelete: async m => {
      const ok = await confirm({ title: 'Apagar para todos?', message: 'A mensagem será apagada no WhatsApp de todos na conversa.', confirmLabel: 'Apagar', danger: true })
      if (ok) del(`/chats/${enc(jid)}/messages/${enc(m.id)}`).catch(e => toast(e.message, 'error'))
    },
    onJump: jumpTo,
    onOpenMedia: m => setLightbox(m),
    onCopy: text => {
      navigator.clipboard?.writeText(text).then(() => toast('Copiado'), () => toast('Não foi possível copiar', 'error'))
    }
  }), [chat, names, admins, jid, jumpTo, toast, confirm])

  const update = async (body: Record<string, unknown>, message?: string) => {
    setActions(false)
    try {
      await patch(`/chats/${enc(jid)}`, body)
      queryClient.invalidateQueries({ queryKey: ['chat', jid] })
      queryClient.invalidateQueries({ queryKey: ['chats'] })
      queryClient.invalidateQueries({ queryKey: ['chat-counts'] })
      if (message) toast(message)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    }
  }

  const name = chat ? displayName(chat.name || chat.contact?.pushName, chat.phone, jid) : displayName(null, null, jid)
  const subtitle = chat?.isGroup
    ? chat.group ? `${chat.group.size} participantes` : 'Grupo'
    : [chat?.phone ? formatPhone(chat.phone) : null, chat?.assignedName ? `atribuída a ${chat.assignedName}` : null].filter(Boolean).join(' · ')

  const disabledReason = chat?.group?.announce && !chat.group.amAdmin
    ? 'Só admins podem enviar mensagens neste grupo e o bot não é admin.'
    : undefined

  const assignedToMe = chat?.assignedTo === user?.phone

  return (
    <div className="flex h-full min-w-0 flex-col">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-surface px-2 sm:px-4">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => navigate('/conversas')} aria-label="Voltar">
          <ArrowLeft className="size-5" />
        </Button>
        <button onClick={onToggleInfo} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Avatar jid={jid} name={name} size={40} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{name}</span>
              {chat?.status === 'resolved' && <Badge tone="accent">Resolvida</Badge>}
              {chat?.contact?.vip?.active && <Badge tone="violet">VIP</Badge>}
              {chat?.contact?.isBanned && <Badge tone="danger">Banido</Badge>}
              {chat?.group?.muted && <Badge tone="warning">Silenciado</Badge>}
            </div>
            <div className="truncate text-xs text-text-3">{subtitle}</div>
          </div>
        </button>

        <div className="hidden items-center gap-1 sm:flex">
          {chat?.status === 'resolved' ? (
            <Button size="sm" variant="outline" icon={<RotateCcw className="size-4" />} onClick={() => update({ status: 'open' }, 'Conversa reaberta')}>
              Reabrir
            </Button>
          ) : (
            <Button size="sm" variant="primary" icon={<CircleCheck className="size-4" />}
              onClick={() => update({ status: 'resolved' }, 'Conversa marcada como resolvida')}>
              Resolver
            </Button>
          )}
        </div>
        <div className="relative">
          <Button variant="ghost" size="icon" onClick={() => setActions(v => !v)} aria-label="Mais ações"><MoreVertical className="size-5" /></Button>
          {actions && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setActions(false)} />
              <div className="animate-fade-in absolute right-0 top-11 z-20 w-60 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-card">
                <div className="sm:hidden">
                  {chat?.status === 'resolved'
                    ? <MenuItem icon={<RotateCcw />} label="Reabrir" onClick={() => update({ status: 'open' }, 'Conversa reaberta')} />
                    : <MenuItem icon={<CircleCheck />} label="Marcar como resolvida" onClick={() => update({ status: 'resolved' }, 'Conversa resolvida')} />}
                </div>
                {assignedToMe
                  ? <MenuItem icon={<UserX />} label="Remover atribuição" onClick={() => update({ assignedTo: null })} />
                  : <MenuItem icon={<UserCheck />} label="Atribuir a mim" onClick={() => update({ assignedTo: user?.phone }, 'Conversa atribuída a você')} />}
                {(adminList.data || []).filter(a => a.phone !== user?.phone && a.phone !== chat?.assignedTo).map(a => (
                  <MenuItem key={a.phone} icon={<UserCheck />} label={`Atribuir a ${a.name || a.whatsappName || formatPhone(a.phone)}`}
                    onClick={() => update({ assignedTo: a.phone }, 'Conversa atribuída')} />
                ))}
                <div className="my-1 border-t border-border" />
                {chat?.pinned
                  ? <MenuItem icon={<PinOff />} label="Desafixar" onClick={() => update({ pinned: false })} />
                  : <MenuItem icon={<Pin />} label="Fixar no topo" onClick={() => update({ pinned: true })} />}
                {chat?.archived
                  ? <MenuItem icon={<ArchiveRestore />} label="Desarquivar" onClick={() => update({ archived: false })} />
                  : <MenuItem icon={<Archive />} label="Arquivar" onClick={() => update({ archived: true }, 'Conversa arquivada')} />}
                <MenuItem icon={<Info />} label={infoOpen ? 'Fechar detalhes' : 'Ver detalhes'} onClick={() => { setActions(false); onToggleInfo() }} />
              </div>
            </>
          )}
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} onScroll={onScroll} className="chat-wallpaper absolute inset-0 overflow-y-auto py-3">
          {loadingOlder && <div className="flex justify-center py-2"><Spinner /></div>}
          {!hasMore && !loading && (
            <div className="mx-auto mb-3 w-fit max-w-[90%] rounded-lg bg-surface px-3 py-1.5 text-center text-xs text-text-3 shadow-sm">
              {messages.length === 0 ? 'Nenhuma mensagem guardada nesta conversa ainda.' : 'Início do histórico guardado pelo painel.'}
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : messages.map((m, i) => {
            const prev = messages[i - 1]
            const newDay = !prev || dayKey(prev.timestamp) !== dayKey(m.timestamp)
            const showSender = newDay || !prev || prev.sender !== m.sender || prev.fromMe !== m.fromMe || prev.type === 'system'
            return (
              <Fragment key={m.id}>
                {newDay && (
                  <div className="sticky top-1 z-[5] my-2 flex justify-center">
                    <span className="rounded-lg bg-surface px-3 py-1 text-xs font-medium text-text-2 shadow-sm">{formatDayLabel(m.timestamp)}</span>
                  </div>
                )}
                <MessageBubble m={m} ctx={ctx} showSender={showSender} highlight={highlight === m.id} />
              </Fragment>
            )
          })}
        </div>
        {!atBottom && (
          <button onClick={scrollToBottom} aria-label="Ir para o fim"
            className="absolute bottom-4 right-4 flex size-10 items-center justify-center rounded-full bg-surface text-text-2 shadow-card hover:text-text">
            <ArrowDown className="size-5" />
            {newBelow > 0 && (
              <span className="tabular absolute -top-1.5 -right-1 rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-accent-text">{newBelow}</span>
            )}
          </button>
        )}
      </div>

      <Composer
        jid={jid}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        senderLabel={m => senderName(m, names)}
        disabledReason={disabledReason}
        onSent={addOptimistic}
      />

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setLightbox(null)}>
          <button className="absolute right-4 top-4 rounded-full p-2 text-white/80 hover:bg-white/10" aria-label="Fechar"><X className="size-6" /></button>
          <img src={mediaUrl(lightbox.jid, lightbox.id)} alt="" className={clsx('max-h-full max-w-full object-contain', lightbox.type === 'sticker' && 'size-80')} />
        </div>
      )}
    </div>
  )
}

const MenuItem = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) => (
  <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-text hover:bg-surface-2 [&_svg]:size-4 [&_svg]:text-text-3">
    {icon}<span className="truncate">{label}</span>
  </button>
)
