import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Crown, MessageSquare, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { VipModal } from '../components/chat/InfoPanel'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Modal,
  Page,
  PageHeader,
  SearchInput,
  SwitchRow,
  Tabs,
  useUi
} from '../components/ui'
import { del, enc, get, patch } from '../lib/api'
import { displayName, formatDate, formatPhone } from '../lib/format'
import type { Vip } from '../lib/types'

type Filter = 'active' | 'expiring' | 'expired' | 'all'

const toInputDate = (ts: number) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Vips() {
  const queryClient = useQueryClient()
  const { toast, confirm } = useUi()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('active')
  const [addPhone, setAddPhone] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [vipTarget, setVipTarget] = useState<string | null>(null)
  const [editing, setEditing] = useState<Vip | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editPermanent, setEditPermanent] = useState(false)
  const query = useQuery({ queryKey: ['vips'], queryFn: () => get<Vip[]>('/vips') })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['vips'] })

  const soon = Date.now() + 7 * 86_400_000
  const list = useMemo(() => (query.data || []).filter(v => {
    const s = search.toLowerCase()
    if (s && !(v.name || '').toLowerCase().includes(s) && !(v.phone || '').includes(s.replace(/\D/g, '') || s) && !v.jid.includes(s)) return false
    if (filter === 'active') return v.active
    if (filter === 'expiring') return v.active && !v.permanent && v.expires < soon
    if (filter === 'expired') return !v.active
    return true
  }), [query.data, search, filter, soon])

  const counts = {
    active: (query.data || []).filter(v => v.active).length,
    expiring: (query.data || []).filter(v => v.active && !v.permanent && v.expires < soon).length
  }

  const saveEdit = async () => {
    if (!editing) return
    try {
      await patch(`/vips/${enc(editing.jid)}`, { expires: new Date(`${editDate}T23:59:59`).getTime(), permanent: editPermanent })
      toast('VIP atualizado')
      setEditing(null)
      refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    }
  }

  return (
    <Page>
      <PageHeader title="VIPs" subtitle={`${counts.active} VIPs ativos`}
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAddOpen(true)}>Adicionar VIP</Button>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Nome ou número" className="sm:w-80" />
        <Tabs<Filter> value={filter} onChange={setFilter} items={[
          { value: 'active', label: 'Ativos' },
          { value: 'expiring', label: 'Vencem em 7 dias', count: counts.expiring },
          { value: 'expired', label: 'Vencidos' },
          { value: 'all', label: 'Todos' }
        ]} />
      </div>
      <Card padded={false}>
        {query.isLoading ? <Loading /> : query.error ? <ErrorState error={query.error} /> : list.length === 0 ? (
          <EmptyState icon={<Crown />} title="Nenhum VIP aqui" />
        ) : (
          <ul className="divide-y divide-border">
            {list.map(v => {
              const name = displayName(v.name, v.phone, v.jid)
              const chatJid = v.phone ? `${v.phone}@s.whatsapp.net` : v.jid
              return (
                <li key={v.jid} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Avatar jid={chatJid} name={name} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{name}</div>
                    <div className="truncate text-xs text-text-3">{v.phone ? formatPhone(v.phone) : v.jid}</div>
                  </div>
                  <div className="text-right">
                    {v.permanent ? <Badge tone="violet">Permanente</Badge> : v.active
                      ? <Badge tone={v.expires < soon ? 'warning' : 'accent'}>até {formatDate(v.expires)}</Badge>
                      : <Badge tone="neutral">venceu {formatDate(v.expires)}</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setVipTarget(v.phone || v.jid)}>+ meses</Button>
                    <Button size="icon-sm" variant="ghost" aria-label="Editar vencimento" title="Editar vencimento"
                      onClick={() => { setEditing(v); setEditDate(toInputDate(v.expires)); setEditPermanent(v.permanent) }}>
                      <CalendarClock className="size-4" />
                    </Button>
                    <Link to={`/conversas/${enc(chatJid)}`}><Button size="icon-sm" variant="ghost" aria-label="Conversar"><MessageSquare className="size-4" /></Button></Link>
                    <Button size="icon-sm" variant="ghost" className="text-danger" aria-label="Remover VIP" onClick={async () => {
                      if (await confirm({ title: `Remover o VIP de ${name}?`, confirmLabel: 'Remover', danger: true })) {
                        await del(`/vips/${enc(v.jid)}`).then(() => { toast('VIP removido'); refresh() }, e => toast(e.message, 'error'))
                      }
                    }}><Trash2 className="size-4" /></Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Adicionar VIP" size="sm"
        footer={<><Button variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button>
          <Button variant="primary" disabled={addPhone.replace(/\D/g, '').length < 10} onClick={() => { setAddOpen(false); setVipTarget(addPhone.replace(/\D/g, '')) }}>Continuar</Button></>}>
        <Field label="Número com DDI e DDD"><Input autoFocus inputMode="tel" value={addPhone} onChange={e => setAddPhone(e.target.value)} placeholder="5581999999999" /></Field>
      </Modal>
      {vipTarget && <VipModal open onClose={() => setVipTarget(null)} phone={vipTarget} onDone={refresh} />}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar vencimento" size="sm"
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button variant="primary" onClick={saveEdit}>Salvar</Button></>}>
        <div className="space-y-3">
          <SwitchRow label="Permanente" checked={editPermanent} onChange={setEditPermanent} />
          {!editPermanent && <Field label="Vence em"><Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} /></Field>}
        </div>
      </Modal>
    </Page>
  )
}
