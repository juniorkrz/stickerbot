import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, Lock, RotateCw, X } from 'lucide-react'
import { KeyboardEvent, ReactNode, useMemo, useState } from 'react'

import { get, post, put } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { ConfigField, GroupSummary } from '../lib/types'
import { Badge, Button, Card, Field, Input, SearchInput, Select, Switch, Textarea, useUi } from './ui'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Values = Record<string, any>

const ListInput = ({ value, onChange, placeholder }: { value: string[], onChange: (v: string[]) => void, placeholder?: string }) => {
  const [draft, setDraft] = useState('')
  const add = () => {
    const items = draft.split(/[,;]/).map(s => s.trim()).filter(Boolean)
    if (items.length) onChange(Array.from(new Set([...value, ...items])))
    setDraft('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add()
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5 focus-within:border-accent">
      {value.map(v => (
        <span key={v} className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 font-mono text-sm">
          {v}
          <button type="button" onClick={() => onChange(value.filter(x => x !== v))} className="text-text-3 hover:text-danger" aria-label={`Remover ${v}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={onKey} onBlur={add} placeholder={value.length ? '' : placeholder}
        className="min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-text-3" />
    </div>
  )
}

const GroupsPicker = ({ value, onChange, groups }: { value: string[], onChange: (v: string[]) => void, groups: GroupSummary[] }) => {
  const [search, setSearch] = useState('')
  const byJid = new Map(groups.map(g => [g.jid, g]))
  const filtered = groups.filter(g => !search || g.subject.toLowerCase().includes(search.toLowerCase()))
  return (
    <div className="rounded-lg border border-border">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-border p-2">
          {value.map(jid => (
            <span key={jid} className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-sm text-accent">
              {byJid.get(jid)?.subject || jid}
              <button type="button" onClick={() => onChange(value.filter(v => v !== jid))} aria-label="Remover"><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="p-2"><SearchInput value={search} onChange={setSearch} placeholder="Buscar grupo" /></div>
      <ul className="max-h-48 overflow-y-auto">
        {filtered.map(g => {
          const on = value.includes(g.jid)
          return (
            <li key={g.jid}>
              <button type="button" onClick={() => onChange(on ? value.filter(v => v !== g.jid) : [...value, g.jid])}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-2">
                <span className={`flex size-4 items-center justify-center rounded border ${on ? 'border-accent bg-accent text-accent-text' : 'border-border'}`}>
                  {on && <Check className="size-3" />}
                </span>
                <span className="truncate">{g.subject}</span>
                <span className="ml-auto text-xs text-text-3">{g.size}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const FieldInput = ({ field, value, onChange, groups }: {
  field: ConfigField
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (v: any) => void
  groups: GroupSummary[]
}) => {
  if (field.readonly) return <Input value={String(value ?? '')} disabled />
  switch (field.type) {
  case 'boolean':
    return <Switch checked={!!value} onChange={onChange} label={field.label} />
  case 'number':
    return <Input type="number" min={field.min} max={field.max} value={value ?? ''} onChange={e => onChange(e.target.value)} className="w-40" />
  case 'text':
    return <Textarea rows={3} value={value ?? ''} onChange={e => onChange(e.target.value)} />
  case 'select':
    return (
      <Select value={String(value ?? '')} onChange={e => onChange(e.target.value)}>
        {field.options?.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
      </Select>
    )
  case 'list':
    return <ListInput value={Array.isArray(value) ? value : []} onChange={onChange} placeholder="Digite e tecle Enter" />
  case 'secret':
    return (
      <div className="flex items-center gap-2">
        <Input type="password" autoComplete="new-password" value={value === '__clear__' ? '' : value ?? ''} onChange={e => onChange(e.target.value)}
          placeholder={field.isSet ? '•••••••• (definido — digite para trocar)' : 'Não definido'} />
        {field.isSet && value !== '__clear__' && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange('__clear__')}>Apagar</Button>
        )}
      </div>
    )
  case 'group':
    return (
      <Select value={value || ''} onChange={e => onChange(e.target.value)}>
        <option value="">— Nenhum —</option>
        {value && !groups.some(g => g.jid === value) && <option value={value}>{value}</option>}
        {groups.map(g => <option key={g.jid} value={g.jid}>{g.subject}{g.isCommunity ? ' (comunidade)' : ''}</option>)}
      </Select>
    )
  case 'groups':
    return <GroupsPicker value={Array.isArray(value) ? value : []} onChange={onChange} groups={groups} />
  default:
    return <Input value={value ?? ''} onChange={e => onChange(e.target.value)} />
  }
}

export const ConfigSection = ({ title, fields, extra }: { title: string, fields: ConfigField[], extra?: ReactNode }) => {
  const queryClient = useQueryClient()
  const { toast, confirm } = useUi()
  const { user } = useAuth()
  const [draft, setDraft] = useState<Values>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [needsRestart, setNeedsRestart] = useState(false)
  const needsGroups = fields.some(f => f.type === 'group' || f.type === 'groups')
  const groups = useQuery({ queryKey: ['groups'], queryFn: () => get<GroupSummary[]>('/groups'), enabled: needsGroups })

  const dirty = Object.keys(draft).length > 0
  const value = (f: ConfigField) => (f.key in draft ? draft[f.key] : f.value)
  const change = (key: string, v: unknown) => {
    const original = fields.find(f => f.key === key)?.value
    setDraft(d => {
      const next = { ...d }
      if (JSON.stringify(v) === JSON.stringify(original) || (v === '' && fields.find(f => f.key === key)?.type === 'secret')) delete next[key]
      else next[key] = v
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    setErrors({})
    try {
      const res = await put<{ saved: string[], errors: Record<string, string>, restart: boolean }>('/config', { values: draft })
      setErrors(res.errors)
      if (res.saved.length) {
        toast('Configurações salvas')
        setDraft(d => Object.fromEntries(Object.entries(d).filter(([k]) => res.errors[k])))
        queryClient.invalidateQueries({ queryKey: ['config'] })
      }
      if (res.restart) setNeedsRestart(true)
      if (Object.keys(res.errors).length) toast('Algumas opções não foram salvas', 'error')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    } finally {
      setSaving(false)
    }
  }

  const restart = async () => {
    if (!await confirm({ title: 'Reiniciar o bot agora?', message: 'Ele fica fora do ar por alguns segundos.', confirmLabel: 'Reiniciar' })) return
    await post('/system/restart').then(() => toast('Reiniciando... o painel reconecta sozinho', 'info'), e => toast(e.message, 'error'))
    setNeedsRestart(false)
  }

  return (
    <Card title={title} action={fields.every(f => f.readonly) ? <Lock className="size-4 text-text-3" /> : undefined}>
      <div className="space-y-5">
        {fields.map(f => (
          f.type === 'boolean' ? (
            <div key={f.key} className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm">
                  {f.label}
                  {f.restart && <Badge tone="warning">reinício</Badge>}
                </div>
                {errors[f.key] ? <div className="text-xs text-danger">{errors[f.key]}</div> : f.help && <div className="text-xs text-text-3">{f.help}</div>}
              </div>
              <FieldInput field={f} value={value(f)} onChange={v => change(f.key, v)} groups={groups.data || []} />
            </div>
          ) : (
            <Field key={f.key} label={<span className="flex items-center gap-2">{f.label}{f.restart && <Badge tone="warning">reinício</Badge>}</span>}
              help={f.help} error={errors[f.key]}>
              <FieldInput field={f} value={value(f)} onChange={v => change(f.key, v)} groups={groups.data || []} />
            </Field>
          )
        ))}
      </div>
      {extra}
      {(dirty || needsRestart) && (
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          {needsRestart && (
            <span className="mr-auto flex items-center gap-1.5 text-sm text-warning">
              <AlertTriangle className="size-4" /> Algumas mudanças só valem depois de reiniciar.
              {user?.isOwner && <Button size="sm" variant="outline" icon={<RotateCw className="size-4" />} onClick={restart}>Reiniciar agora</Button>}
            </span>
          )}
          {dirty && <>
            <Button variant="ghost" onClick={() => { setDraft({}); setErrors({}) }}>Descartar</Button>
            <Button variant="primary" loading={saving} onClick={save}>Salvar alterações</Button>
          </>}
        </div>
      )}
    </Card>
  )
}

export const useConfig = () => useQuery({ queryKey: ['config'], queryFn: () => get<ConfigField[]>('/config') })

export const useSections = (fields: ConfigField[] | undefined) => useMemo(() => {
  const map = new Map<string, ConfigField[]>()
  for (const f of fields || []) {
    if (!map.has(f.section)) map.set(f.section, [])
    map.get(f.section)!.push(f)
  }
  return Array.from(map.entries())
}, [fields])
