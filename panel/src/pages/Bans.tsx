import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban as BanIcon, Plus } from 'lucide-react'
import { useState } from 'react'

import { Avatar, Button, Card, EmptyState, ErrorState, Field, Input, Loading, Modal, Page, PageHeader, SwitchRow, useUi } from '../components/ui'
import { del, enc, get, post } from '../lib/api'
import { displayName, formatPhone } from '../lib/format'
import type { Ban } from '../lib/types'

export default function Bans() {
  const queryClient = useQueryClient()
  const { toast, confirm } = useUi()
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [block, setBlock] = useState(true)
  const [kick, setKick] = useState(true)
  const [busy, setBusy] = useState(false)
  const query = useQuery({ queryKey: ['bans'], queryFn: () => get<Ban[]>('/bans') })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['bans'] })

  const ban = async () => {
    setBusy(true)
    try {
      const res = await post<{ kicked: string[] }>('/bans', { phone, block, kick })
      toast(res.kicked.length ? `Banido e removido de ${res.kicked.length} grupo(s)` : 'Usuário banido')
      setOpen(false)
      setPhone('')
      refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page>
      <PageHeader title="Banidos" subtitle="O bot apaga as mensagens e ignora os comandos de quem está aqui"
        actions={<Button variant="danger" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Banir número</Button>} />
      <Card padded={false}>
        {query.isLoading ? <Loading /> : query.error ? <ErrorState error={query.error} /> : !query.data?.length ? (
          <EmptyState icon={<BanIcon />} title="Ninguém banido" />
        ) : (
          <ul className="divide-y divide-border">
            {query.data.map(b => {
              const name = displayName(b.name, b.phone, b.user)
              return (
                <li key={b.user} className="flex items-center gap-3 px-4 py-3">
                  <Avatar jid={b.phone ? `${b.phone}@s.whatsapp.net` : b.user} name={name} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{name}</div>
                    <div className="truncate text-xs text-text-3">{b.phone ? formatPhone(b.phone) : b.user}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={async () => {
                    if (await confirm({ title: `Desbanir ${name}?`, message: 'O número também é desbloqueado no WhatsApp do bot.', confirmLabel: 'Desbanir' })) {
                      await del(`/bans/${enc(b.user)}`).then(() => { toast('Desbanido'); refresh() }, e => toast(e.message, 'error'))
                    }
                  }}>Desbanir</Button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Banir número" size="sm"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button variant="danger" loading={busy} onClick={ban}>Banir</Button></>}>
        <div className="space-y-3">
          <Field label="Número com DDI e DDD"><Input autoFocus inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="5581999999999" /></Field>
          <SwitchRow label="Bloquear no WhatsApp" checked={block} onChange={setBlock} />
          <SwitchRow label="Remover dos grupos da comunidade" help="Onde o bot for admin." checked={kick} onChange={setKick} />
        </div>
      </Modal>
    </Page>
  )
}
