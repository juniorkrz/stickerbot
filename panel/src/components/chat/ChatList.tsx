import { useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Archive, CheckCheck, CircleCheck, Menu, MessageSquarePlus, Pin, UserCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'

import { enc, get, post } from '../../lib/api'
import { useEvent } from '../../lib/events'
import { displayName, formatChatTime } from '../../lib/format'
import type { Chat } from '../../lib/types'
import { Avatar, Button, EmptyState, Input, Modal, SearchInput, Spinner, Tabs, useUi } from '../ui'

export type ChatFilter = 'all' | 'waiting' | 'unread' | 'mine' | 'private' | 'groups' | 'resolved' | 'archived'

const PAGE = 50

const useDebounced = <T,>(value: T, ms = 300) => {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

// A conversa entra na lista do filtro atual?
const matchesFilter = (chat: Chat, filter: ChatFilter, me: string) => {
  switch (filter) {
  case 'waiting': return !chat.isGroup && chat.status === 'open' && chat.unread > 0 && !chat.archived
  case 'unread': return chat.unread > 0 && !chat.archived
  case 'mine': return chat.assignedTo === me && !chat.archived
  case 'private': return !chat.isGroup && !chat.archived
  case 'groups': return chat.isGroup && !chat.archived
  case 'resolved': return chat.status === 'resolved'
  case 'archived': return chat.archived
  default: return !chat.archived
  }
}

const sortChats = (a: Chat, b: Chat) => Number(b.pinned) - Number(a.pinned) || (b.lastMessageAt || 0) - (a.lastMessageAt || 0)

const NewChatModal = ({ open, onClose }: { open: boolean, onClose: () => void }) => {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useUi()
  const navigate = useNavigate()
  const start = async () => {
    setLoading(true)
    try {
      const { jid } = await post<{ jid: string }>('/chats/start', { phone })
      onClose()
      setPhone('')
      navigate(`/conversas/${enc(jid)}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    } finally {
      setLoading(false)
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Nova conversa" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={loading} onClick={start}>Abrir conversa</Button></>}>
      <label className="block space-y-1.5">
        <span className="text-sm text-text-2">Número com DDI e DDD</span>
        <Input autoFocus inputMode="tel" placeholder="55 81 99999-9999" value={phone} onChange={e => setPhone(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && start()} />
      </label>
    </Modal>
  )
}

export const ChatList = ({ selected, me }: { selected?: string, me: string }) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const outlet = useOutletContext<{ openMenu?: () => void } | undefined>()
  const [filter, setFilter] = useState<ChatFilter>('all')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [newChat, setNewChat] = useState(false)
  const q = useDebounced(search)
  const refetchTimer = useRef<number>()

  const key = ['chats', filter, q, limit]
  const query = useQuery({
    queryKey: key,
    queryFn: () => get<Chat[]>(`/chats?filter=${filter}&q=${enc(q)}&limit=${limit}`),
    placeholderData: prev => prev
  })
  const counts = useQuery({
    queryKey: ['chat-counts'],
    queryFn: () => get<{ all: number, unread: number, waiting: number, mine: number }>('/chats/counts')
  })

  useEffect(() => setLimit(PAGE), [filter, q])

  const scheduleRefetch = () => {
    window.clearTimeout(refetchTimer.current)
    refetchTimer.current = window.setTimeout(() => queryClient.invalidateQueries({ queryKey: ['chats'] }), 800)
  }

  // atualização ao vivo da lista
  useEvent('message', ({ chat }: { chat: Partial<Chat> & { jid: string, incoming?: boolean } }) => {
    queryClient.setQueryData<Chat[]>(key, (list) => {
      if (!list) return list
      const idx = list.findIndex(c => c.jid === chat.jid)
      if (idx === -1) {
        scheduleRefetch()
        return list
      }
      const current = list[idx]
      const isOpen = chat.jid === selected && document.visibilityState === 'visible'
      const updated: Chat = {
        ...current,
        name: chat.name || current.name,
        lastMessage: chat.lastMessage ?? current.lastMessage,
        lastMessageAt: chat.lastMessageAt ?? current.lastMessageAt,
        lastFromMe: chat.lastFromMe ?? current.lastFromMe,
        unread: isOpen ? 0 : current.unread + (chat.unread || 0),
        status: chat.incoming ? 'open' : current.status
      }
      const next = [...list]
      next[idx] = updated
      return next.filter(c => matchesFilter(c, filter, me)).sort(sortChats)
    })
  })
  useEvent('chat', (chat: Partial<Chat> & { jid: string, removed?: boolean }) => {
    queryClient.setQueryData<Chat[]>(key, (list) => {
      if (!list) return list
      if (chat.removed) return list.filter(c => c.jid !== chat.jid)
      const idx = list.findIndex(c => c.jid === chat.jid)
      if (idx === -1) {
        if (chat.status !== undefined || chat.archived !== undefined) scheduleRefetch()
        return list
      }
      const next = [...list]
      next[idx] = { ...next[idx], ...chat }
      return next.filter(c => matchesFilter(c, filter, me)).sort(sortChats)
    })
  })

  const chats = query.data || []

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-16 shrink-0 items-center gap-2 px-4">
        {outlet?.openMenu && (
          <button onClick={outlet.openMenu} className="-ml-2 rounded-lg p-2 text-text-2 hover:bg-surface-2 lg:hidden" aria-label="Menu">
            <Menu className="size-5" />
          </button>
        )}
        <h1 className="flex-1 text-xl font-semibold">Conversas</h1>
        <Button variant="ghost" size="icon" onClick={() => setNewChat(true)} title="Nova conversa" aria-label="Nova conversa">
          <MessageSquarePlus className="size-5" />
        </Button>
      </div>
      <div className="space-y-3 px-3 pb-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar nome ou número" />
        <Tabs<ChatFilter>
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'all', label: 'Todas' },
            { value: 'waiting', label: 'Aguardando', count: counts.data?.waiting },
            { value: 'unread', label: 'Não lidas' },
            { value: 'mine', label: 'Minhas', count: counts.data?.mine },
            { value: 'private', label: 'Privadas' },
            { value: 'groups', label: 'Grupos' },
            { value: 'resolved', label: 'Resolvidas' },
            { value: 'archived', label: 'Arquivadas' }
          ]}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
        {query.isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : chats.length === 0 ? (
          <EmptyState icon={<CheckCheck />} title={q ? 'Nada encontrado' : 'Nenhuma conversa aqui'}>
            {filter === 'waiting' && !q ? 'Todo mundo foi respondido. 🎉' : 'As conversas aparecem aqui conforme as mensagens chegam.'}
          </EmptyState>
        ) : (
          <ul>
            {chats.map(chat => {
              const name = displayName(chat.name, chat.phone, chat.jid)
              return (
                <li key={chat.jid}>
                  <button
                    onClick={() => navigate(`/conversas/${enc(chat.jid)}`)}
                    className={clsx(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                      selected === chat.jid ? 'bg-surface-3' : 'hover:bg-surface-2'
                    )}
                  >
                    <Avatar jid={chat.jid} name={name} size={48} />
                    <div className="min-w-0 flex-1 border-b border-border/60 pb-2.5 -mb-2.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[15px] font-medium text-text">{name}</span>
                        <span className={clsx('shrink-0 text-xs', chat.unread > 0 ? 'font-medium text-accent' : 'text-text-3')}>
                          {formatChatTime(chat.lastMessageAt)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-[13px] text-text-3">
                          {chat.lastFromMe && <CheckCheck className="mr-1 inline size-3.5 align-[-2px] text-text-3" />}
                          {chat.lastMessage || ' '}
                        </span>
                        {chat.status === 'resolved' && <CircleCheck className="size-3.5 shrink-0 text-accent" aria-label="Resolvida" />}
                        {chat.assignedTo && (
                          <span title={`Atribuída a ${chat.assignedName}`}>
                            <UserCheck className={clsx('size-3.5 shrink-0', chat.assignedTo === me ? 'text-info' : 'text-text-3')} />
                          </span>
                        )}
                        {chat.archived && <Archive className="size-3.5 shrink-0 text-text-3" />}
                        {chat.pinned && <Pin className="size-3.5 shrink-0 rotate-45 text-text-3" />}
                        {chat.unread > 0 && (
                          <span className="tabular min-w-5 shrink-0 rounded-full bg-accent px-1.5 text-center text-[11px] font-semibold leading-5 text-accent-text">
                            {chat.unread > 999 ? '999+' : chat.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
            {chats.length >= limit && (
              <li className="p-3">
                <Button variant="ghost" className="w-full" loading={query.isFetching} onClick={() => setLimit(l => l + PAGE)}>
                  Carregar mais
                </Button>
              </li>
            )}
          </ul>
        )}
      </div>
      <NewChatModal open={newChat} onClose={() => setNewChat(false)} />
    </div>
  )
}
