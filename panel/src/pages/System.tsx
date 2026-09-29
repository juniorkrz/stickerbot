import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { LogOut, Monitor, Pause, Play, RotateCw, Smartphone, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Badge, Button, Card, Loading, Page, PageHeader, SearchInput, Tabs, useUi } from '../components/ui'
import { API_BASE, del, get, post } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useLiveState } from '../lib/events'
import { formatDateTime, formatDuration, formatPhone, formatTime, timeAgo } from '../lib/format'
import type { LogEntry, SystemStatus } from '../lib/types'

type Level = 'all' | 'warn' | 'error'

const Logs = () => {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [paused, setPaused] = useState(false)
  const [level, setLevel] = useState<Level>('all')
  const [search, setSearch] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  useEffect(() => {
    get<LogEntry[]>('/system/logs').then(setEntries).catch(() => undefined)
    // stream próprio com logs=1
    const source = new EventSource(`${API_BASE}/system/events?logs=1`, { withCredentials: true })
    source.addEventListener('log', e => {
      if (pausedRef.current) return
      const entry = JSON.parse((e as MessageEvent).data) as LogEntry
      setEntries(list => (list.length > 1500 ? [...list.slice(-1200), entry] : [...list, entry]))
    })
    return () => source.close()
  }, [])

  const visible = useMemo(() => entries.filter(e =>
    (level === 'all' || (level === 'warn' ? e.level !== 'info' : e.level === 'error')) &&
    (!search || e.message.toLowerCase().includes(search.toLowerCase()))), [entries, level, search])

  useEffect(() => {
    const el = boxRef.current
    if (el && !paused && el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTop = el.scrollHeight
  }, [visible, paused])

  return (
    <Card title="Logs ao vivo" padded={false} action={
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" icon={paused ? <Play className="size-4" /> : <Pause className="size-4" />} onClick={() => setPaused(p => !p)}>
          {paused ? 'Continuar' : 'Pausar'}
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Limpar tela" onClick={() => setEntries([])}><Trash2 className="size-4" /></Button>
      </div>
    }>
      <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Filtrar logs" className="sm:w-72" />
        <Tabs<Level> value={level} onChange={setLevel} items={[
          { value: 'all', label: 'Tudo' },
          { value: 'warn', label: 'Avisos e erros' },
          { value: 'error', label: 'Só erros' }
        ]} />
      </div>
      <div ref={boxRef} className="h-[480px] overflow-y-auto bg-[#0b141a] p-3 font-mono text-[12px] leading-5 text-[#d1d7db]">
        {visible.map(e => (
          <div key={e.id} className="whitespace-pre-wrap break-all">
            <span className="text-[#8696a0]">{formatTime(e.ts)}:{String(new Date(e.ts).getSeconds()).padStart(2, '0')} </span>
            <span className={clsx(e.level === 'error' ? 'text-[#f15c6d]' : e.level === 'warn' ? 'text-[#f0b232]' : 'text-[#53bdeb]')}>
              {e.level.toUpperCase().padEnd(5)}
            </span>{' '}
            {e.message}
          </div>
        ))}
        {visible.length === 0 && <div className="text-[#8696a0]">Nenhuma linha.</div>}
      </div>
    </Card>
  )
}

interface Session {
  id: string
  current: boolean
  ip: string | null
  userAgent: string | null
  createdAt: number
  lastSeenAt: number
  expiresAt: number
}

const deviceName = (ua: string | null) => {
  const u = ua || ''
  const os = /iphone|ipad/i.test(u) ? 'iPhone/iPad' : /android/i.test(u) ? 'Android' : /windows/i.test(u) ? 'Windows'
    : /mac os/i.test(u) ? 'Mac' : /linux/i.test(u) ? 'Linux' : 'Dispositivo'
  const browser = /edg\//i.test(u) ? 'Edge' : /chrome\//i.test(u) ? 'Chrome' : /firefox\//i.test(u) ? 'Firefox'
    : /safari\//i.test(u) ? 'Safari' : ''
  return { label: [browser, os].filter(Boolean).join(' · '), mobile: /iphone|android|mobile/i.test(u) }
}

const Sessions = () => {
  const { toast, confirm } = useUi()
  const query = useQuery({ queryKey: ['sessions'], queryFn: () => get<Session[]>('/auth/sessions') })
  const refresh = () => query.refetch()
  const others = (query.data || []).filter(s => !s.current).length
  return (
    <Card title="Sessões ativas do painel" padded={false} action={others > 0 && (
      <Button size="sm" variant="ghost" className="text-danger" icon={<LogOut className="size-4" />} onClick={async () => {
        if (await confirm({ title: 'Encerrar as outras sessões?', message: 'Todos os outros aparelhos saem do painel na hora.', confirmLabel: 'Encerrar', danger: true })) {
          await post('/auth/sessions/revoke-others').then(() => { toast('Outras sessões encerradas'); refresh() }, e => toast(e.message, 'error'))
        }
      }}>Encerrar as outras</Button>
    )}>
      {query.isLoading ? <Loading /> : (
        <ul className="divide-y divide-border">
          {(query.data || []).map(s => {
            const d = deviceName(s.userAgent)
            return (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                {d.mobile ? <Smartphone className="size-5 text-text-3" /> : <Monitor className="size-5 text-text-3" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">{d.label}{s.current && <Badge tone="accent">Esta sessão</Badge>}</div>
                  <div className="text-xs text-text-3">{s.ip || 'IP desconhecido'} · entrou em {formatDateTime(s.createdAt)} · ativo {timeAgo(s.lastSeenAt)}</div>
                </div>
                {!s.current && (
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() =>
                    del(`/auth/sessions/${s.id}`).then(() => { toast('Sessão encerrada'); refresh() }, e => toast(e.message, 'error'))}>
                    Encerrar
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export default function SystemPage() {
  const { user } = useAuth()
  const { toast, confirm } = useUi()
  const live = useLiveState()
  const [qrKey, setQrKey] = useState(0)
  const status = useQuery({ queryKey: ['system-status'], queryFn: () => get<SystemStatus>('/system/status'), refetchInterval: 10_000 })

  useEffect(() => {
    if (live.whatsapp !== 'open') {
      const t = setInterval(() => setQrKey(k => k + 1), 15_000)
      return () => clearInterval(t)
    }
  }, [live.whatsapp])

  const s = status.data
  const restart = async () => {
    if (!await confirm({ title: 'Reiniciar o bot?', message: 'O bot fica fora do ar por alguns segundos e volta sozinho.', confirmLabel: 'Reiniciar' })) return
    await post('/system/restart').then(() => toast('Reiniciando... o painel reconecta sozinho', 'info'), e => toast(e.message, 'error'))
  }

  return (
    <Page>
      <PageHeader title="Sistema e logs"
        actions={user?.isOwner && <Button variant="outline" icon={<RotateCw className="size-4" />} onClick={restart}>Reiniciar bot</Button>} />
      {!s ? <Loading /> : (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="WhatsApp">
            <div className="flex items-center gap-2">
              <span className={clsx('size-2.5 rounded-full', live.whatsapp === 'open' ? 'bg-accent' : live.whatsapp === 'connecting' ? 'bg-warning' : 'bg-danger')} />
              <span className="font-medium">{live.whatsapp === 'open' ? 'Conectado' : live.whatsapp === 'connecting' ? 'Conectando' : 'Desconectado'}</span>
              <span className="text-sm text-text-3">desde {formatDateTime(s.connection.since)}</span>
            </div>
            {s.me && <div className="mt-2 text-sm text-text-2">{s.me.name} · {formatPhone(s.me.phone)}</div>}
            {live.whatsapp !== 'open' && live.hasQr && (
              <div className="mt-4 text-center">
                <img key={qrKey} src={`${API_BASE}/system/qr?k=${qrKey}`} alt="QR Code" className="mx-auto w-56 rounded-lg bg-white p-2" />
                <p className="mt-2 text-xs text-text-3">No celular do bot: WhatsApp › Aparelhos conectados › Conectar aparelho</p>
              </div>
            )}
          </Card>
          <Card title="Bot">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-text-3">Versão</dt><dd>v{s.bot.version}</dd></div>
              <div className="flex justify-between"><dt className="text-text-3">Comandos ativos</dt><dd>{s.bot.commands}</dd></div>
              <div className="flex justify-between"><dt className="text-text-3">No ar há</dt><dd>{formatDuration((Date.now() - s.startedAt) / 1000)}</dd></div>
              <div className="flex justify-between"><dt className="text-text-3">Memória do processo</dt><dd>{s.process.memoryMb} MB</dd></div>
              <div className="flex justify-between"><dt className="text-text-3">Node</dt><dd>{s.process.node}</dd></div>
            </dl>
          </Card>
          <Card title="Servidor">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-text-3">Carga (1/5/15 min)</dt><dd className="tabular">{s.host.loadavg.map(l => l.toFixed(2)).join(' / ')}</dd></div>
              <div className="flex justify-between"><dt className="text-text-3">Memória livre</dt><dd>{(s.host.freeMemMb / 1024).toFixed(1)} de {(s.host.totalMemMb / 1024).toFixed(1)} GB</dd></div>
              <div className="flex justify-between"><dt className="text-text-3">Ligado há</dt><dd>{formatDuration(s.host.uptime)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-text-3">Admins no painel</dt>
                <dd className="flex flex-wrap justify-end gap-1">{s.onlineAdmins.map(a => <Badge key={a} tone="accent">{formatPhone(a)}</Badge>)}</dd></div>
            </dl>
          </Card>
          <div className="lg:col-span-3"><Sessions /></div>
          <div className="lg:col-span-3"><Logs /></div>
        </div>
      )}
    </Page>
  )
}
