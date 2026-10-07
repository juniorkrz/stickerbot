import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Camera,
  Copy,
  Crown,
  Link2,
  LogOut,
  MessageSquare,
  MoreVertical,
  Plus,
  RefreshCw,
  Shield,
  ShieldOff,
  UserMinus,
  UserPlus,
  Users
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

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
  Select,
  SwitchRow,
  Tabs,
  Textarea,
  useUi
} from '../components/ui'
import { enc, fileToDataUrl, get, patch, post } from '../lib/api'
import { displayName, formatDate, formatPhone } from '../lib/format'
import type { GroupDetail, GroupSummary, Participant } from '../lib/types'

type GroupFilter = 'all' | 'admin' | 'official' | 'muted' | 'community'

const GroupList = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useUi()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<GroupFilter>('all')
  const [joinOpen, setJoinOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [link, setLink] = useState('')
  const [subject, setSubject] = useState('')
  const [members, setMembers] = useState('')
  const [busy, setBusy] = useState(false)
  const query = useQuery({ queryKey: ['groups'], queryFn: () => get<GroupSummary[]>('/groups') })

  const groups = useMemo(() => {
    const s = search.toLowerCase()
    return (query.data || []).filter(g => {
      if (s && !g.subject.toLowerCase().includes(s) && !g.jid.includes(s)) return false
      if (filter === 'admin') return g.amAdmin
      if (filter === 'official') return g.official
      if (filter === 'muted') return g.muted
      if (filter === 'community') return g.isCommunity || !!g.linkedParent
      return true
    })
  }, [query.data, search, filter])

  const join = async () => {
    setBusy(true)
    try {
      const res = await post<{ jid: string | null }>('/groups/join', { link })
      toast('O bot entrou no grupo')
      setJoinOpen(false)
      setLink('')
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      if (res.jid) navigate(`/grupos/${enc(res.jid)}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    } finally {
      setBusy(false)
    }
  }

  const create = async () => {
    setBusy(true)
    try {
      const res = await post<{ jid: string }>('/groups/create', { subject, participants: members.split(/[\n,;]/).map(s => s.trim()).filter(Boolean) })
      toast('Grupo criado')
      setCreateOpen(false)
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      navigate(`/grupos/${enc(res.jid)}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page>
      <PageHeader
        title="Grupos"
        subtitle={query.data ? `O bot está em ${query.data.length} grupos` : undefined}
        actions={<>
          <Button variant="ghost" icon={<RefreshCw className="size-4" />} loading={query.isFetching}
            onClick={() => get<GroupSummary[]>('/groups?refresh=1').then(d => queryClient.setQueryData(['groups'], d))}>Atualizar</Button>
          <Button variant="outline" icon={<Link2 className="size-4" />} onClick={() => setJoinOpen(true)}>Entrar por link</Button>
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreateOpen(true)}>Criar grupo</Button>
        </>}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar grupo" className="sm:w-80" />
        <Tabs<GroupFilter> value={filter} onChange={setFilter} items={[
          { value: 'all', label: 'Todos' },
          { value: 'admin', label: 'Bot é admin' },
          { value: 'official', label: 'Oficiais' },
          { value: 'muted', label: 'Silenciados' },
          { value: 'community', label: 'Comunidade' }
        ]} />
      </div>

      <Card padded={false}>
        {query.isLoading ? <Loading /> : query.error ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : groups.length === 0 ? (
          <EmptyState icon={<Users />} title="Nenhum grupo encontrado" />
        ) : (
          <ul className="divide-y divide-border">
            {groups.map(g => (
              <li key={g.jid}>
                <Link to={`/grupos/${enc(g.jid)}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <Avatar jid={g.jid} name={g.subject} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate font-medium">{g.subject}</span>
                      {g.isCommunity && <Badge tone="info">Comunidade</Badge>}
                      {g.isCommunityAnnounce && <Badge tone="info">Avisos</Badge>}
                      {g.official && <Badge tone="accent">Oficial</Badge>}
                      {g.muted && <Badge tone="warning">Silenciado</Badge>}
                      {g.isLogs && <Badge tone="violet">Logs</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-text-3">
                      {g.size} participantes · {g.admins} admins{g.announce ? ' · só admins enviam' : ''}
                    </div>
                  </div>
                  {g.amAdmin ? <Badge tone="accent"><Shield className="size-3" />Bot admin</Badge> : <Badge>Bot membro</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={joinOpen} onClose={() => setJoinOpen(false)} title="Entrar em um grupo" size="sm"
        footer={<><Button variant="ghost" onClick={() => setJoinOpen(false)}>Cancelar</Button><Button variant="primary" loading={busy} onClick={join}>Entrar</Button></>}>
        <Field label="Link de convite" help="https://chat.whatsapp.com/...">
          <Input autoFocus value={link} onChange={e => setLink(e.target.value)} placeholder="https://chat.whatsapp.com/ABC123..." />
        </Field>
      </Modal>
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Criar grupo"
        footer={<><Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button variant="primary" loading={busy} onClick={create}>Criar</Button></>}>
        <div className="space-y-4">
          <Field label="Nome do grupo"><Input autoFocus value={subject} onChange={e => setSubject(e.target.value)} /></Field>
          <Field label="Participantes" help="Um número por linha, com DDI e DDD.">
            <Textarea value={members} onChange={e => setMembers(e.target.value)} placeholder={'5581999999999\n5581988888888'} />
          </Field>
        </div>
      </Modal>
    </Page>
  )
}

const ParticipantRow = ({ p, group, onAction }: {
  p: Participant
  group: GroupDetail
  onAction: (action: 'remove' | 'promote' | 'demote', p: Participant) => void
}) => {
  const [menu, setMenu] = useState(false)
  const name = displayName(p.name, p.phone, p.jid)
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <Avatar jid={p.jid} name={name} size={38} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-medium">{p.isMe ? `${name} (o bot)` : name}</span>
          {p.admin && <Badge tone="accent">{p.admin === 'superadmin' ? 'Criador' : 'Admin'}</Badge>}
          {p.isBotAdmin && <Badge tone="info">Admin do bot</Badge>}
          {p.isVip && <Badge tone="violet"><Crown className="size-3" />VIP</Badge>}
          {p.isBanned && <Badge tone="danger">Banido</Badge>}
        </div>
        <div className="truncate text-xs text-text-3">{p.phone ? formatPhone(p.phone) : p.jid}</div>
      </div>
      {!p.isMe && (
        <div className="relative">
          <Button variant="ghost" size="icon-sm" onClick={() => setMenu(v => !v)} aria-label="Ações"><MoreVertical className="size-4" /></Button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="animate-fade-in absolute right-0 top-9 z-20 w-56 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-card">
                <Link to={`/conversas/${enc(p.phone ? `${p.phone}@s.whatsapp.net` : p.jid)}`}
                  className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-surface-2"><MessageSquare className="size-4 text-text-3" />Conversar no privado</Link>
                {group.amAdmin && (
                  <>
                    {p.admin
                      ? <button onClick={() => { setMenu(false); onAction('demote', p) }} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-surface-2"><ShieldOff className="size-4 text-text-3" />Tirar admin</button>
                      : <button onClick={() => { setMenu(false); onAction('promote', p) }} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-surface-2"><Shield className="size-4 text-text-3" />Tornar admin</button>}
                    <button onClick={() => { setMenu(false); onAction('remove', p) }} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-danger hover:bg-surface-2"><UserMinus className="size-4" />Remover do grupo</button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </li>
  )
}

const GroupPage = ({ jid }: { jid: string }) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast, confirm } = useUi()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(false)
  const [subject, setSubject] = useState('')
  const [desc, setDesc] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [toAdd, setToAdd] = useState('')
  const [invite, setInvite] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)
  const query = useQuery({ queryKey: ['group', jid], queryFn: () => get<GroupDetail>(`/groups/${enc(jid)}`) })
  const g = query.data

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['group', jid] })
    queryClient.invalidateQueries({ queryKey: ['groups'] })
  }

  const run = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn()
      toast(message)
      refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    }
  }

  const participants = useMemo(() => {
    const s = search.toLowerCase().replace(/\D/g, '') || search.toLowerCase()
    return (g?.participants || []).filter(p => !search || (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.phone || '').includes(s) || p.jid.includes(s))
  }, [g, search])

  if (query.isLoading) return <Page><Loading /></Page>
  if (query.error || !g) return <Page><ErrorState error={query.error} onRetry={() => query.refetch()} /></Page>

  const onAction = async (action: 'remove' | 'promote' | 'demote', p: Participant) => {
    const name = displayName(p.name, p.phone, p.jid)
    if (action === 'remove' && !await confirm({ title: `Remover ${name}?`, confirmLabel: 'Remover', danger: true })) return
    await run(() => post(`/groups/${enc(jid)}/participants`, { action, participants: [p.jid] }),
      { remove: 'Removido do grupo', promote: 'Agora é admin', demote: 'Não é mais admin' }[action])
  }

  const add = async () => {
    setBusy(true)
    try {
      const list = toAdd.split(/[\n,;]/).map(s => s.trim()).filter(Boolean)
      const res = await post<{ result: { jid: string, status: string }[] }>(`/groups/${enc(jid)}/participants`, { action: 'add', participants: list })
      const failed = res.result.filter(r => r.status !== '200')
      toast(failed.length ? `${list.length - failed.length} adicionados, ${failed.length} falharam (privacidade ou número inválido)` : 'Participantes adicionados',
        failed.length ? 'info' : 'success')
      setAddOpen(false)
      setToAdd('')
      refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    } finally {
      setBusy(false)
    }
  }

  const saveInfo = () => run(async () => {
    await patch(`/groups/${enc(jid)}`, { subject, desc })
    setEditing(false)
  }, 'Grupo atualizado')

  return (
    <Page>
      <button onClick={() => navigate('/grupos')} className="mb-4 flex items-center gap-1 text-sm text-text-3 hover:text-text">
        <ArrowLeft className="size-4" /> Grupos
      </button>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative w-fit">
          <Avatar jid={jid} name={g.subject} size={88} />
          {g.amAdmin && (
            <button onClick={() => photoRef.current?.click()} aria-label="Trocar foto"
              className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full bg-accent text-accent-text shadow">
              <Camera className="size-4" />
            </button>
          )}
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={async e => {
            const f = e.target.files?.[0]
            if (f) await run(async () => post(`/groups/${enc(jid)}/picture`, { data: await fileToDataUrl(f) }), 'Foto atualizada')
          }} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{g.subject}</h1>
          <div className="mt-1 text-sm text-text-3">
            {g.size} participantes · {g.admins} admins{g.creation ? ` · criado em ${formatDate(g.creation)}` : ''}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {g.amAdmin ? <Badge tone="accent"><Shield className="size-3" />Bot é admin</Badge> : <Badge tone="warning">Bot não é admin</Badge>}
            {g.isCommunity && <Badge tone="info">Comunidade</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<MessageSquare className="size-4" />} onClick={() => navigate(`/conversas/${enc(jid)}`)}>Abrir conversa</Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Card title="Informações" action={g.amAdmin || !g.restrict ? (
            editing
              ? <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button><Button size="sm" variant="primary" onClick={saveInfo}>Salvar</Button></div>
              : <Button size="sm" variant="ghost" onClick={() => { setSubject(g.subject); setDesc(g.desc || ''); setEditing(true) }}>Editar</Button>
          ) : undefined}>
            {editing ? (
              <div className="space-y-4">
                <Field label="Nome"><Input value={subject} onChange={e => setSubject(e.target.value)} maxLength={100} /></Field>
                <Field label="Descrição"><Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={5} /></Field>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm text-text-2">{g.desc || <span className="text-text-3">Sem descrição</span>}</p>
            )}
          </Card>

          <Card title={`Participantes (${g.size})`} padded={false}
            action={g.amAdmin && <Button size="sm" variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setAddOpen(true)}>Adicionar</Button>}>
            <div className="border-b border-border p-3"><SearchInput value={search} onChange={setSearch} placeholder="Buscar participante" /></div>
            <ul className="max-h-[640px] divide-y divide-border overflow-y-auto">
              {participants.map(p => <ParticipantRow key={p.jid} p={p} group={g} onAction={onAction} />)}
            </ul>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="No bot">
            <SwitchRow label="Grupo oficial" help="Responde a mídia sem precisar mencionar o bot." checked={g.official}
              onChange={v => run(() => patch(`/groups/${enc(jid)}`, { official: v }), 'Salvo')} />
            <SwitchRow label="Silenciar o bot aqui" help="O bot ignora tudo que chegar deste grupo." checked={g.muted}
              onChange={v => run(() => patch(`/groups/${enc(jid)}`, { muted: v }), 'Salvo')} />
            <SwitchRow label="Grupo de logs" help="Recebe os avisos do bot." checked={g.isLogs}
              onChange={v => run(() => patch(`/groups/${enc(jid)}`, { isLogs: v }), 'Salvo')} />
            {g.isCommunity && (
              <SwitchRow label="Comunidade do bot" help="Usada pelo ban e pelo convite do !link." checked={g.isBotCommunity}
                onChange={v => run(() => patch(`/groups/${enc(jid)}`, { isBotCommunity: v }), 'Salvo')} />
            )}
          </Card>

          <Card title="Configurações do grupo">
            <SwitchRow label="Só admins enviam mensagens" checked={g.announce} disabled={!g.amAdmin}
              onChange={v => run(() => patch(`/groups/${enc(jid)}`, { announce: v }), 'Salvo')} />
            <SwitchRow label="Só admins editam os dados" checked={g.restrict} disabled={!g.amAdmin}
              onChange={v => run(() => patch(`/groups/${enc(jid)}`, { restrict: v }), 'Salvo')} />
            <div className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-sm">Mensagens temporárias</span>
              <Select className="w-36" value={g.ephemeral} disabled={!g.amAdmin && g.restrict}
                onChange={e => run(() => patch(`/groups/${enc(jid)}`, { ephemeral: Number(e.target.value) }), 'Salvo')}>
                <option value={0}>Desativadas</option>
                <option value={86400}>24 horas</option>
                <option value={604800}>7 dias</option>
                <option value={7776000}>90 dias</option>
              </Select>
            </div>
            {!g.amAdmin && <p className="mt-2 text-xs text-text-3">O bot precisa ser admin para mudar estas opções.</p>}
          </Card>

          {g.amAdmin && (
            <Card title="Link de convite">
              {invite ? (
                <div className="space-y-3">
                  <div className="break-all rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs">{invite}</div>
                  <div className="flex gap-2">
                    <Button size="sm" icon={<Copy className="size-4" />} onClick={() => navigator.clipboard?.writeText(invite).then(() => toast('Link copiado'))}>Copiar</Button>
                    <Button size="sm" variant="ghost" className="text-danger" onClick={async () => {
                      if (await confirm({ title: 'Redefinir link?', message: 'O link atual para de funcionar.', confirmLabel: 'Redefinir', danger: true })) {
                        const res = await post<{ link: string }>(`/groups/${enc(jid)}/invite/revoke`)
                        setInvite(res.link)
                        toast('Link redefinido')
                      }
                    }}>Redefinir</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" icon={<Link2 className="size-4" />}
                  onClick={() => get<{ link: string }>(`/groups/${enc(jid)}/invite`).then(r => setInvite(r.link)).catch(e => toast(e.message, 'error'))}>
                  Mostrar link
                </Button>
              )}
            </Card>
          )}

          <Card>
            <Button variant="ghost" className="w-full justify-start text-danger" icon={<LogOut className="size-4" />} onClick={async () => {
              if (await confirm({ title: `Tirar o bot de "${g.subject}"?`, message: 'O bot sai do grupo. Para voltar, alguém precisa adicionar ou mandar o link.', confirmLabel: 'Sair do grupo', danger: true })) {
                await run(() => post(`/groups/${enc(jid)}/leave`), 'O bot saiu do grupo')
                navigate('/grupos')
              }
            }}>
              Sair do grupo
            </Button>
          </Card>
        </div>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Adicionar participantes"
        footer={<><Button variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button><Button variant="primary" loading={busy} onClick={add}>Adicionar</Button></>}>
        <Field label="Números" help="Um por linha, com DDI e DDD. Quem bloqueia convites vai precisar do link.">
          <Textarea autoFocus value={toAdd} onChange={e => setToAdd(e.target.value)} rows={5} placeholder={'5581999999999'} />
        </Field>
      </Modal>
    </Page>
  )
}

export default function Groups() {
  const params = useParams()
  return params.jid ? <GroupPage key={params.jid} jid={decodeURIComponent(params.jid)} /> : <GroupList />
}
