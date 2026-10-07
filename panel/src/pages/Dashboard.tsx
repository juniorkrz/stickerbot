import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowDownRight, ArrowUpRight, Info } from 'lucide-react'
import { ReactNode, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Card, ErrorState, Loading, Page, PageHeader, Table, Tabs, Td, Th } from '../components/ui'
import { get } from '../lib/api'
import { compactNumber, formatDate, formatNumber, formatPhone, timeAgo } from '../lib/format'
import type { DayPoint, Overview } from '../lib/types'

type Period = '7' | '30' | '90'

const Stat = ({ label, value, sub, delta, to }: {
  label: string
  value: ReactNode
  sub?: ReactNode
  delta?: number | null
  to?: string
}) => {
  const body = (
    <div className="h-full rounded-xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-text-3/40">
      <div className="text-[13px] text-text-3">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-text-3">
        {delta !== undefined && delta !== null && (
          <span className={clsx('inline-flex items-center font-medium', delta >= 0 ? 'text-accent' : 'text-danger')}>
            {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(delta).toFixed(0)}%
          </span>
        )}
        {sub}
      </div>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

// Barras horizontais em HTML (ranking)
const RankList = ({ items, empty }: { items: { key: string, label: ReactNode, sub?: ReactNode, value: number }[], empty: string }) => {
  const max = Math.max(1, ...items.map(i => i.value))
  if (items.length === 0) return <div className="py-8 text-center text-sm text-text-3">{empty}</div>
  return (
    <ol className="space-y-3">
      {items.map((item, idx) => (
        <li key={item.key} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              <span className="tabular mr-2 text-text-3">{idx + 1}</span>
              {item.label}
              {item.sub && <span className="ml-2 text-xs text-text-3">{item.sub}</span>}
            </span>
            <span className="tabular shrink-0 font-medium">{formatNumber(item.value)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-[var(--series-1)]" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  )
}

const HEAT_STEPS = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b']
const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const Heatmap = ({ data }: { data: { dow: number, hour: number, count: number }[] }) => {
  const [hover, setHover] = useState<{ dow: number, hour: number, count: number } | null>(null)
  const grid = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array(24).fill(0) as number[])
    for (const d of data) g[d.dow][d.hour] = d.count
    return g
  }, [data])
  const max = Math.max(1, ...data.map(d => d.count))
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="grid grid-cols-[36px_repeat(24,1fr)] gap-[2px]">
            {grid.map((row, dow) => [
              <div key={`l${dow}`} className="pr-2 text-right text-[11px] leading-5 text-text-3">{DAYS[dow]}</div>,
              ...row.map((count, hour) => (
                <div
                  key={`${dow}-${hour}`}
                  onMouseEnter={() => setHover({ dow, hour, count })}
                  onMouseLeave={() => setHover(null)}
                  className="h-5 rounded-[3px] ring-offset-1 hover:ring-2 hover:ring-text-3"
                  style={{
                    background: count === 0 ? 'var(--surface-2)' : HEAT_STEPS[Math.min(HEAT_STEPS.length - 1, Math.floor((count / max) * HEAT_STEPS.length))]
                  }}
                />
              ))
            ])}
          </div>
          <div className="mt-1 grid grid-cols-[36px_repeat(24,1fr)] gap-[2px] text-[10px] text-text-3">
            <div />
            {Array.from({ length: 24 }, (_, h) => <div key={h} className="text-center">{h % 3 === 0 ? `${h}h` : ''}</div>)}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-text-3">
        <span className="tabular">
          {hover ? `${DAYS[hover.dow]}, ${hover.hour}h–${hover.hour + 1}h: ${formatNumber(hover.count)} usos` : 'Passe o mouse para ver os valores'}
        </span>
        <span className="flex items-center gap-1">
          menos
          {HEAT_STEPS.map(c => <span key={c} className="size-3 rounded-sm" style={{ background: c }} />)}
          mais
        </span>
      </div>
    </div>
  )
}

const ChartTooltip = ({ active, payload, label }: {
  active?: boolean
  payload?: { name: string, value: number, color: string }[]
  label?: string
}) => {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + p.value, 0)
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-card">
      <div className="mb-1 font-medium text-text">{label ? new Date(`${label}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : ''}</div>
      {[...payload].reverse().map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4 text-text-2">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ background: p.color }} />{p.name}</span>
          <span className="tabular font-medium text-text">{formatNumber(p.value)}</span>
        </div>
      ))}
      <div className="mt-1 flex justify-between gap-4 border-t border-border pt-1 text-text-2">
        <span>Total</span><span className="tabular font-medium text-text">{formatNumber(total)}</span>
      </div>
    </div>
  )
}

const shortDate = (d: string) => {
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>('30')
  const [showTable, setShowTable] = useState(false)
  const overview = useQuery({ queryKey: ['stats', 'overview'], queryFn: () => get<Overview>('/stats/overview'), refetchInterval: 30_000 })
  const series = useQuery({ queryKey: ['stats', 'ts', period], queryFn: () => get<DayPoint[]>(`/stats/timeseries?days=${period}`) })
  const commands = useQuery({
    queryKey: ['stats', 'commands', period],
    queryFn: () => get<{ period: { command: string, count: number }[], allTime: { command: string, count: number }[] }>(`/stats/commands?days=${period}`)
  })
  const groups = useQuery({
    queryKey: ['stats', 'groups', period],
    queryFn: () => get<{ jid: string, name: string, count: number, users: number }[]>(`/stats/top-groups?days=${period}`)
  })
  const users = useQuery({
    queryKey: ['stats', 'users', period],
    queryFn: () => get<{ sender: string, name: string | null, count: number, last: number }[]>(`/stats/top-users?days=${period}`)
  })
  const heat = useQuery({
    queryKey: ['stats', 'heat', period],
    queryFn: () => get<{ dow: number, hour: number, count: number }[]>(`/stats/heatmap?days=${period}`)
  })

  if (overview.isLoading) return <Page><Loading /></Page>
  if (overview.error) return <Page><ErrorState error={overview.error} onRetry={() => overview.refetch()} /></Page>
  const o = overview.data!
  const delta = o.prev7 > 0 ? ((o.last7 - o.prev7) / o.prev7) * 100 : null
  const periodTotal = (series.data || []).reduce((s, d) => s + d.total, 0)

  return (
    <Page>
      <PageHeader
        title="Visão geral"
        subtitle="Uso do bot, atendimento e moderação"
        actions={
          <Tabs<Period> value={period} onChange={setPeriod} items={[
            { value: '7', label: '7 dias' },
            { value: '30', label: '30 dias' },
            { value: '90', label: '90 dias' }
          ]} />
        }
      />

      {o.trackingSince && Date.now() - o.trackingSince < 7 * 86_400_000 && (
        <div className="mb-5 flex items-start gap-2 rounded-lg bg-info-soft px-4 py-3 text-sm text-info">
          <Info className="mt-0.5 size-4 shrink-0" />
          As estatísticas detalhadas (por dia, grupo e usuário) começaram a ser registradas em {formatDate(o.trackingSince)}.
          Os totais históricos vêm dos contadores antigos do bot.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Usos hoje" value={formatNumber(o.today)} sub={`${formatNumber(o.stickersToday)} figurinhas`} />
        <Stat label="Últimos 7 dias" value={compactNumber(o.last7)} delta={delta} sub="vs. 7 dias anteriores" />
        <Stat label="Usuários ativos (7d)" value={formatNumber(o.users7)} sub={`em ${formatNumber(o.chats7)} conversas`} />
        <Stat label="Aguardando resposta" value={formatNumber(o.waiting)} sub={`${formatNumber(o.unread)} não lidas`} to="/conversas" />
        <Stat label="Figurinhas (histórico)" value={compactNumber(o.allTime.stickers)} sub={`${compactNumber(o.allTime.total)} usos no total`} />
        <Stat label="VIPs ativos" value={formatNumber(o.vips)} to="/vips" sub={`${formatNumber(o.bans)} banidos`} />
        <Stat label="Grupos" value={formatNumber(o.groups)} to="/grupos" sub={`${formatNumber(o.chats)} conversas no painel`} />
        <Stat label="Anúncios enviados" value={compactNumber(o.adsSent)} to="/anuncios" sub={`${o.adsActive} ativos`} />
      </div>

      <Card
        className="mt-5"
        title={<span>Uso por dia <span className="ml-1 text-sm font-normal text-text-3">{formatNumber(periodTotal)} no período</span></span>}
        action={<button className="text-xs font-medium text-accent hover:underline" onClick={() => setShowTable(v => !v)}>
          {showTable ? 'Ver gráfico' : 'Ver tabela'}
        </button>}
      >
        <div className="mb-3 flex items-center gap-4 text-xs text-text-2">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[var(--series-1)]" />Figurinhas</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[var(--series-2)]" />Outros comandos</span>
        </div>
        {series.isLoading ? <Loading /> : showTable ? (
          <Table className="max-h-80 overflow-y-auto">
            <thead><tr><Th>Dia</Th><Th className="text-right">Figurinhas</Th><Th className="text-right">Comandos</Th><Th className="text-right">Usuários</Th></tr></thead>
            <tbody>
              {[...(series.data || [])].reverse().map(d => (
                <tr key={d.date}>
                  <Td>{shortDate(d.date)}</Td>
                  <Td className="tabular text-right">{formatNumber(d.stickers)}</Td>
                  <Td className="tabular text-right">{formatNumber(d.commands)}</Td>
                  <Td className="tabular text-right">{formatNumber(d.users)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series.data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barCategoryGap="20%">
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false}
                  minTickGap={16} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false}
                  tickFormatter={v => compactNumber(v)} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="stickers" name="Figurinhas" stackId="a" fill="var(--series-1)" stroke="var(--surface)" strokeWidth={1}
                  maxBarSize={24} />
                <Bar dataKey="commands" name="Outros comandos" stackId="a" fill="var(--series-2)" stroke="var(--surface)" strokeWidth={1}
                  radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Comandos mais usados">
          {commands.isLoading ? <Loading /> : (
            <RankList
              empty="Nenhum uso registrado no período"
              items={(commands.data?.period || []).slice(0, 10).map(c => ({ key: c.command, label: c.command, value: c.count }))}
            />
          )}
        </Card>
        <Card title="Horários de pico">
          {heat.isLoading ? <Loading /> : <Heatmap data={heat.data || []} />}
        </Card>
        <Card title="Grupos mais ativos">
          {groups.isLoading ? <Loading /> : (
            <RankList
              empty="Nenhum uso em grupos no período"
              items={(groups.data || []).slice(0, 10).map(g => ({
                key: g.jid,
                label: <Link to={`/grupos/${encodeURIComponent(g.jid)}`} className="hover:underline">{g.name}</Link>,
                sub: `${g.users} pessoas`,
                value: g.count
              }))}
            />
          )}
        </Card>
        <Card title="Quem mais usa">
          {users.isLoading ? <Loading /> : (
            <RankList
              empty="Nenhum uso no período"
              items={(users.data || []).slice(0, 10).map(u => ({
                key: u.sender,
                label: u.name || (/^\d+$/.test(u.sender) ? formatPhone(u.sender) : u.sender),
                sub: timeAgo(u.last),
                value: u.count
              }))}
            />
          )}
        </Card>
      </div>

      <Card className="mt-5" title="Contadores históricos" padded={false}>
        {commands.isLoading ? <Loading /> : (
          <Table className="max-h-96 overflow-y-auto">
            <thead><tr><Th>Ação</Th><Th className="text-right">Total</Th></tr></thead>
            <tbody>
              {(commands.data?.allTime || []).map(c => (
                <tr key={c.command}><Td>{c.command}</Td><Td className="tabular text-right">{formatNumber(c.count)}</Td></tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </Page>
  )
}
