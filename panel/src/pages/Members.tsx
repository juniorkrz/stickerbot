import { useQuery } from '@tanstack/react-query'
import { Contact, Crown, MessageSquare } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Loading, Page, PageHeader, SearchInput, Tabs } from '../components/ui'
import { enc, get } from '../lib/api'
import { displayName, formatNumber, formatPhone, timeAgo } from '../lib/format'
import type { Member } from '../lib/types'

type Filter = 'all' | 'vip' | 'banned'
const PAGE = 50

export default function Members() {
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => { setQ(search); setPage(0) }, 300)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => setPage(0), [filter])

  const query = useQuery({
    queryKey: ['members', q, filter, page],
    queryFn: () => get<{ total: number, items: Member[] }>(`/members?q=${enc(q)}&filter=${filter}&limit=${PAGE}&offset=${page * PAGE}`),
    placeholderData: prev => prev
  })
  const total = query.data?.total || 0

  return (
    <Page>
      <PageHeader title="Membros" subtitle="Todas as pessoas que já falaram com o bot ou usaram algum comando" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Nome ou número" className="sm:w-80" />
        <Tabs<Filter> value={filter} onChange={setFilter} items={[
          { value: 'all', label: 'Todos' },
          { value: 'vip', label: 'VIPs' },
          { value: 'banned', label: 'Banidos' }
        ]} />
      </div>
      <Card padded={false}>
        {query.isLoading ? <Loading /> : query.error ? <ErrorState error={query.error} /> : !query.data?.items.length ? (
          <EmptyState icon={<Contact />} title="Ninguém encontrado">Os contatos aparecem conforme as pessoas mandam mensagens.</EmptyState>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {query.data.items.map(m => {
                const name = displayName(m.name, m.phone, m.jid)
                const chatJid = m.phone ? `${m.phone}@s.whatsapp.net` : m.jid
                return (
                  <li key={m.jid} className="flex items-center gap-3 px-4 py-3">
                    <Avatar jid={chatJid} name={name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate font-medium">{name}</span>
                        {m.isAdmin && <Badge tone="info">Admin</Badge>}
                        {m.isVip && <Badge tone="violet"><Crown className="size-3" />VIP</Badge>}
                        {m.isBanned && <Badge tone="danger">Banido</Badge>}
                      </div>
                      <div className="truncate text-xs text-text-3">
                        {m.phone ? formatPhone(m.phone) : m.jid} · visto {timeAgo(m.lastSeenAt)}
                      </div>
                    </div>
                    <div className="hidden text-right sm:block">
                      <div className="tabular text-sm font-medium">{formatNumber(m.usage30d)}</div>
                      <div className="text-xs text-text-3">usos/30d</div>
                    </div>
                    <Link to={`/conversas/${enc(chatJid)}`}>
                      <Button variant="ghost" size="icon-sm" aria-label="Abrir conversa"><MessageSquare className="size-4" /></Button>
                    </Link>
                  </li>
                )
              })}
            </ul>
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-text-3">
              <span className="tabular">{formatNumber(page * PAGE + 1)}–{formatNumber(Math.min(total, (page + 1) * PAGE))} de {formatNumber(total)}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <Button size="sm" variant="outline" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(p => p + 1)}>Próxima</Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </Page>
  )
}
