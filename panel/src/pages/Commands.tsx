import { useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { RotateCcw, TerminalSquare } from 'lucide-react'
import { ReactNode, useEffect, useMemo, useState } from 'react'

import {
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
  Switch,
  Tabs,
  Textarea,
  useUi
} from '../components/ui'
import { get, patch, post } from '../lib/api'
import { formatNumber } from '../lib/format'
import type { Command, CommandFields } from '../lib/types'

type Filter = 'all' | 'active' | 'disabled' | 'maintenance' | 'custom'

const Toggle = ({ label, help, value, onChange, changed }: {
  label: string
  help?: string
  value: boolean
  onChange: (v: boolean) => void
  changed?: boolean
}) => (
  <div className="flex items-start justify-between gap-4 py-2">
    <div>
      <div className="flex items-center gap-1.5 text-sm">
        {label}
        {changed && <span className="size-1.5 rounded-full bg-info" title="Alterado em relação ao padrão" />}
      </div>
      {help && <div className="text-xs text-text-3">{help}</div>}
    </div>
    <Switch checked={value} onChange={onChange} label={label} />
  </div>
)

const Section = ({ title, children }: { title: string, children: ReactNode }) => (
  <div>
    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-3">{title}</div>
    <div className="divide-y divide-border">{children}</div>
  </div>
)

const CommandEditor = ({ command, onClose, onSaved }: { command: Command | null, onClose: () => void, onSaved: () => void }) => {
  const { toast, confirm } = useUi()
  const [form, setForm] = useState<CommandFields | null>(null)
  const [aliases, setAliases] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!command) return
    setForm({ ...command })
    setAliases(command.aliases.join(', '))
  }, [command])

  if (!command || !form) return null
  const set = <K extends keyof CommandFields>(key: K, value: CommandFields[K]) => setForm(f => f && { ...f, [key]: value })
  const changed = (key: keyof CommandFields) => JSON.stringify(form[key] ?? false) !== JSON.stringify(command.defaults[key] ?? false)

  const save = async () => {
    setBusy(true)
    try {
      await patch(`/commands/${command.key}`, { ...form, aliases: aliases.split(',').map(a => a.trim()).filter(Boolean) })
      toast('Comando salvo')
      onSaved()
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    } finally {
      setBusy(false)
    }
  }

  const reset = async () => {
    if (!await confirm({ title: 'Restaurar o padrão?', message: 'Todas as personalizações deste comando serão desfeitas.', confirmLabel: 'Restaurar' })) return
    await post(`/commands/${command.key}/reset`).then(() => { toast('Padrão restaurado'); onSaved(); onClose() }, e => toast(e.message, 'error'))
  }

  return (
    <Modal open onClose={onClose} title={<span>Comando <span className="font-mono text-accent">!{command.aliases[0]}</span></span>} size="lg"
      footer={<>
        {command.overridden.length > 0 && <Button variant="ghost" className="mr-auto" icon={<RotateCcw className="size-4" />} onClick={reset}>Restaurar padrão</Button>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={busy} onClick={save}>Salvar</Button>
      </>}>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Toggle label="Comando ativo" help="Desativado, ele some do menu e os nomes ficam livres." value={!form.disabled}
            onChange={v => set('disabled', !v)} changed={changed('disabled')} />
          <Field label="Nomes (aliases)" help="Separados por vírgula, sem o prefixo. O primeiro aparece no menu.">
            <Input value={aliases} onChange={e => setAliases(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Descrição (aparece no menu)"><Textarea rows={3} value={form.desc} onChange={e => set('desc', e.target.value)} /></Field>
          <Field label="Exemplo de uso" help="O que vem depois do comando. Ex.: texto de exemplo">
            <Input value={form.example || ''} onChange={e => set('example', e.target.value)} />
          </Field>
          <Field label="Intervalo entre usos (segundos)" help="Por pessoa. VIPs e admins esperam a metade. 0 = sem intervalo.">
            <Input type="number" min={0} value={form.interval} onChange={e => set('interval', Number(e.target.value))} className="w-32" />
          </Field>
        </div>
        <div className="space-y-5">
          <Section title="Funcionamento">
            <Toggle label="Em manutenção" help="Responde que está em manutenção (admins do bot ainda usam)." value={form.inMaintenance}
              onChange={v => set('inMaintenance', v)} changed={changed('inMaintenance')} />
            <Toggle label="Precisa de prefixo" help="Ex.: !comando. Sem prefixo, a palavra sozinha já dispara." value={form.needsPrefix}
              onChange={v => set('needsPrefix', v)} changed={changed('needsPrefix')} />
            <Toggle label="Não conta para anúncios" value={!!form.skipAds} onChange={v => set('skipAds', v)} changed={changed('skipAds')} />
          </Section>
          <Section title="Onde funciona">
            <Toggle label="No privado" value={form.runInPrivate} onChange={v => set('runInPrivate', v)} changed={changed('runInPrivate')} />
            <Toggle label="Em grupos" value={form.runInGroups} onChange={v => set('runInGroups', v)} changed={changed('runInGroups')} />
            <Toggle label="Só nos grupos oficiais" value={form.onlyInBotGroup} onChange={v => set('onlyInBotGroup', v)} changed={changed('onlyInBotGroup')} />
          </Section>
          <Section title="Quem pode usar">
            <Toggle label="Só admins do bot" value={form.onlyBotAdmin} onChange={v => set('onlyBotAdmin', v)} changed={changed('onlyBotAdmin')} />
            <Toggle label="Só admins do grupo" value={form.onlyAdmin} onChange={v => set('onlyAdmin', v)} changed={changed('onlyAdmin')} />
            <Toggle label="Só VIPs" help="Vale quando o sistema VIP está ligado." value={form.onlyVip} onChange={v => set('onlyVip', v)} changed={changed('onlyVip')} />
            <Toggle label="O bot precisa ser admin do grupo" value={form.botMustBeAdmin} onChange={v => set('botMustBeAdmin', v)} changed={changed('botMustBeAdmin')} />
          </Section>
        </div>
      </div>
    </Modal>
  )
}

export default function Commands() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<Command | null>(null)
  const query = useQuery({ queryKey: ['commands'], queryFn: () => get<Command[]>('/commands') })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['commands'] })

  const list = useMemo(() => (query.data || []).filter(c => {
    const s = search.toLowerCase().replace(/^[!/#@.]/, '')
    if (s && !c.name.toLowerCase().includes(s) && !c.aliases.some(a => a.toLowerCase().includes(s)) && !c.desc.toLowerCase().includes(s)) return false
    if (filter === 'active') return !c.disabled
    if (filter === 'disabled') return c.disabled
    if (filter === 'maintenance') return c.inMaintenance
    if (filter === 'custom') return c.overridden.length > 0
    return true
  }), [query.data, search, filter])

  const active = (query.data || []).filter(c => !c.disabled).length

  return (
    <Page>
      <PageHeader title="Comandos" subtitle={query.data ? `${active} de ${query.data.length} comandos ativos. As mudanças valem na hora, sem reiniciar.` : undefined} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar comando" className="sm:w-80" />
        <Tabs<Filter> value={filter} onChange={setFilter} items={[
          { value: 'all', label: 'Todos' },
          { value: 'active', label: 'Ativos' },
          { value: 'disabled', label: 'Desativados' },
          { value: 'maintenance', label: 'Em manutenção' },
          { value: 'custom', label: 'Personalizados' }
        ]} />
      </div>
      <Card padded={false}>
        {query.isLoading ? <Loading /> : query.error ? <ErrorState error={query.error} /> : list.length === 0 ? (
          <EmptyState icon={<TerminalSquare />} title="Nenhum comando encontrado" />
        ) : (
          <ul className="divide-y divide-border">
            {list.map(c => (
              <li key={c.key}>
                <button onClick={() => setEditing(c)} className={clsx('flex w-full items-start gap-4 px-4 py-3 text-left hover:bg-surface-2', c.disabled && 'opacity-55')}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-sm font-semibold text-accent">{c.needsPrefix ? '!' : ''}{c.aliases[0]}</span>
                      {c.aliases.slice(1, 5).map(a => <span key={a} className="font-mono text-xs text-text-3">{c.needsPrefix ? '!' : ''}{a}</span>)}
                      {c.aliases.length > 5 && <span className="text-xs text-text-3">+{c.aliases.length - 5}</span>}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-sm text-text-2">{c.desc}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {c.disabled && <Badge tone="danger">Desativado</Badge>}
                      {c.inMaintenance && <Badge tone="warning">Manutenção</Badge>}
                      {c.onlyBotAdmin && <Badge tone="info">Admin do bot</Badge>}
                      {c.onlyAdmin && <Badge tone="info">Admin do grupo</Badge>}
                      {c.onlyVip && <Badge tone="violet">VIP</Badge>}
                      {!c.runInPrivate && <Badge>Só grupos</Badge>}
                      {!c.runInGroups && <Badge>Só privado</Badge>}
                      {c.onlyInBotGroup && <Badge>Grupo oficial</Badge>}
                      {c.interval > 0 && <Badge>{c.interval}s</Badge>}
                      {c.overridden.length > 0 && <Badge tone="accent">Personalizado</Badge>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="tabular text-sm font-medium">{formatNumber(c.usage30d)}</div>
                    <div className="text-xs text-text-3">usos/30d</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <CommandEditor command={editing} onClose={() => setEditing(null)} onSaved={refresh} />
    </Page>
  )
}
