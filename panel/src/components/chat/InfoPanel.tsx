import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Crown, ExternalLink, ShieldCheck, Trash2, Users, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { del, enc, get, patch, post } from '../../lib/api'
import { displayName, formatDate, formatNumber, formatPhone } from '../../lib/format'
import type { ChatDetail } from '../../lib/types'
import { Avatar, Badge, Button, Field, Input, Modal, SwitchRow, useUi } from '../ui'

export const VipModal = ({ open, onClose, phone, onDone }: { open: boolean, onClose: () => void, phone: string, onDone: () => void }) => {
  const [months, setMonths] = useState('1')
  const [permanent, setPermanent] = useState(false)
  const [notify, setNotify] = useState(true)
  const [loading, setLoading] = useState(false)
  const { toast } = useUi()
  const save = async () => {
    setLoading(true)
    try {
      await post('/vips', { phone, months: Number(months), permanent, notify })
      toast('VIP atualizado')
      onDone()
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    } finally {
      setLoading(false)
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Adicionar VIP" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={loading} onClick={save}>Salvar</Button></>}>
      <div className="space-y-3">
        <div className="text-sm text-text-2">{formatPhone(phone) || phone}</div>
        <SwitchRow label="VIP permanente" checked={permanent} onChange={setPermanent} />
        {!permanent && (
          <Field label="Meses a adicionar" help="Soma ao vencimento atual, se ainda estiver ativo.">
            <Input type="number" min={1} max={120} value={months} onChange={e => setMonths(e.target.value)} />
          </Field>
        )}
        <SwitchRow label="Avisar a pessoa no WhatsApp" checked={notify} onChange={setNotify} />
      </div>
    </Modal>
  )
}

export const InfoPanel = ({ jid, onClose }: { jid: string, onClose: () => void }) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { toast, confirm } = useUi()
  const [vipOpen, setVipOpen] = useState(false)
  const { data: chat } = useQuery({ queryKey: ['chat', jid], queryFn: () => get<ChatDetail>(`/chats/${enc(jid)}`) })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['chat', jid] })
  const run = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn()
      toast(message)
      refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    }
  }

  if (!chat) return null
  const name = displayName(chat.name || chat.contact?.pushName, chat.phone, jid)
  const target = chat.phone || jid

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fechar detalhes"><X className="size-4" /></Button>
        <span className="font-medium">{chat.isGroup ? 'Dados do grupo' : 'Dados do contato'}</span>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center border-b border-border px-6 py-6 text-center">
          <Avatar jid={jid} name={name} size={120} />
          <div className="mt-3 text-lg font-semibold">{name}</div>
          <div className="text-sm text-text-3">{chat.isGroup ? `Grupo · ${chat.group?.size ?? '?'} participantes` : formatPhone(chat.phone) || jid}</div>
          {chat.contact?.pushName && chat.contact.pushName !== name && <div className="text-xs text-text-3">~{chat.contact.pushName}</div>}
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {chat.contact?.isAdmin && <Badge tone="info"><ShieldCheck className="size-3" />Admin do bot</Badge>}
            {chat.contact?.vip?.active && (
              <Badge tone="violet"><Crown className="size-3" />VIP {chat.contact.vip.permanent ? 'permanente' : `até ${formatDate(chat.contact.vip.expires)}`}</Badge>
            )}
            {chat.contact?.isBanned && <Badge tone="danger"><Ban className="size-3" />Banido</Badge>}
            {chat.group?.official && <Badge tone="accent">Grupo oficial</Badge>}
            {chat.group?.isLogs && <Badge tone="info">Grupo de logs</Badge>}
          </div>
        </div>

        {chat.contact && (
          <>
            <div className="grid grid-cols-2 border-b border-border text-center">
              <div className="border-r border-border p-4">
                <div className="text-xl font-semibold">{formatNumber(chat.contact.usage30d)}</div>
                <div className="text-xs text-text-3">usos em 30 dias</div>
              </div>
              <div className="p-4">
                <div className="text-xl font-semibold">{chat.contact.groups.length}</div>
                <div className="text-xs text-text-3">grupos em comum</div>
              </div>
            </div>
            <div className="space-y-2 border-b border-border p-4">
              <Button className="w-full justify-start" variant="outline" icon={<Crown className="size-4 text-violet" />} onClick={() => setVipOpen(true)}>
                {chat.contact.vip?.active ? 'Adicionar meses de VIP' : 'Dar VIP'}
              </Button>
              {chat.contact.vip && (
                <Button className="w-full justify-start" variant="outline" icon={<Crown className="size-4 text-text-3" />}
                  onClick={async () => {
                    if (await confirm({ title: 'Remover VIP?', confirmLabel: 'Remover', danger: true })) {
                      await run(() => del(`/vips/${enc(chat.contact!.vip!.jid)}`), 'VIP removido')
                    }
                  }}>
                  Remover VIP
                </Button>
              )}
              {!chat.contact.isAdmin && (chat.contact.isBanned ? (
                <Button className="w-full justify-start" variant="outline" icon={<Ban className="size-4" />}
                  onClick={async () => {
                    const bans = await get<{ user: string, phone: string | null }[]>('/bans')
                    const entries = bans.filter(b => b.user === jid || b.phone === chat.phone || b.user === chat.phone)
                    for (const b of entries) await del(`/bans/${enc(b.user)}`)
                    toast('Desbanido')
                    refresh()
                  }}>
                  Desbanir
                </Button>
              ) : (
                <Button className="w-full justify-start text-danger" variant="outline" icon={<Ban className="size-4" />}
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Banir ${name}?`,
                      message: 'O bot vai ignorar e apagar as mensagens dessa pessoa, bloquear o número e remover dos grupos da comunidade onde for admin.',
                      confirmLabel: 'Banir',
                      danger: true
                    })
                    if (ok) await run(() => post('/bans', { jid }), 'Usuário banido')
                  }}>
                  Banir
                </Button>
              ))}
            </div>
            {chat.contact.groups.length > 0 && (
              <div className="border-b border-border py-2">
                <div className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-text-3">Grupos em comum</div>
                {chat.contact.groups.map(g => (
                  <Link key={g.jid} to={`/conversas/${enc(g.jid)}`} className="flex items-center gap-3 px-4 py-2 hover:bg-surface-2">
                    <Avatar jid={g.jid} name={g.subject} size={32} />
                    <span className="truncate text-sm">{g.subject}</span>
                  </Link>
                ))}
              </div>
            )}
            <VipModal open={vipOpen} onClose={() => setVipOpen(false)} phone={target} onDone={refresh} />
          </>
        )}

        {chat.group && (
          <>
            {chat.group.desc && <div className="whitespace-pre-wrap border-b border-border p-4 text-sm text-text-2">{chat.group.desc}</div>}
            <div className="border-b border-border px-4 py-2">
              <SwitchRow label="Grupo oficial do bot" help="Responde mídia sem precisar mencionar o bot."
                checked={chat.group.official}
                onChange={v => run(() => patch(`/groups/${enc(jid)}`, { official: v }), 'Salvo')} />
              <SwitchRow label="Silenciar o bot neste grupo" help="O bot ignora tudo que chegar daqui."
                checked={chat.group.muted}
                onChange={v => run(() => patch(`/groups/${enc(jid)}`, { muted: v }), 'Salvo')} />
              <SwitchRow label="Grupo de logs" help="Recebe os avisos do bot (bans, VIPs, limites)."
                checked={chat.group.isLogs}
                onChange={v => run(() => patch(`/groups/${enc(jid)}`, { isLogs: v }), 'Salvo')} />
            </div>
            <div className="p-4">
              <Button className="w-full" variant="outline" icon={<Users className="size-4" />} onClick={() => navigate(`/grupos/${enc(jid)}`)}>
                Gerenciar grupo e participantes <ExternalLink className="size-3.5" />
              </Button>
            </div>
          </>
        )}

        <div className="p-4">
          <Button className="w-full justify-start text-danger" variant="ghost" icon={<Trash2 className="size-4" />}
            onClick={async () => {
              const ok = await confirm({
                title: 'Apagar histórico do painel?',
                message: 'Apaga só as mensagens guardadas no painel. Nada é apagado no WhatsApp.',
                confirmLabel: 'Apagar',
                danger: true
              })
              if (ok) {
                await del(`/chats/${enc(jid)}`)
                toast('Histórico apagado')
                navigate('/conversas')
              }
            }}>
            Apagar histórico do painel
          </Button>
        </div>
      </div>
    </div>
  )
}
