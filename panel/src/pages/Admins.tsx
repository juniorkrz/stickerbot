import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Avatar, Badge, Button, Card, ErrorState, Field, Input, Loading, Modal, Page, PageHeader, useUi } from '../components/ui'
import { del, get, patch, post } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatPhone } from '../lib/format'
import type { Admin } from '../lib/types'

export default function Admins() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { toast, confirm } = useUi()
  const [addOpen, setAddOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<Admin | null>(null)
  const [busy, setBusy] = useState(false)
  const query = useQuery({ queryKey: ['admins'], queryFn: () => get<Admin[]>('/admins') })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admins'] })

  const add = async () => {
    setBusy(true)
    try {
      await post('/admins', { phone, name })
      toast('Admin adicionado')
      setAddOpen(false)
      setPhone('')
      setName('')
      refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    } finally {
      setBusy(false)
    }
  }

  const rename = async () => {
    if (!editing) return
    setBusy(true)
    try {
      await patch(`/admins/${editing.phone}`, { name })
      toast('Nome atualizado')
      setEditing(null)
      refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page>
      <PageHeader
        title="Admins"
        subtitle="Admins usam os comandos restritos do bot e entram neste painel pelo número"
        actions={user?.isOwner && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAddOpen(true)}>Adicionar admin</Button>}
      />
      <Card padded={false}>
        {query.isLoading ? <Loading /> : query.error ? <ErrorState error={query.error} /> : (
          <ul className="divide-y divide-border">
            {query.data!.map(a => {
              const label = a.name || a.whatsappName || formatPhone(a.phone)
              const canEdit = user?.isOwner || user?.phone === a.phone
              return (
                <li key={a.phone} className="flex items-center gap-3 px-4 py-3">
                  <Avatar jid={`${a.phone}@s.whatsapp.net`} name={label} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{label}</span>
                      {a.isOwner && <Badge tone="violet">Dono</Badge>}
                      {a.phone === user?.phone && <Badge>Você</Badge>}
                    </div>
                    <div className="text-xs text-text-3">{formatPhone(a.phone)}{a.whatsappName && a.name ? ` · ~${a.whatsappName}` : ''}</div>
                  </div>
                  {canEdit && (
                    <Button size="icon-sm" variant="ghost" aria-label="Renomear" onClick={() => { setEditing(a); setName(a.name || '') }}>
                      <Pencil className="size-4" />
                    </Button>
                  )}
                  {user?.isOwner && !a.isOwner && (
                    <Button size="icon-sm" variant="ghost" className="text-danger" aria-label="Remover admin" onClick={async () => {
                      if (await confirm({ title: `Remover ${label} dos admins?`, message: 'A pessoa perde o acesso ao painel e aos comandos de admin na hora.', confirmLabel: 'Remover', danger: true })) {
                        await del(`/admins/${a.phone}`).then(() => { toast('Admin removido'); refresh() }, e => toast(e.message, 'error'))
                      }
                    }}><Trash2 className="size-4" /></Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      <div className="mt-4 flex items-start gap-2 text-sm text-text-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <span>O primeiro número é o dono: só ele adiciona ou remove admins, reinicia o bot e usa o comando !vip.
          O nome aparece nas conversas atribuídas e na assinatura das mensagens enviadas pelo painel.</span>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Adicionar admin" size="sm"
        footer={<><Button variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button><Button variant="primary" loading={busy} onClick={add}>Adicionar</Button></>}>
        <div className="space-y-3">
          <Field label="Número com DDI e DDD"><Input autoFocus inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="5581999999999" /></Field>
          <Field label="Nome no painel (opcional)"><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Júnior" /></Field>
        </div>
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Nome no painel" size="sm"
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button variant="primary" loading={busy} onClick={rename}>Salvar</Button></>}>
        <Field label="Nome" help="Deixe em branco para usar o número."><Input autoFocus value={name} onChange={e => setName(e.target.value)} /></Field>
      </Modal>
    </Page>
  )
}
