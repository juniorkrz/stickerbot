import { useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { ImagePlus, Megaphone, Pencil, Plus, Send, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { WaText } from '../components/WaText'
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
  Switch,
  SwitchRow,
  Textarea,
  useUi
} from '../components/ui'
import { API_BASE, del, fileToDataUrl, get, patch, post, put } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatDateTime, formatNumber, timeAgo } from '../lib/format'
import type { Ad, AdsConfig } from '../lib/types'

// resolve o spintax {a|b} escolhendo sempre a primeira opção (para a prévia)
const spinPreview = (text: string) => {
  let out = text
  const re = /\{([^{}]+)\}/
  while (re.test(out)) out = out.replace(re, (_m, g: string) => g.split('|')[0])
  return out
}

const ConfigCard = () => {
  const queryClient = useQueryClient()
  const { toast } = useUi()
  const query = useQuery({ queryKey: ['ads-config'], queryFn: () => get<AdsConfig>('/ads/config') })
  const [every, setEvery] = useState('')
  const [cooldown, setCooldown] = useState('')
  useEffect(() => {
    if (query.data) {
      setEvery(String(query.data.every))
      setCooldown(String(Math.round(query.data.cooldown / 60)))
    }
  }, [query.data])

  const save = async (body: Partial<AdsConfig>) => {
    try {
      const data = await put<AdsConfig>('/ads/config', body)
      queryClient.setQueryData(['ads-config'], data)
      toast('Configuração salva')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    }
  }

  if (!query.data) return <Card><Loading /></Card>
  const dirty = String(query.data.every) !== every || String(Math.round(query.data.cooldown / 60)) !== cooldown
  return (
    <Card title="Como os anúncios são enviados">
      <SwitchRow label="Sistema de anúncios ligado" help="Quando desligado, nenhum anúncio é enviado." checked={query.data.system}
        onChange={v => save({ system: v })} />
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Field label="Enviar 1 anúncio a cada" help="Contando figurinhas e comandos de todos os chats.">
          <div className="flex items-center gap-2"><Input type="number" min={1} value={every} onChange={e => setEvery(e.target.value)} className="w-28" /><span className="text-sm text-text-3">usos</span></div>
        </Field>
        <Field label="Intervalo mínimo por conversa" help="Um mesmo chat não recebe anúncio antes disso.">
          <div className="flex items-center gap-2"><Input type="number" min={0} value={cooldown} onChange={e => setCooldown(e.target.value)} className="w-28" /><span className="text-sm text-text-3">minutos</span></div>
        </Field>
      </div>
      {dirty && (
        <div className="mt-4 flex justify-end">
          <Button variant="primary" onClick={() => save({ every: Number(every), cooldown: Number(cooldown) * 60 })}>Salvar</Button>
        </div>
      )}
    </Card>
  )
}

const AdEditor = ({ ad, onClose, onSaved }: { ad: Ad | null | 'new', onClose: () => void, onSaved: () => void }) => {
  const { toast } = useUi()
  const [content, setContent] = useState('')
  const [image, setImage] = useState<string | null>(null) // data URL nova
  const [removeImage, setRemoveImage] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const existing = ad && ad !== 'new' ? ad : null

  useEffect(() => {
    setContent(existing?.content || '')
    setImage(null)
    setRemoveImage(false)
  }, [ad]) // eslint-disable-line react-hooks/exhaustive-deps

  const previewImage = image || (existing?.hasImage && !removeImage ? `${API_BASE}/ads/${existing.id}/image?v=${existing.updatedAt}` : null)

  const save = async () => {
    setBusy(true)
    try {
      if (existing) {
        await patch(`/ads/${existing.id}`, { content, ...(image ? { image } : removeImage ? { image: null } : {}) })
      } else {
        await post('/ads', { content, image })
      }
      toast('Anúncio salvo')
      onSaved()
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={!!ad} onClose={onClose} title={existing ? 'Editar anúncio' : 'Novo anúncio'} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} disabled={!content.trim()} onClick={save}>Salvar</Button></>}>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <Field label="Texto" help={<>Aceita a formatação do WhatsApp (*negrito*, _itálico_) e variações aleatórias com {'{'}opção1|opção2{'}'}.</>}>
            <Textarea value={content} onChange={e => setContent(e.target.value)} rows={9} placeholder="🔥 Conheça a loja X! {Acesse|Visite} ..." />
          </Field>
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-text-2">Imagem (opcional)</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" icon={<ImagePlus className="size-4" />} onClick={() => fileRef.current?.click()}>
                {previewImage ? 'Trocar imagem' : 'Adicionar imagem'}
              </Button>
              {previewImage && <Button size="sm" variant="ghost" className="text-danger" icon={<X className="size-4" />}
                onClick={() => { setImage(null); setRemoveImage(true) }}>Remover</Button>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async e => {
              const f = e.target.files?.[0]
              if (!f) return
              if (f.size > 5 * 1024 * 1024) return toast('Imagem muito grande (máx. 5 MB)', 'error')
              setImage(await fileToDataUrl(f))
              setRemoveImage(false)
            }} />
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-text-2">Prévia</div>
          <div className="chat-wallpaper rounded-lg p-4">
            <div className="max-w-[280px] rounded-lg bg-bubble-in p-1.5 text-[14px] shadow-sm">
              {previewImage && <img src={previewImage} alt="" className="mb-1 w-full rounded-md" />}
              <div className="whitespace-pre-wrap break-words px-1 pb-1">
                {content ? <WaText text={spinPreview(content)} /> : <span className="text-text-3">O texto aparece aqui</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default function Ads() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { toast, confirm } = useUi()
  const [editing, setEditing] = useState<Ad | null | 'new'>(null)
  const [testing, setTesting] = useState<Ad | null>(null)
  const [testJid, setTestJid] = useState('')
  const query = useQuery({ queryKey: ['ads'], queryFn: () => get<Ad[]>('/ads') })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['ads'] })

  const sendTest = async () => {
    if (!testing) return
    try {
      await post(`/ads/${testing.id}/test`, { jid: testJid || user?.phone })
      toast('Teste enviado')
      setTesting(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    }
  }

  return (
    <Page>
      <PageHeader title="Anúncios" subtitle="Mensagens enviadas automaticamente entre as figurinhas"
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Novo anúncio</Button>} />
      <ConfigCard />

      <div className="mt-5">
        {query.isLoading ? <Loading /> : query.error ? <ErrorState error={query.error} /> : !query.data?.length ? (
          <Card><EmptyState icon={<Megaphone />} title="Nenhum anúncio cadastrado">Crie o primeiro para começar a monetizar o bot.</EmptyState></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {query.data.map(ad => (
              <div key={ad.id} className={clsx('flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-card', !ad.active && 'opacity-60')}>
                {ad.hasImage && <img src={`${API_BASE}/ads/${ad.id}/image?v=${ad.updatedAt}`} alt="" className="h-40 w-full object-cover" loading="lazy" />}
                <div className="flex-1 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-text-3">#{ad.id}</span>
                    <Switch checked={ad.active} label="Ativo" onChange={v => patch(`/ads/${ad.id}`, { active: v }).then(refresh, e => toast(e.message, 'error'))} />
                  </div>
                  <div className="line-clamp-6 whitespace-pre-wrap break-words text-sm"><WaText text={spinPreview(ad.content)} /></div>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
                  <div className="text-xs text-text-3" title={ad.lastSentAt ? `Último envio: ${formatDateTime(ad.lastSentAt)}` : undefined}>
                    <Badge tone={ad.active ? 'accent' : 'neutral'}>{formatNumber(ad.sentCount)} envios</Badge>
                    <span className="ml-2">{ad.lastSentAt ? timeAgo(ad.lastSentAt) : 'nunca enviado'}</span>
                  </div>
                  <div className="flex">
                    <Button size="icon-sm" variant="ghost" aria-label="Enviar teste" title="Enviar teste" onClick={() => { setTesting(ad); setTestJid('') }}><Send className="size-4" /></Button>
                    <Button size="icon-sm" variant="ghost" aria-label="Editar" onClick={() => setEditing(ad)}><Pencil className="size-4" /></Button>
                    <Button size="icon-sm" variant="ghost" className="text-danger" aria-label="Apagar" onClick={async () => {
                      if (await confirm({ title: 'Apagar anúncio?', confirmLabel: 'Apagar', danger: true })) {
                        await del(`/ads/${ad.id}`).then(() => { toast('Anúncio apagado'); refresh() }, e => toast(e.message, 'error'))
                      }
                    }}><Trash2 className="size-4" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AdEditor ad={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      <Modal open={!!testing} onClose={() => setTesting(null)} title="Enviar teste" size="sm"
        footer={<><Button variant="ghost" onClick={() => setTesting(null)}>Cancelar</Button><Button variant="primary" onClick={sendTest}>Enviar</Button></>}>
        <Field label="Para" help="Número ou ID do grupo. Em branco envia para você. O teste não conta nos envios.">
          <Input autoFocus value={testJid} onChange={e => setTestJid(e.target.value)} placeholder={user?.phone} />
        </Field>
      </Modal>
    </Page>
  )
}
